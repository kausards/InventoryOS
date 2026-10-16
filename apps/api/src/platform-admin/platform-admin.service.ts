import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import {
  withSystem,
  subscriptionPlans,
  subscriptions,
  subscriptionUsage,
  manualPaymentSubmissions,
  billingInvoices,
  tenants,
  users,
  auditLogs,
} from '@growthomic/db';
import type { VerifyPaymentInput } from '@growthomic/shared';

@Injectable()
export class PlatformAdminService {
  private serializePayment(mp: any) {
    if (!mp) return null;
    return {
      ...mp,
      amountMinor: mp.amountMinor != null ? Number(mp.amountMinor) : 0,
    };
  }

  // ==========================================
  // 1. LIST PENDING PAYMENTS
  // ==========================================
  async listPendingPayments() {
    return withSystem(async (tx) => {
      const rows = await tx
        .select({
          id: manualPaymentSubmissions.id,
          tenantId: manualPaymentSubmissions.tenantId,
          tenantName: tenants.name,
          planId: manualPaymentSubmissions.planId,
          planName: subscriptionPlans.name,
          billingCycle: manualPaymentSubmissions.billingCycle,
          paymentMethod: manualPaymentSubmissions.paymentMethod,
          amountMinor: manualPaymentSubmissions.amountMinor,
          transactionId: manualPaymentSubmissions.transactionId,
          senderNumber: manualPaymentSubmissions.senderNumber,
          receiptUrl: manualPaymentSubmissions.receiptUrl,
          notes: manualPaymentSubmissions.notes,
          status: manualPaymentSubmissions.status,
          submittedBy: manualPaymentSubmissions.submittedBy,
          submittedByEmail: users.email,
          createdAt: manualPaymentSubmissions.createdAt,
        })
        .from(manualPaymentSubmissions)
        .innerJoin(tenants, eq(manualPaymentSubmissions.tenantId, tenants.id))
        .innerJoin(subscriptionPlans, eq(manualPaymentSubmissions.planId, subscriptionPlans.id))
        .leftJoin(users, eq(manualPaymentSubmissions.submittedBy, users.id))
        .orderBy(desc(manualPaymentSubmissions.createdAt));

      return rows.map((r) => this.serializePayment(r));
    });
  }

  // ==========================================
  // 2. VERIFY OR REJECT PAYMENT (ATOMIC ACTIVATION)
  // ==========================================
  async verifyPayment(
    submissionId: string,
    adminUserId: string,
    dto: VerifyPaymentInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const submissionRows = await tx
        .select()
        .from(manualPaymentSubmissions)
        .where(eq(manualPaymentSubmissions.id, submissionId))
        .limit(1);

      const submission = submissionRows[0];
      if (!submission) {
        throw new NotFoundException('Payment submission not found');
      }

      if (submission.status !== 'pending') {
        throw new BadRequestException(`Payment submission is already ${submission.status}`);
      }

      const now = new Date();

      if (dto.decision === 'rejected') {
        const updated = await tx
          .update(manualPaymentSubmissions)
          .set({
            status: 'rejected',
            verifiedBy: adminUserId,
            verifiedAt: now.toISOString(),
            rejectionReason: dto.rejectionReason ?? 'Invalid Transaction ID or unmatched payment',
          })
          .where(eq(manualPaymentSubmissions.id, submissionId))
          .returning();

        // Audit Log
        await tx.insert(auditLogs).values({
          tenantId: submission.tenantId,
          actorType: 'platform_admin',
          actorId: adminUserId,
          action: 'subscription.payment_rejected',
          entityType: 'manual_payment',
          entityId: submission.id,
          after: {
            reason: dto.rejectionReason,
            transactionId: submission.transactionId,
          },
          requestId: requestId ?? null,
        });

        return this.serializePayment(updated[0]!);
      }

      // Decision is 'verified': Activate Subscription + Issue Invoice
      // 1. Fetch Plan details
      const planRows = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, submission.planId))
        .limit(1);

      const plan = planRows[0];
      if (!plan) {
        throw new BadRequestException('Associated subscription plan not found');
      }

      // 2. Calculate period dates
      const durationDays = submission.billingCycle === 'annual' ? 365 : 30;
      const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // 3. Mark payment verified
      const updatedSubmission = await tx
        .update(manualPaymentSubmissions)
        .set({
          status: 'verified',
          verifiedBy: adminUserId,
          verifiedAt: now.toISOString(),
          rejectionReason: null,
        })
        .where(eq(manualPaymentSubmissions.id, submissionId))
        .returning();

      // 4. Update or Upsert Subscription
      const existingSub = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, submission.tenantId))
        .limit(1);

      let subId: string;
      if (existingSub[0]) {
        subId = existingSub[0].id;
        await tx
          .update(subscriptions)
          .set({
            planId: submission.planId,
            status: 'active',
            billingCycle: submission.billingCycle,
            currentPeriodStart: now.toISOString(),
            currentPeriodEnd: periodEnd.toISOString(),
            graceEndsAt: null,
            updatedAt: now.toISOString(),
          })
          .where(eq(subscriptions.id, existingSub[0].id));
      } else {
        const createdSub = await tx
          .insert(subscriptions)
          .values({
            tenantId: submission.tenantId,
            planId: submission.planId,
            status: 'active',
            billingCycle: submission.billingCycle,
            currentPeriodStart: now.toISOString(),
            currentPeriodEnd: periodEnd.toISOString(),
          })
          .returning();
        subId = createdSub[0]!.id;
      }

      // 5. Generate and Insert Billing Invoice
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-SUB-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${randSuffix}`;

      const insertedInvoice = await tx
        .insert(billingInvoices)
        .values({
          tenantId: submission.tenantId,
          invoiceNumber,
          subscriptionId: subId,
          planName: plan.name,
          amountMinor: submission.amountMinor,
          currency: 'BDT',
          billingPeriodStart: now.toISOString(),
          billingPeriodEnd: periodEnd.toISOString(),
          paymentStatus: 'paid',
          paymentMethod: submission.paymentMethod,
          paidAt: now.toISOString(),
        })
        .returning();

      // 6. Reset / Insert usage record for the new period
      await tx.insert(subscriptionUsage).values({
        tenantId: submission.tenantId,
        subscriptionId: subId,
        periodStart: now.toISOString(),
        periodEnd: periodEnd.toISOString(),
        ordersCount: 0,
      });

      // 7. Audit Log
      await tx.insert(auditLogs).values({
        tenantId: submission.tenantId,
        actorType: 'platform_admin',
        actorId: adminUserId,
        action: 'subscription.payment_verified',
        entityType: 'manual_payment',
        entityId: submission.id,
        after: {
          transactionId: submission.transactionId,
          invoiceNumber,
          planName: plan.name,
          periodEnd: periodEnd.toISOString(),
        },
        requestId: requestId ?? null,
      });

      return {
        payment: this.serializePayment(updatedSubmission[0]!),
        invoice: {
          ...insertedInvoice[0],
          amountMinor: Number(insertedInvoice[0]?.amountMinor ?? 0),
        },
        subscriptionStatus: 'active',
        periodEnd: periodEnd.toISOString(),
      };
    });
  }

  // ==========================================
  // 3. TENANTS OVERVIEW & DIRECTORY
  // ==========================================
  async listTenantsOverview() {
    return withSystem(async (tx) => {
      const rows = await tx
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          status: tenants.status,
          currency: tenants.currency,
          createdAt: tenants.createdAt,
          subStatus: subscriptions.status,
          billingCycle: subscriptions.billingCycle,
          periodEnd: subscriptions.currentPeriodEnd,
          planName: subscriptionPlans.name,
        })
        .from(tenants)
        .leftJoin(subscriptions, eq(tenants.id, subscriptions.tenantId))
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .orderBy(desc(tenants.createdAt));

      return rows;
    });
  }

  // ==========================================
  // 4. PLATFORM METRICS / STATS
  // ==========================================
  async getPlatformStats() {
    return withSystem(async (tx) => {
      const tenantCountResult = await tx
        .select({ count: sql<number>`count(*)` })
        .from(tenants);

      const activeSubResult = await tx
        .select({ count: sql<number>`count(*)` })
        .from(subscriptions)
        .where(eq(subscriptions.status, 'active'));

      const pendingPaymentsResult = await tx
        .select({ count: sql<number>`count(*)` })
        .from(manualPaymentSubmissions)
        .where(eq(manualPaymentSubmissions.status, 'pending'));

      const revenueResult = await tx
        .select({ totalMinor: sql<string>`coalesce(sum(amount_minor), 0)` })
        .from(billingInvoices)
        .where(eq(billingInvoices.paymentStatus, 'paid'));

      return {
        totalTenants: Number(tenantCountResult[0]?.count ?? 0),
        activeSubscriptions: Number(activeSubResult[0]?.count ?? 0),
        pendingPaymentReviews: Number(pendingPaymentsResult[0]?.count ?? 0),
        totalPlatformRevenueMinor: Number(revenueResult[0]?.totalMinor ?? 0),
      };
    });
  }
}
