import { z } from 'zod';

export const connectStoreSchema = z.object({
  platform: z.enum(['woocommerce']).default('woocommerce'),
  storeName: z.string().min(2, 'Store name must be at least 2 characters').max(100),
  storeUrl: z.string().url('Must be a valid HTTP or HTTPS URL'),
  consumerKey: z.string().min(10, 'Consumer Key is required and must be valid'),
  consumerSecret: z.string().min(10, 'Consumer Secret is required and must be valid'),
  webhookSecret: z.string().optional(),
  defaultWarehouseId: z.string().uuid().optional(),
  syncOrders: z.boolean().default(true),
  pushStock: z.boolean().default(true),
});

export type ConnectStoreInput = z.infer<typeof connectStoreSchema>;

export const updateStoreSchema = z.object({
  storeName: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
  syncOrders: z.boolean().optional(),
  pushStock: z.boolean().optional(),
  defaultWarehouseId: z.string().uuid().nullable().optional(),
  consumerKey: z.string().min(10).optional(),
  consumerSecret: z.string().min(10).optional(),
  webhookSecret: z.string().optional(),
});

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;

export const mapProductVariantSchema = z.object({
  internalVariantId: z.string().uuid().nullable().optional(),
  mappingStatus: z.enum(['mapped', 'unmapped', 'ignored']).default('mapped'),
});

export type MapProductVariantInput = z.infer<typeof mapProductVariantSchema>;

export const batchMapProductsSchema = z.object({
  mappings: z.array(
    z.object({
      mappingId: z.string().uuid(),
      internalVariantId: z.string().uuid().nullable().optional(),
      mappingStatus: z.enum(['mapped', 'unmapped', 'ignored']),
    })
  ),
});

export type BatchMapProductsInput = z.infer<typeof batchMapProductsSchema>;

export const reconcileOrdersQuerySchema = z.object({
  days: z.coerce.number().min(1).max(90).default(7),
  force: z.boolean().default(false),
});

export type ReconcileOrdersQuery = z.infer<typeof reconcileOrdersQuerySchema>;

export const pushStockSchema = z.object({
  storeId: z.string().uuid().optional(),
  variantIds: z.array(z.string().uuid()).optional(),
});

export type PushStockInput = z.infer<typeof pushStockSchema>;
