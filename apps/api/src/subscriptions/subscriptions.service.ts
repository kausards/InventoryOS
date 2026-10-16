import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import {
  withSystem,
  subscriptionPlans,
  subscriptions,
  subscriptionUsage,
  manualPaymentSubmissions,
  billingInvoices,
  tenants,
  auditLogs,
} from '@growthomic/db';
import type {
  CreatePlanInput,
  ManualPaymentSubmissionInput,
  PlanEntitlements,
  SubscriptionStatus,
} from '@growthomic/shared';
import {
  isRestrictedReadOnlyMode,
  checkResourceLimit,
  canTransitionSubscription,
} from '@growthomic/shared';

@Injectable()
export class SubscriptionsService {
  /**
   * Helper to serialize BigInts to Number for Fastify JSON responses
   */
  private serializePlan(p: any) {
    if (!p) return null;
    return {
      ...p,
      monthlyPriceMinor: p.monthlyPriceMinor != null ? Number(p.monthlyPriceMinor) : 0,
      annualPriceMinor: p.annualPriceMinor != null ? Number(p.annualPriceMinor) : 0,
    };
  }

  private serializeInvoice(inv: any) {
    if (!inv) return null;
    return {
      ...inv,
      amountMinor: inv.amountMinor != null ? Number(inv.amountMinor) : 0,
    };
  }

  private serializeManualPayment(mp: any) {
    if (!mp) return null;
    return {
      ...mp,
      amountMinor: mp.amountMinor != null ? Number(mp.amountMinor) : 0,
    };
  }

  // ==========================================
  // 1. LIST AVAILABLE PLANS
  // ==========================================
  async getPlans() {
    return withSystem(async (tx) => {
      const rows = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(subscriptionPlans.monthlyPriceMinor);

      return rows.map((r) => this.serializePlan(r));
    });
  }

  // ==========================================
  // 2. GET CURRENT SUBSCRIPTION & USAGE
  // ==========================================
  async getCurrentSubscription(tenantId: string) {
    return withSystem(async (tx) => {
      let subRows = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);

      // Auto-heal: If tenant has no subscription, create 14-day trial on Starter plan
      if (!subRows[0]) {
        let starterPlan = await tx
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.slug, 'starter'))
          .limit(1);

        if (!starterPlan[0]) {
          const anyPlan = await tx.select().from(subscriptionPlans).limit(1);
          starterPlan = anyPlan;
        }

        if (starterPlan[0]) {
          const now = new Date();
          const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

          const inserted = await tx
            .insert(subscriptions)
            .values({
              tenantId,
              planId: starterPlan[0]!.id,
              status: 'trial',
              billingCycle: 'monthly',
              currentPeriodStart: now.toISOString(),
              currentPeriodEnd: trialEnd.toISOString(),
              trialEndsAt: trialEnd.toISOString(),
            })
            .returning();

          subRows = inserted;

          // Also initialize initial usage
          if (inserted[0]) {
            await tx.insert(subscriptionUsage).values({
              tenantId,
              subscriptionId: inserted[0].id,
              periodStart: now.toISOString(),
              periodEnd: trialEnd.toISOString(),
              ordersCount: 0,
            });
          }
        }
      }

      const currentSub = subRows[0];
      if (!currentSub) {
        throw new NotFoundException('Subscription record not found for tenant');
      }

      // Fetch plan details
      const planRows = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, currentSub.planId))
        .limit(1);
      const plan = planRows[0];

      // Fetch current period usage
      const usageRows = await tx
        .select()
        .from(subscriptionUsage)
        .where(
          and(
            eq(subscriptionUsage.tenantId, tenantId),
            eq(subscriptionUsage.subscriptionId, currentSub.id)
          )
        )
        .orderBy(desc(subscriptionUsage.periodEnd))
        .limit(1);

      const usage = usageRows[0] ?? { ordersCount: 0 };
      const entitlements: PlanEntitlements = (plan?.entitlements as PlanEntitlements) ?? {
        maxMonthlyOrders: 500,
        maxStores: 1,
        maxStaff: 2,
        maxWarehouses: 1,
        maxCouriers: 2,
        featureFlags: [],
      };

      const isReadOnly = isRestrictedReadOnlyMode(
        currentSub.status as SubscriptionStatus,
        currentSub.graceEndsAt
      );

      const orderLimitCheck = checkResourceLimit(
        usage.ordersCount,
        entitlements.maxMonthlyOrders,
        'orders'
      );

      return {
        subscription: currentSub,
        plan: this.serializePlan(plan),
        entitlements,
        usage: {
          ordersCount: usage.ordersCount,
          periodStart: usageRows[0]?.periodStart ?? currentSub.currentPeriodStart,
          periodEnd: usageRows[0]?.periodEnd ?? currentSub.currentPeriodEnd,
        },
        statusChecks: {
          isRestrictedReadOnlyMode: isReadOnly,
          orderLimit: {
            current: usage.ordersCount,
            allowed: entitlements.maxMonthlyOrders,
            effectiveLimit: orderLimitCheck.effectiveLimit,
            isAllowed: orderLimitCheck.allowed,
            isGraceOverage: orderLimitCheck.isGraceOverage,
          },
        },
      };
    });
  }

  // ==========================================
  // 3. SUBMIT MANUAL PAYMENT (bKash, Nagad, Rocket, Bank)
  // ==========================================
  async submitManualPayment(
    tenantId: string,
    userId: string,
    dto: ManualPaymentSubmissionInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      // 1. Verify plan exists
      const planRows = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, dto.planId))
        .limit(1);

      const plan = planRows[0];
      if (!plan || !plan.isActive) {
        throw new BadRequestException('Selected subscription plan does not exist or is inactive');
      }

      // 2. Prevent duplicate pending submission with identical transaction ID
      const existingTx = await tx
        .select()
        .from(manualPaymentSubmissions)
        .where(
          and(
            eq(manualPaymentSubmissions.transactionId, dto.transactionId.trim()),
            eq(manualPaymentSubmissions.status, 'pending')
          )
        )
        .limit(1);

      if (existingTx[0]) {
        throw new BadRequestException(
          'A pending payment submission with this Transaction ID already exists. Please await admin review.'
        );
      }

      // 3. Create manual payment submission
      const inserted = await tx
        .insert(manualPaymentSubmissions)
        .values({
          tenantId,
          planId: dto.planId,
          billingCycle: dto.billingCycle,
          paymentMethod: dto.paymentMethod,
          amountMinor: BigInt(dto.amountMinor),
          transactionId: dto.transactionId.trim(),
          senderNumber: dto.senderNumber.trim(),
          receiptUrl: dto.receiptUrl ?? null,
          notes: dto.notes ?? null,
          status: 'pending',
          submittedBy: userId,
        })
        .returning();

      const submission = inserted[0];
      if (!submission) {
        throw new BadRequestException('Failed to create manual payment submission');
      }

      // 4. Update subscription status to 'payment_pending' if current subscription is not active
      const sub = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);

      if (sub[0] && sub[0].status !== 'active') {
        await tx
          .update(subscriptions)
          .set({
            status: 'payment_pending',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(subscriptions.id, sub[0].id));
      }

      // 5. Audit Log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'subscription.payment_submitted',
        entityType: 'manual_payment',
        entityId: submission.id,
        after: {
          transactionId: submission.transactionId,
          paymentMethod: submission.paymentMethod,
          amountMinor: Number(submission.amountMinor),
          planId: submission.planId,
        },
        requestId: requestId ?? null,
      });

      return this.serializeManualPayment(submission);
    });
  }

  // ==========================================
  // 4. LIST TENANT'S MANUAL PAYMENT SUBMISSIONS
  // ==========================================
  async listManualPayments(tenantId: string) {
    return withSystem(async (tx) => {
      const rows = await tx
        .select()
        .from(manualPaymentSubmissions)
        .where(eq(manualPaymentSubmissions.tenantId, tenantId))
        .orderBy(desc(manualPaymentSubmissions.createdAt));

      return rows.map((r) => this.serializeManualPayment(r));
    });
  }

  // ==========================================
  // 5. LIST TENANT'S BILLING INVOICES
  // ==========================================
  async listInvoices(tenantId: string) {
    return withSystem(async (tx) => {
      const rows = await tx
        .select()
        .from(billingInvoices)
        .where(eq(billingInvoices.tenantId, tenantId))
        .orderBy(desc(billingInvoices.createdAt));

      return rows.map((r) => this.serializeInvoice(r));
    });
  }

  // ==========================================
  // 6. TRACK MONTHLY ORDER USAGE
  // ==========================================
  async incrementOrderUsage(tenantId: string) {
    return withSystem(async (tx) => {
      const sub = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);

      if (!sub[0]) return;

      const activeUsage = await tx
        .select()
        .from(subscriptionUsage)
        .where(
          and(
            eq(subscriptionUsage.tenantId, tenantId),
            eq(subscriptionUsage.subscriptionId, sub[0].id)
          )
        )
        .orderBy(desc(subscriptionUsage.periodEnd))
        .limit(1);

      if (activeUsage[0]) {
        await tx
          .update(subscriptionUsage)
          .set({
            ordersCount: sql`${subscriptionUsage.ordersCount} + 1`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(subscriptionUsage.id, activeUsage[0].id));
      } else {
        const now = new Date();
        const end = new Date(sub[0].currentPeriodEnd);
        await tx.insert(subscriptionUsage).values({
          tenantId,
          subscriptionId: sub[0].id,
          periodStart: now.toISOString(),
          periodEnd: end.toISOString(),
          ordersCount: 1,
        });
      }
    });
  }
}
