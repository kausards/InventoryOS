import { z } from 'zod';

export const DOCUMENT_TYPES = [
  'invoice',
  'packing_slip',
  'barcode_labels',
  'bulk_batch',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const PRINT_FORMATS = ['a4', 'thermal_80mm', 'sticker'] as const;
export type PrintFormat = (typeof PRINT_FORMATS)[number];

export const createPrintLogSchema = z.object({
  documentType: z.string().min(1),
  orderIds: z.array(z.string().uuid()).min(1),
  format: z.enum(PRINT_FORMATS).default('a4'),
  ipAddress: z.string().optional(),
});

export type CreatePrintLogInput = z.infer<typeof createPrintLogSchema>;

export const generateDocumentSignedUrlSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  referenceId: z.string().min(1),
  format: z.enum(PRINT_FORMATS).default('a4'),
  expiresInMinutes: z.number().int().min(1).max(1440).default(30), // Default 30 min
  lang: z.enum(['en', 'bn']).default('en'),
});

export type GenerateDocumentSignedUrlInput = z.infer<typeof generateDocumentSignedUrlSchema>;

export const verifySignedUrlSchema = z.object({
  token: z.string().min(1),
  expires: z.number().int(),
  tenantId: z.string().uuid(),
  documentType: z.string().min(1),
  referenceId: z.string().min(1),
  format: z.string().min(1),
});
