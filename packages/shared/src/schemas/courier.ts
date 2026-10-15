import { z } from 'zod';

export const createCourierAccountSchema = z.object({
  courierCode: z.enum(['steadfast', 'pathao', 'redx']),
  accountName: z.string().min(1, 'Account name is required'),
  apiKey: z.string().min(1, 'API key is required'),
  secretKey: z.string().min(1, 'Secret key is required'),
  senderName: z.string().optional(),
  senderPhone: z.string().optional(),
  senderAddress: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  testMode: z.boolean().optional().default(false),
});

export type CreateCourierAccountInput = z.infer<typeof createCourierAccountSchema>;

export const updateCourierAccountSchema = z.object({
  accountName: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  secretKey: z.string().min(1).optional(),
  senderName: z.string().optional(),
  senderPhone: z.string().optional(),
  senderAddress: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  testMode: z.boolean().optional(),
});

export type UpdateCourierAccountInput = z.infer<typeof updateCourierAccountSchema>;

export const sendToCourierSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  courierAccountId: z.string().uuid('Invalid courier account ID'),
  operationId: z.string().uuid('Invalid operation ID').optional(),
  notes: z.string().optional(),
});

export type SendToCourierInput = z.infer<typeof sendToCourierSchema>;

export const createSettlementSchema = z.object({
  courierAccountId: z.string().uuid('Invalid courier account ID'),
  statementReference: z.string().min(1, 'Statement reference is required'),
  statementDate: z.string().datetime().optional(),
  items: z.array(
    z.object({
      consignmentId: z.string().min(1, 'Consignment ID is required'),
      orderNumber: z.string().optional(),
      codAmount: z.number().nonnegative(),
      courierFee: z.number().nonnegative(),
      netSettled: z.number(),
      disputeNote: z.string().optional(),
    })
  ).min(1, 'At least one settlement item is required'),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
