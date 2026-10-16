import { z } from 'zod';
import { normalizeBdPhone } from '../phone.js';
import { cleanImportCell } from '../csv-safety.js';

export const IMPORT_ENTITY_TYPES = ['products', 'customers', 'orders'] as const;
export type ImportEntityType = typeof IMPORT_ENTITY_TYPES[number];

export const importProductRowSchema = z.object({
  name: z.string().min(1, 'Product name is required').transform(cleanImportCell),
  sku: z.string().min(1, 'SKU is required').transform(cleanImportCell),
  category: z.string().optional().transform((v) => (v ? cleanImportCell(v) : undefined)),
  retailPrice: z.coerce.number().positive('Retail price must be positive'),
  purchaseCost: z.coerce.number().min(0).default(0),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  warehouseId: z.string().uuid().optional(),
});
export type ImportProductRow = z.infer<typeof importProductRowSchema>;

export const importCustomerRowSchema = z.object({
  name: z.string().min(1, 'Customer name is required').transform(cleanImportCell),
  phone: z.string().min(11, 'Phone must be at least 11 digits').transform((v) => {
    const cleaned = cleanImportCell(v);
    const normalized = normalizeBdPhone(cleaned);
    if (!normalized.isValid) throw new Error('Invalid Bangladeshi phone number');
    return normalized.e164;
  }),
  address: z.string().optional().transform((v) => (v ? cleanImportCell(v) : undefined)),
  division: z.string().default('Dhaka'),
  district: z.string().default('Dhaka'),
  upazilaThana: z.string().optional().transform((v) => (v ? cleanImportCell(v) : undefined)),
});
export type ImportCustomerRow = z.infer<typeof importCustomerRowSchema>;

export const importOrderRowSchema = z.object({
  orderNumber: z.string().optional().transform((v) => (v ? cleanImportCell(v) : undefined)),
  customerName: z.string().min(1, 'Customer name is required').transform(cleanImportCell),
  customerPhone: z.string().min(11, 'Phone is required').transform((v) => {
    const cleaned = cleanImportCell(v);
    const normalized = normalizeBdPhone(cleaned);
    if (!normalized.isValid) throw new Error('Invalid Bangladeshi phone number');
    return normalized.e164;
  }),
  sku: z.string().min(1, 'Product SKU is required').transform(cleanImportCell),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
  deliveryCharge: z.coerce.number().min(0).default(60),
  orderStatus: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).default('delivered'),
  paymentMethod: z.enum(['cod', 'bkash', 'nagad', 'bank']).default('cod'),
});
export type ImportOrderRow = z.infer<typeof importOrderRowSchema>;

export const dryRunImportSchema = z.object({
  entityType: z.enum(IMPORT_ENTITY_TYPES),
  fileName: z.string().max(100),
  rows: z.array(z.record(z.any())).min(1, 'At least 1 row required').max(2000, 'Maximum 2000 rows per batch'),
});
export type DryRunImportInput = z.infer<typeof dryRunImportSchema>;

export const commitImportSchema = z.object({
  entityType: z.enum(IMPORT_ENTITY_TYPES),
  fileName: z.string().max(100),
  rows: z.array(z.record(z.any())).min(1, 'At least 1 row required').max(2000, 'Maximum 2000 rows per batch'),
});
export type CommitImportInput = z.infer<typeof commitImportSchema>;

export const undoBatchSchema = z.object({
  batchId: z.string().uuid(),
});
export type UndoBatchInput = z.infer<typeof undoBatchSchema>;
