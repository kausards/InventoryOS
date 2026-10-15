import { z } from 'zod';
import { customerAddressInputSchema } from './customers.js';

export const orderItemInputSchema = z.object({
  variantId: z.string().uuid('Invalid variant ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'), // in minor units (paisa)
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createOrderCustomerInputSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  address: customerAddressInputSchema,
});

export const createOrderSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  customer: createOrderCustomerInputSchema.optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  source: z.enum([
    'manual',
    'social_facebook',
    'social_instagram',
    'social_whatsapp',
    'website_woocommerce',
    'import',
  ]).default('manual'),
  sourceReference: z.string().max(255).optional().nullable(),
  items: z.array(orderItemInputSchema).min(1, 'Order must contain at least one item'),
  discount: z.number().min(0).default(0), // in minor units
  deliveryCharge: z.number().min(0).default(0), // in minor units
  paymentMethod: z.enum(['cod', 'bkash', 'nagad', 'bank_transfer', 'card']).default('cod'),
  customerNotes: z.string().max(1000).optional().nullable(),
  internalNotes: z.string().max(1000).optional().nullable(),
  confirmImmediately: z.boolean().default(false),
}).refine(
  (data) => Boolean(data.customerId || data.customer),
  { message: 'Either customerId or customer details must be provided' }
);

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const transitionOrderStatusSchema = z.object({
  toStatus: z.enum([
    'pending',
    'confirmed',
    'on_hold',
    'processing',
    'ready_to_ship',
    'shipped',
    'delivered',
    'delivery_failed',
    'returned',
    'cancelled',
    'closed',
  ]),
  reason: z.string().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type TransitionOrderStatusInput = z.infer<typeof transitionOrderStatusSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(255),
  notes: z.string().max(1000).optional().nullable(),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const holdOrderSchema = z.object({
  reason: z.string().min(1, 'Hold reason is required').max(255),
  notes: z.string().max(1000).optional().nullable(),
});

export type HoldOrderInput = z.infer<typeof holdOrderSchema>;

export const bulkOrderActionSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'Must select at least one order'),
  action: z.enum(['confirm', 'hold', 'cancel']),
  reason: z.string().max(255).optional().nullable(),
});

export type BulkOrderActionInput = z.infer<typeof bulkOrderActionSchema>;
