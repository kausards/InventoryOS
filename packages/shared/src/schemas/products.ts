import { z } from 'zod';

export const createVariantInputSchema = z.object({
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional().nullable(),
  name: z.string().min(1).max(100),
  options: z.record(z.string()).default({}),
  retailPrice: z.number().int().min(0), // in minor units (paisa)
  wholesalePrice: z.number().int().min(0).optional().nullable(),
  purchaseCost: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  weightGrams: z.number().int().min(0).default(0),
  initialStock: z.number().int().min(0).default(0),
});

export type CreateVariantInput = z.infer<typeof createVariantInputSchema>;

export const bundleComponentSchema = z.object({
  componentVariantId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

export type BundleComponentInput = z.infer<typeof bundleComponentSchema>;

export const createProductSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(['standard', 'bundle']).default('standard'),
  categoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  variants: z.array(createVariantInputSchema).min(1),
  bundleComponents: z.array(bundleComponentSchema).optional().nullable(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const updateVariantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  barcode: z.string().max(50).optional().nullable(),
  retailPrice: z.number().int().min(0).optional(),
  wholesalePrice: z.number().int().min(0).optional().nullable(),
  purchaseCost: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  weightGrams: z.number().int().min(0).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
