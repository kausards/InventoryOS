import { z } from 'zod';

export const RETURN_TYPES = ['customer_return', 'courier_return_rto', 'exchange'] as const;
export type ReturnType = typeof RETURN_TYPES[number];

export const RETURN_STATUSES = [
  'requested',
  'approved',
  'received',
  'inspecting',
  'completed',
  'rejected',
  'cancelled',
] as const;
export type ReturnStatus = typeof RETURN_STATUSES[number];

export const RETURN_REASONS = [
  'defective',
  'wrong_item',
  'size_fit',
  'undelivered_rto',
  'mind_change',
  'other',
] as const;
export type ReturnReason = typeof RETURN_REASONS[number];

export const ITEM_CONDITIONS = [
  'unknown',
  'intact',
  'damaged',
  'opened',
  'missing_parts',
] as const;
export type ItemCondition = typeof ITEM_CONDITIONS[number];

export const ITEM_DISPOSITIONS = [
  'pending',
  'restock',
  'damage_writeoff',
  'return_to_customer',
] as const;
export type ItemDisposition = typeof ITEM_DISPOSITIONS[number];

export const REFUND_STATUSES = ['none', 'pending', 'refunded', 'failed'] as const;
export type RefundStatus = typeof REFUND_STATUSES[number];

export const createReturnItemSchema = z.object({
  orderItemId: z.string().uuid().optional().nullable(),
  productVariantId: z.string().uuid('Invalid product variant ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPriceMinor: z.number().int().min(0).default(0),
  exchangeVariantId: z.string().uuid().optional().nullable(),
  exchangeQuantity: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateReturnItemInput = z.infer<typeof createReturnItemSchema>;

export const createReturnSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  returnType: z.enum(RETURN_TYPES).default('customer_return'),
  reason: z.enum(RETURN_REASONS).default('other'),
  notes: z.string().max(1000).optional().nullable(),
  shippingCostMinor: z.number().int().min(0).default(0),
  customerDeliveryChargeRefunded: z.boolean().default(false),
  items: z.array(createReturnItemSchema).min(1, 'At least one item must be returned'),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;

export const inspectReturnItemSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  condition: z.enum(ITEM_CONDITIONS),
  disposition: z.enum(ITEM_DISPOSITIONS),
  exchangeVariantId: z.string().uuid().optional().nullable(),
  exchangeQuantity: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
});

export type InspectReturnItemInput = z.infer<typeof inspectReturnItemSchema>;

export const inspectReturnSchema = z.object({
  items: z.array(inspectReturnItemSchema).min(1, 'At least one inspected item required'),
  notes: z.string().max(1000).optional().nullable(),
});

export type InspectReturnInput = z.infer<typeof inspectReturnSchema>;

export const receiveReturnSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
});

export type ReceiveReturnInput = z.infer<typeof receiveReturnSchema>;

export const completeReturnSchema = z.object({
  refundAmountMinor: z.number().int().min(0).default(0),
  refundStatus: z.enum(REFUND_STATUSES).default('none'),
  customerDeliveryChargeRefunded: z.boolean().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

export type CompleteReturnInput = z.infer<typeof completeReturnSchema>;

export const returnReportFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  courierCode: z.string().optional(),
  district: z.string().optional(),
  warehouseId: z.string().uuid().optional(),
});

export type ReturnReportFilter = z.infer<typeof returnReportFilterSchema>;
