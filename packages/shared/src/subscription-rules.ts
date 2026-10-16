import type { SubscriptionStatus } from './schemas/subscriptions.js';

/**
 * Valid state transitions for subscription lifecycle
 */
export const VALID_SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trial: ['active', 'past_due', 'grace_period', 'cancelled', 'expired'],
  active: ['past_due', 'grace_period', 'cancelled', 'suspended'],
  payment_pending: ['active', 'past_due', 'cancelled'],
  past_due: ['active', 'grace_period', 'cancelled', 'expired'],
  grace_period: ['active', 'expired', 'cancelled'],
  cancelled: ['active', 'expired'],
  expired: ['active', 'trial'],
  suspended: ['active', 'expired'],
};

export function canTransitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_SUBSCRIPTION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Determines whether the tenant is in Restricted Read-Only Mode (PRD X.4).
 * In this mode, GET/view/export is allowed, but mutating operations (POST/PUT/DELETE) are blocked.
 */
export function isRestrictedReadOnlyMode(
  status: SubscriptionStatus,
  graceEndsAt?: string | Date | null
): boolean {
  if (status === 'expired' || status === 'suspended' || status === 'cancelled') {
    return true;
  }

  if (status === 'past_due') {
    if (!graceEndsAt) return true;
    const graceDate = new Date(graceEndsAt);
    return new Date() > graceDate;
  }

  return false;
}

export interface ResourceLimitCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  effectiveLimit: number;
  isGraceOverage: boolean;
  message?: string;
}

/**
 * Checks resource limits against plan entitlements (PRD X.5).
 * For monthly orders, allows a configurable +10% grace overage before hard blocking.
 */
export function checkResourceLimit(
  currentUsage: number,
  limit: number,
  resourceType: 'orders' | 'stores' | 'staff' | 'warehouses' | 'couriers'
): ResourceLimitCheckResult {
  // Negative or zero limit represents unlimited
  if (limit <= 0) {
    return {
      allowed: true,
      currentUsage,
      limit: Infinity,
      effectiveLimit: Infinity,
      isGraceOverage: false,
    };
  }

  if (resourceType === 'orders') {
    // 10% grace overage for orders per PRD X.5
    const graceBonus = Math.floor(limit * 0.1);
    const effectiveLimit = limit + Math.max(1, graceBonus);

    if (currentUsage >= effectiveLimit) {
      return {
        allowed: false,
        currentUsage,
        limit,
        effectiveLimit,
        isGraceOverage: true,
        message: `Monthly order limit of ${limit} (plus 10% grace: ${effectiveLimit}) exceeded. Upgrade your plan to create more orders.`,
      };
    }

    return {
      allowed: true,
      currentUsage,
      limit,
      effectiveLimit,
      isGraceOverage: currentUsage >= limit,
    };
  }

  // Discrete entities (staff, stores, warehouses) have strict limit
  if (currentUsage >= limit) {
    return {
      allowed: false,
      currentUsage,
      limit,
      effectiveLimit: limit,
      isGraceOverage: false,
      message: `Maximum ${resourceType} limit of ${limit} reached for your plan.`,
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit,
    effectiveLimit: limit,
    isGraceOverage: false,
  };
}
