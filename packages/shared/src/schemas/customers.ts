import { z } from 'zod';

export const customerAddressInputSchema = z.object({
  label: z.string().default('Home'),
  division: z.string().min(1, 'Division is required'),
  district: z.string().min(1, 'District is required'),
  upazilaThana: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  streetAddress: z.string().min(1, 'Street address is required'),
  isDefault: z.boolean().default(false),
});

export type CustomerAddressInput = z.infer<typeof customerAddressInputSchema>;

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(100),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  address: customerAddressInputSchema.optional().nullable(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const createCustomerTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').default('#2563EB'),
});

export type CreateCustomerTagInput = z.infer<typeof createCustomerTagSchema>;
