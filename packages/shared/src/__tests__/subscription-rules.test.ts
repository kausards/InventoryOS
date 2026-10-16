import { describe, it, expect } from 'vitest';
import {
  canTransitionSubscription,
  isRestrictedReadOnlyMode,
  checkResourceLimit,
} from '../subscription-rules';
import {
  manualPaymentSubmissionSchema,
  createPlanSchema,
} from '../schemas/subscriptions';

describe('Subscription Rules & Entitlement Enforcement (PRD Part X)', () => {
  describe('Subscription Lifecycle Transitions', () => {
    it('allows valid lifecycle transitions', () => {
      expect(canTransitionSubscription('trial', 'active')).toBe(true);
      expect(canTransitionSubscription('active', 'past_due')).toBe(true);
      expect(canTransitionSubscription('past_due', 'grace_period')).toBe(true);
      expect(canTransitionSubscription('grace_period', 'expired')).toBe(true);
      expect(canTransitionSubscription('expired', 'active')).toBe(true); // verified renewal
    });

    it('rejects invalid or unauthorized status jumps', () => {
      // Cannot jump from trial directly to suspended
      expect(canTransitionSubscription('trial', 'suspended')).toBe(false);
      // Cannot jump from active directly to trial
      expect(canTransitionSubscription('active', 'trial')).toBe(false);
    });
  });

  describe('Restricted Read-Only Mode (PRD X.4)', () => {
    it('returns true for expired, suspended, or cancelled subscriptions', () => {
      expect(isRestrictedReadOnlyMode('expired')).toBe(true);
      expect(isRestrictedReadOnlyMode('suspended')).toBe(true);
      expect(isRestrictedReadOnlyMode('cancelled')).toBe(true);
    });

    it('returns false for active and trial subscriptions', () => {
      expect(isRestrictedReadOnlyMode('active')).toBe(false);
      expect(isRestrictedReadOnlyMode('trial')).toBe(false);
    });

    it('respects grace period when status is past_due', () => {
      const futureGrace = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const pastGrace = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

      // Within grace period: read-only mode is not active yet
      expect(isRestrictedReadOnlyMode('past_due', futureGrace)).toBe(false);
      // Grace period expired: enters restricted read-only mode
      expect(isRestrictedReadOnlyMode('past_due', pastGrace)).toBe(true);
    });
  });

  describe('Resource Limit Enforcement & Grace Overage (PRD X.5)', () => {
    it('allows orders within normal limit', () => {
      const res = checkResourceLimit(50, 100, 'orders');
      expect(res.allowed).toBe(true);
      expect(res.isGraceOverage).toBe(false);
    });

    it('allows orders within +10% grace overage', () => {
      // 100 limit + 10% grace = 110 max effective limit
      const atLimit = checkResourceLimit(100, 100, 'orders');
      expect(atLimit.allowed).toBe(true);
      expect(atLimit.isGraceOverage).toBe(true);

      const inGrace = checkResourceLimit(105, 100, 'orders');
      expect(inGrace.allowed).toBe(true);
      expect(inGrace.isGraceOverage).toBe(true);
    });

    it('blocks orders when 10% grace overage is exceeded', () => {
      // 110 effective limit: 110 or higher is blocked
      const exceeded = checkResourceLimit(110, 100, 'orders');
      expect(exceeded.allowed).toBe(false);
      expect(exceeded.message).toContain('exceeded');
    });

    it('strictly enforces discrete limits (staff, stores, warehouses) without overage', () => {
      // Staff limit: 3
      const staffAllowed = checkResourceLimit(2, 3, 'staff');
      expect(staffAllowed.allowed).toBe(true);

      const staffBlocked = checkResourceLimit(3, 3, 'staff');
      expect(staffBlocked.allowed).toBe(false);
      expect(staffBlocked.message).toContain('limit of 3 reached');
    });
  });

  describe('Validation Schemas', () => {
    it('validates manual payment submission with valid TrxID and phone', () => {
      const parsed = manualPaymentSubmissionSchema.safeParse({
        planId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        billingCycle: 'monthly',
        paymentMethod: 'bkash',
        amountMinor: 250000n, // ৳2,500.00
        transactionId: 'TRX98273645',
        senderNumber: '01711223344',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects manual payment with negative amount or short transaction ID', () => {
      const parsed = manualPaymentSubmissionSchema.safeParse({
        planId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        billingCycle: 'monthly',
        paymentMethod: 'bkash',
        amountMinor: -100n,
        transactionId: '12', // too short
        senderNumber: '01711223344',
      });
      expect(parsed.success).toBe(false);
    });
  });
});
