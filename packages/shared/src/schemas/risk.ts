import { z } from 'zod';

export const RISK_LEVELS = [
  'not_checked',
  'checking',
  'low',
  'medium',
  'high',
  'insufficient_data',
  'provider_unavailable',
  'manual_review_required',
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export const BLACKLIST_TYPES = ['blacklist', 'watchlist'] as const;
export type BlacklistType = (typeof BLACKLIST_TYPES)[number];

export const RISK_DECISIONS = ['pending', 'approved', 'rejected', 'overridden'] as const;
export type RiskDecision = (typeof RISK_DECISIONS)[number];

export const updateRiskRulesSchema = z.object({
  minEligibleOrders: z.number().int().min(1).max(50).optional(),
  cancellationThresholdPercent: z.number().int().min(1).max(100).optional(),
  returnThresholdPercent: z.number().int().min(1).max(100).optional(),
  deliveryFailureThresholdPercent: z.number().int().min(1).max(100).optional(),
  autoFlagHighRisk: z.boolean().optional(),
  manualReviewRequiredForHighRisk: z.boolean().optional(),
  cacheDurationHours: z.number().int().min(1).max(720).optional(),
  reason: z.string().min(3).max(255).optional(), // Reason for changing rules (recorded in history)
});

export type UpdateRiskRulesInput = z.infer<typeof updateRiskRulesSchema>;

export const createBlacklistEntrySchema = z.object({
  phone: z.string().min(10, 'Valid phone number required'),
  customerId: z.string().uuid().optional(),
  type: z.enum(BLACKLIST_TYPES).default('blacklist'),
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
});

export type CreateBlacklistEntryInput = z.infer<typeof createBlacklistEntrySchema>;

export const updateBlacklistEntrySchema = z.object({
  type: z.enum(BLACKLIST_TYPES).optional(),
  reason: z.string().min(3).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateBlacklistEntryInput = z.infer<typeof updateBlacklistEntrySchema>;

export const manualRiskReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'overridden']),
  decisionReason: z.string().min(3, 'Mandatory decision reason is required'),
});

export type ManualRiskReviewInput = z.infer<typeof manualRiskReviewSchema>;

export const checkRiskInputSchema = z.object({
  phone: z.string().min(10),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  forceRefresh: z.boolean().optional().default(false),
});

export type CheckRiskInput = z.infer<typeof checkRiskInputSchema>;
