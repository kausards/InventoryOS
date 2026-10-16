import { z } from 'zod';
import { normalizeBdPhone } from '../phone.js';

export const storeProfileSchema = z.object({
  organizationName: z.string().min(2, 'Store name must be at least 2 characters'),
  phone: z.string().optional().transform((v) => {
    if (!v) return undefined;
    const res = normalizeBdPhone(v);
    return res.isValid ? res.e164 : v;
  }),
  streetAddress: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  facebookPage: z.string().optional().or(z.literal('')),
});
export type StoreProfileInput = z.infer<typeof storeProfileSchema>;

export const firstWarehouseSchema = z.object({
  name: z.string().min(2, 'Warehouse name is required'),
  streetAddress: z.string().min(3, 'Address is required'),
  division: z.string().default('Dhaka'),
  district: z.string().default('Dhaka'),
});
export type FirstWarehouseInput = z.infer<typeof firstWarehouseSchema>;

export const initialCourierSchema = z.object({
  courierName: z.enum(['steadfast', 'pathao']),
  apiKey: z.string().min(4, 'API Key is required'),
  secretKey: z.string().min(4, 'Secret Key is required'),
});
export type InitialCourierInput = z.infer<typeof initialCourierSchema>;

export const initialProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(2, 'SKU is required'),
  retailPrice: z.coerce.number().positive('Price must be positive'),
  stockQuantity: z.coerce.number().int().min(0).default(10),
});
export type InitialProductInput = z.infer<typeof initialProductSchema>;

export const saveOnboardingProgressSchema = z.object({
  step: z.number().int().min(1).max(5),
  storeProfile: storeProfileSchema.optional(),
  warehouse: firstWarehouseSchema.optional(),
  courier: initialCourierSchema.optional(),
  product: initialProductSchema.optional(),
  completed: z.boolean().default(false),
});
export type SaveOnboardingProgressInput = z.infer<typeof saveOnboardingProgressSchema>;
