import { z } from 'zod';

export const SUBSCRIPTION_STATUSES = [
  'trial',
  'active',
  'payment_pending',
  'past_due',
  'grace_period',
  'cancelled',
  'expired',
  'suspended',
] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];

export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = typeof BILLING_CYCLES[number];

export const MANUAL_PAYMENT_METHODS = ['bkash', 'nagad', 'rocket', 'bank_transfer'] as const;
export type ManualPaymentMethod = typeof MANUAL_PAYMENT_METHODS[number];

export const PAYMENT_VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type PaymentVerificationStatus = typeof PAYMENT_VERIFICATION_STATUSES[number];

export const planEntitlementsSchema = z.object({
  maxMonthlyOrders: z.number().int().min(1).default(100),
  maxStores: z.number().int().min(1).default(1),
  maxStaff: z.number().int().min(1).default(2),
  maxWarehouses: z.number().int().min(1).default(1),
  maxCouriers: z.number().int().min(1).default(2),
  featureFlags: z.array(z.string()).default([]),
});
export type PlanEntitlements = z.infer<typeof planEntitlementsSchema>;

export const createPlanSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with dashes'),
  description: z.string().max(250).optional(),
  monthlyPriceMinor: z.coerce.bigint().min(0n, 'Price in paisa cannot be negative'),
  annualPriceMinor: z.coerce.bigint().min(0n, 'Annual price in paisa cannot be negative'),
  trialDays: z.number().int().min(0).max(90).default(14),
  entitlements: planEntitlementsSchema,
  isActive: z.boolean().default(true),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const manualPaymentSubmissionSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(BILLING_CYCLES).default('monthly'),
  paymentMethod: z.enum(MANUAL_PAYMENT_METHODS),
  amountMinor: z.coerce.bigint().positive('Payment amount must be positive in minor units (paisa)'),
  transactionId: z.string().min(4, 'Transaction ID must be at least 4 characters').max(64),
  senderNumber: z.string().min(11, 'Sender phone number must be at least 11 digits').max(20),
  receiptUrl: z.string().url().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
export type ManualPaymentSubmissionInput = z.infer<typeof manualPaymentSubmissionSchema>;

export const verifyPaymentSchema = z.object({
  decision: z.enum(['verified', 'rejected']),
  rejectionReason: z.string().max(300).optional().nullable(),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export const changePlanSchema = z.object({
  targetPlanId: z.string().uuid(),
  billingCycle: z.enum(BILLING_CYCLES).default('monthly'),
});
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
