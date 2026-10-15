import { Injectable, NotFoundException, BadRequestException, Optional, Inject, forwardRef } from '@nestjs/common';
import {
  withSystem,
  riskRules,
  riskRuleHistory,
  blacklistEntries,
  customerRiskChecks,
  orders,
  customers,
  auditLogs,
} from '@growthomic/db';
import { eq, and, sql, desc, ilike, or } from 'drizzle-orm';
import {
  normalizeBdPhone,
  evaluateCustomerRisk,
  DEFAULT_RISK_RULES,
  UpdateRiskRulesInput,
  CreateBlacklistEntryInput,
  UpdateBlacklistEntryInput,
  ManualRiskReviewInput,
  CheckRiskInput,
  RiskEvaluationResult,
  CourierFraudCheckResult,
} from '@growthomic/shared';
import { CouriersService } from '../couriers/couriers.service';

@Injectable()
export class RiskService {
  constructor(
    @Optional()
    @Inject(forwardRef(() => CouriersService))
    private readonly couriersService?: CouriersService
  ) {}

  /**
   * Retrieves or initializes tenant risk rules configuration.
   */
  async getSettings(tenantId: string) {
    return withSystem(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(riskRules)
          .where(eq(riskRules.tenantId, tenantId))
          .limit(1)
      )[0];

      if (existing) {
        return existing;
      }

      // Initialize default rules for tenant
      const inserted = (
        await tx
          .insert(riskRules)
          .values({
            tenantId,
            minEligibleOrders: DEFAULT_RISK_RULES.minEligibleOrders,
            cancellationThresholdPercent: DEFAULT_RISK_RULES.cancellationThresholdPercent,
            returnThresholdPercent: DEFAULT_RISK_RULES.returnThresholdPercent,
            deliveryFailureThresholdPercent: DEFAULT_RISK_RULES.deliveryFailureThresholdPercent,
            autoFlagHighRisk: DEFAULT_RISK_RULES.autoFlagHighRisk,
            manualReviewRequiredForHighRisk: DEFAULT_RISK_RULES.manualReviewRequiredForHighRisk,
            cacheDurationHours: 24,
          })
          .returning()
      )[0];

      return inserted;
    });
  }

  /**
   * Updates tenant risk rules and preserves audit history snapshot.
   */
  async updateSettings(tenantId: string, actorId: string, input: UpdateRiskRulesInput) {
    return withSystem(async (tx) => {
      const current = await this.getSettings(tenantId);
      if (!current) {
        throw new NotFoundException('Risk settings not found');
      }

      // Snapshot current state into immutable history
      await tx.insert(riskRuleHistory).values({
        tenantId,
        rulesSnapshot: current,
        changedBy: actorId,
        reason: input.reason || 'Thresholds updated via settings',
      });

      const updated = (
        await tx
          .update(riskRules)
          .set({
            ...(input.minEligibleOrders !== undefined && { minEligibleOrders: input.minEligibleOrders }),
            ...(input.cancellationThresholdPercent !== undefined && {
              cancellationThresholdPercent: input.cancellationThresholdPercent,
            }),
            ...(input.returnThresholdPercent !== undefined && {
              returnThresholdPercent: input.returnThresholdPercent,
            }),
            ...(input.deliveryFailureThresholdPercent !== undefined && {
              deliveryFailureThresholdPercent: input.deliveryFailureThresholdPercent,
            }),
            ...(input.autoFlagHighRisk !== undefined && { autoFlagHighRisk: input.autoFlagHighRisk }),
            ...(input.manualReviewRequiredForHighRisk !== undefined && {
              manualReviewRequiredForHighRisk: input.manualReviewRequiredForHighRisk,
            }),
            ...(input.cacheDurationHours !== undefined && { cacheDurationHours: input.cacheDurationHours }),
            updatedBy: actorId,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(riskRules.id, current.id))
          .returning()
      )[0];

      return updated;
    });
  }

  /**
   * Returns chronological history of risk rule changes.
   */
  async getRulesHistory(tenantId: string) {
    return withSystem(async (tx) => {
      return tx
        .select()
        .from(riskRuleHistory)
        .where(eq(riskRuleHistory.tenantId, tenantId))
        .orderBy(desc(riskRuleHistory.createdAt))
        .limit(50);
    });
  }

  /**
   * Lists blacklist and watchlist entries with optional filtering.
   */
  async listBlacklist(
    tenantId: string,
    query: { search?: string; type?: string; isActive?: boolean }
  ) {
    return withSystem(async (tx) => {
      const conditions: any[] = [eq(blacklistEntries.tenantId, tenantId)];

      if (query.type) {
        conditions.push(eq(blacklistEntries.type, query.type));
      }
      if (query.isActive !== undefined) {
        conditions.push(eq(blacklistEntries.isActive, query.isActive));
      }
      if (query.search?.trim()) {
        const s = `%${query.search.trim()}%`;
        conditions.push(
          or(
            ilike(blacklistEntries.phone, s),
            ilike(blacklistEntries.normalizedPhone, s),
            ilike(blacklistEntries.reason, s)
          )
        );
      }

      return tx
        .select()
        .from(blacklistEntries)
        .where(and(...conditions))
        .orderBy(desc(blacklistEntries.createdAt));
    });
  }

  /**
   * Adds or updates a phone on the blacklist/watchlist.
   */
  async addBlacklistEntry(tenantId: string, actorId: string, input: CreateBlacklistEntryInput) {
    const norm = normalizeBdPhone(input.phone);
    if (!norm.isValid || !norm.e164) {
      throw new BadRequestException('Please provide a valid 11-digit Bangladesh mobile number');
    }

    return withSystem(async (tx) => {
      // Find linked customer if any
      let customerId = input.customerId;
      if (!customerId) {
        const cust = (
          await tx
            .select({ id: customers.id })
            .from(customers)
            .where(and(eq(customers.tenantId, tenantId), eq(customers.normalizedPhone, norm.e164)))
            .limit(1)
        )[0];
        if (cust) {
          customerId = cust.id;
        }
      }

      // Check existing entry
      const existing = (
        await tx
          .select()
          .from(blacklistEntries)
          .where(and(eq(blacklistEntries.tenantId, tenantId), eq(blacklistEntries.normalizedPhone, norm.e164)))
          .limit(1)
      )[0];

      if (existing) {
        return (
          await tx
            .update(blacklistEntries)
            .set({
              type: input.type,
              reason: input.reason,
              customerId,
              isActive: true,
              addedBy: actorId,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(blacklistEntries.id, existing.id))
            .returning()
        )[0];
      }

      const inserted = (
        await tx
          .insert(blacklistEntries)
          .values({
            tenantId,
            phone: input.phone,
            normalizedPhone: norm.e164,
            customerId,
            type: input.type,
            reason: input.reason,
            addedBy: actorId,
            isActive: true,
          })
          .returning()
      )[0];

      return inserted;
    });
  }

  /**
   * Deactivates a blacklist/watchlist entry.
   */
  async deactivateBlacklistEntry(tenantId: string, entryId: string) {
    return withSystem(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(blacklistEntries)
          .where(and(eq(blacklistEntries.id, entryId), eq(blacklistEntries.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!existing) {
        throw new NotFoundException('Blacklist entry not found');
      }

      const updated = (
        await tx
          .update(blacklistEntries)
          .set({
            isActive: false,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(blacklistEntries.id, entryId))
          .returning()
      )[0];

      return updated;
    });
  }

  /**
   * Performs realistic risk assessment for a customer by phone number.
   * Utilizes TTL caching, internal order history, and manual blacklist.
   */
  async checkCustomerRisk(tenantId: string, input: CheckRiskInput) {
    const norm = normalizeBdPhone(input.phone);
    if (!norm.isValid || !norm.e164) {
      throw new BadRequestException('Please provide a valid 11-digit Bangladesh mobile number');
    }

    return withSystem(async (tx) => {
      const now = new Date();

      // Check cached evaluation
      if (!input.forceRefresh) {
        const cached = (
          await tx
            .select()
            .from(customerRiskChecks)
            .where(
              and(
                eq(customerRiskChecks.tenantId, tenantId),
                eq(customerRiskChecks.normalizedPhone, norm.e164),
                sql`${customerRiskChecks.validUntil} > ${now.toISOString()}`
              )
            )
            .orderBy(desc(customerRiskChecks.createdAt))
            .limit(1)
        )[0];

        if (cached) {
          // If orderId provided, update order risk
          if (input.orderId) {
            await tx
              .update(orders)
              .set({
                riskLevel: cached.riskStatus,
                riskScore: cached.riskScore,
                updatedAt: new Date().toISOString(),
              })
              .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, tenantId)));
          }
          return cached;
        }
      }

      // Fetch tenant rules
      const rules =
        (await this.getSettings(tenantId)) ?? {
          ...DEFAULT_RISK_RULES,
          cacheDurationHours: 24,
        };

      // Check Blacklist match
      const blacklistRow = (
        await tx
          .select()
          .from(blacklistEntries)
          .where(
            and(
              eq(blacklistEntries.tenantId, tenantId),
              eq(blacklistEntries.normalizedPhone, norm.e164),
              eq(blacklistEntries.isActive, true)
            )
          )
          .limit(1)
      )[0];

      const blacklistMatch = blacklistRow
        ? {
            isBlacklisted: blacklistRow.type === 'blacklist',
            isWatchlisted: blacklistRow.type === 'watchlist',
            reason: blacklistRow.reason,
          }
        : null;

      // Query internal order history across orders for this customer phone
      const customerOrders = await tx
        .select({
          status: orders.orderStatus,
        })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .where(
          and(
            eq(orders.tenantId, tenantId),
            eq(customers.normalizedPhone, norm.e164)
          )
        );

      const totalOrders = customerOrders.length;
      const deliveredOrders = customerOrders.filter((o) => o.status === 'delivered').length;
      const cancelledOrders = customerOrders.filter((o) => o.status === 'cancelled').length;
      const returnedOrders = customerOrders.filter((o) => o.status === 'returned').length;

      // Query Courier Provider for external delivery history
      let courierResult: CourierFraudCheckResult | null = null;
      if (this.couriersService) {
        try {
          courierResult = await this.couriersService.checkCustomerRisk(tenantId, norm.e164);
        } catch {
          courierResult = {
            provider: 'courier',
            phone: norm.e164,
            totalOrders: 0,
            successfulDeliveries: 0,
            returns: 0,
            deliveryRatePercent: 0,
            returnRatePercent: 0,
            riskRating: 'provider_unavailable',
            providerUnavailable: true,
          };
        }
      }

      let evaluation: RiskEvaluationResult;

      // 1. Blacklist check has top priority
      if (blacklistMatch?.isBlacklisted) {
        evaluation = evaluateCustomerRisk({
          history: { totalOrders, deliveredOrders, cancelledOrders, returnedOrders },
          blacklistMatch,
          rules,
        });
      }
      // 2. Gate 3: If provider is down/timed out/unavailable -> MUST return 'provider_unavailable', NEVER 'low'
      else if (courierResult?.providerUnavailable || courierResult?.riskRating === 'provider_unavailable') {
        evaluation = {
          riskStatus: 'provider_unavailable',
          riskScore: 50,
          riskFactors: [
            {
              factor: 'provider_unavailable',
              level: 'medium',
              details: 'Courier fraud check provider is currently unavailable or timed out. Manual review recommended.',
            },
          ],
          dataSource: 'courier',
          dataConfidence: 'low',
          metrics: {
            eligibleOrders: totalOrders,
            deliveredOrders,
            cancelledOrders,
            returnedOrders,
            deliveryRatePercent: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
            cancellationRatePercent: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0,
            returnRatePercent: totalOrders > 0 ? Math.round((returnedOrders / totalOrders) * 100) : 0,
          },
          requiresManualReview: true,
        };
      }
      // 3. Courier provider returned delivery history
      else if (courierResult && courierResult.provider !== 'none' && courierResult.totalOrders >= 1) {
        const combinedTotal = totalOrders + courierResult.totalOrders;
        const combinedDelivered = deliveredOrders + courierResult.successfulDeliveries;
        const combinedReturned = returnedOrders + courierResult.returns;
        const combinedCancelled = cancelledOrders;

        evaluation = evaluateCustomerRisk({
          history: {
            totalOrders: combinedTotal,
            deliveredOrders: combinedDelivered,
            cancelledOrders: combinedCancelled,
            returnedOrders: combinedReturned,
          },
          blacklistMatch,
          rules: {
            minEligibleOrders: rules.minEligibleOrders,
            cancellationThresholdPercent: rules.cancellationThresholdPercent,
            returnThresholdPercent: rules.returnThresholdPercent,
            deliveryFailureThresholdPercent: rules.deliveryFailureThresholdPercent,
            autoFlagHighRisk: rules.autoFlagHighRisk,
            manualReviewRequiredForHighRisk: rules.manualReviewRequiredForHighRisk,
          },
        });
        evaluation.dataSource = 'courier';
        if (courierResult.totalOrders >= 5) {
          evaluation.dataConfidence = 'high';
        }
      }
      // 4. Fallback to internal order history
      else {
        evaluation = evaluateCustomerRisk({
          history: {
            totalOrders,
            deliveredOrders,
            cancelledOrders,
            returnedOrders,
          },
          blacklistMatch,
          rules: {
            minEligibleOrders: rules.minEligibleOrders,
            cancellationThresholdPercent: rules.cancellationThresholdPercent,
            returnThresholdPercent: rules.returnThresholdPercent,
            deliveryFailureThresholdPercent: rules.deliveryFailureThresholdPercent,
            autoFlagHighRisk: rules.autoFlagHighRisk,
            manualReviewRequiredForHighRisk: rules.manualReviewRequiredForHighRisk,
          },
        });
      }

      const validUntil = new Date(Date.now() + rules.cacheDurationHours * 3600 * 1000).toISOString();

      // Resolve customer ID
      let customerId = input.customerId;
      if (!customerId) {
        const cust = (
          await tx
            .select({ id: customers.id })
            .from(customers)
            .where(and(eq(customers.tenantId, tenantId), eq(customers.normalizedPhone, norm.e164)))
            .limit(1)
        )[0];
        if (cust) customerId = cust.id;
      }

      // Record risk check
      const record = (
        await tx
          .insert(customerRiskChecks)
          .values({
            tenantId,
            phone: input.phone,
            normalizedPhone: norm.e164,
            customerId,
            orderId: input.orderId,
            riskStatus: evaluation.riskStatus,
            riskScore: evaluation.riskScore,
            riskFactors: evaluation.riskFactors,
            dataSource: evaluation.dataSource,
            dataConfidence: evaluation.dataConfidence,
            metrics: evaluation.metrics,
            validUntil,
          })
          .returning()
      )[0];

      // Update Order if orderId passed
      if (input.orderId) {
        await tx
          .update(orders)
          .set({
            riskLevel: evaluation.riskStatus,
            riskScore: evaluation.riskScore,
            updatedAt: new Date().toISOString(),
          })
          .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, tenantId)));
      }

      return record;
    });
  }

  /**
   * Records a manual review or override decision on an order.
   */
  async reviewOrderRisk(
    tenantId: string,
    actorId: string,
    orderId: string,
    input: ManualRiskReviewInput
  ) {
    return withSystem(async (tx) => {
      const order = (
        await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const updated = (
        await tx
          .update(orders)
          .set({
            riskDecision: input.decision,
            riskDecisionReason: input.decisionReason,
            riskDecidedBy: actorId,
            ...(input.decision === 'approved' && order.riskLevel === 'manual_review_required' && {
              riskLevel: 'low',
            }),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(orders.id, orderId))
          .returning()
      )[0];

      // Record in audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'risk.order_reviewed',
        entityType: 'order',
        entityId: orderId,
        before: { riskLevel: order.riskLevel },
        after: {
          decision: input.decision,
          reason: input.decisionReason,
        },
      });

      return updated;
    });
  }

  /**
   * Lists orders awaiting manual risk review.
   */
  async getReviewQueue(tenantId: string) {
    return withSystem(async (tx) => {
      return tx
        .select({
          order: orders,
          customer: {
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
          },
        })
        .from(orders)
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .where(
          and(
            eq(orders.tenantId, tenantId),
            or(eq(orders.riskLevel, 'high'), eq(orders.riskLevel, 'manual_review_required')),
            sql`${orders.riskDecision} IS NULL`
          )
        )
        .orderBy(desc(orders.createdAt));
    });
  }
}
