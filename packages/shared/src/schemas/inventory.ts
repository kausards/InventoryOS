import { z } from 'zod';

export const stockAdjustmentSchema = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  countedQuantity: z.number().int().min(0),
  reason: z.enum(['damaged', 'shrinkage', 'stocktake', 'correction', 'other']),
  note: z.string().max(500).optional().nullable(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const stockReservationSchema = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1),
  referenceType: z.string().default('order'),
  referenceId: z.string(),
});

export type StockReservationInput = z.infer<typeof stockReservationSchema>;

export const stockReleaseSchema = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1),
  referenceType: z.string().default('order'),
  referenceId: z.string(),
});

export type StockReleaseInput = z.infer<typeof stockReleaseSchema>;

export const stockFulfillmentSchema = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1),
  referenceType: z.string().default('order'),
  referenceId: z.string(),
});

export type StockFulfillmentInput = z.infer<typeof stockFulfillmentSchema>;

// CSV Product Import Row Schema
export const csvProductRowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  retailPrice: z.number().min(0),
  purchaseCost: z.number().min(0).default(0),
  initialStock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
});

export type CsvProductRow = z.infer<typeof csvProductRowSchema>;

export const CSV_MAX_ROWS = 5000;
export const CSV_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const csvImportBatchSchema = z.object({
  rows: z
    .array(csvProductRowSchema)
    .min(1, 'CSV must contain at least 1 product row')
    .max(CSV_MAX_ROWS, `CSV batch cannot exceed ${CSV_MAX_ROWS} rows`),
});

export type CsvImportBatch = z.infer<typeof csvImportBatchSchema>;
