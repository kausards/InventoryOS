import { z } from 'zod';

export const FINANCIAL_TRANSACTION_TYPES = [
  'sale',
  'cogs',
  'courier_fee',
  'packaging_cost',
  'cod_fee',
  'return_cost',
  'expense',
  'refund',
  'adjustment',
  'payout',
] as const;
export type FinancialTransactionType = typeof FINANCIAL_TRANSACTION_TYPES[number];

export const TRANSACTION_DIRECTIONS = ['in', 'out'] as const;
export type TransactionDirection = typeof TRANSACTION_DIRECTIONS[number];

export const TRANSACTION_CATEGORIES = [
  'revenue',
  'cogs',
  'order_cost',
  'operating_expense',
  'settlement',
  'refund',
  'other',
] as const;
export type TransactionCategory = typeof TRANSACTION_CATEGORIES[number];

export const TRANSACTION_STATUSES = ['draft', 'posted', 'voided', 'reversed'] as const;
export type TransactionStatus = typeof TRANSACTION_STATUSES[number];

export const EXPENSE_CATEGORIES = [
  'rent',
  'utilities',
  'marketing',
  'packaging_supplies',
  'software',
  'salaries',
  'maintenance',
  'courier_equipment',
  'office',
  'other',
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const PAYMENT_METHODS = [
  'cash',
  'bank',
  'bkash',
  'nagad',
  'card',
  'cod_deduction',
] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const createFinancialTransactionSchema = z.object({
  type: z.enum(FINANCIAL_TRANSACTION_TYPES),
  direction: z.enum(TRANSACTION_DIRECTIONS),
  category: z.enum(TRANSACTION_CATEGORIES),
  amountMinor: z.coerce.bigint().positive('Amount must be positive in minor units (paisa)'),
  currency: z.string().default('BDT'),
  date: z.string().datetime().optional(),
  referenceType: z.enum(['order', 'return', 'shipment', 'expense', 'manual']).optional(),
  referenceId: z.string().optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  notes: z.string().max(500).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateFinancialTransactionInput = z.infer<typeof createFinancialTransactionSchema>;

export const reverseFinancialTransactionSchema = z.object({
  reason: z.string().min(5, 'Reversal reason must be at least 5 characters').max(300),
});
export type ReverseFinancialTransactionInput = z.infer<typeof reverseFinancialTransactionSchema>;

export const createExpenseSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(150),
  category: z.enum(EXPENSE_CATEGORIES),
  amountMinor: z.coerce.bigint().positive('Amount must be a positive integer in paisa'),
  currency: z.string().default('BDT'),
  date: z.string().datetime().optional(),
  description: z.string().max(1000).optional().nullable(),
  paymentStatus: z.enum(['paid', 'unpaid', 'partial']).default('paid'),
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
  receiptUrl: z.string().url().optional().nullable(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema.partial();
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const financialReportFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  type: z.enum(FINANCIAL_TRANSACTION_TYPES).optional(),
  category: z.enum(TRANSACTION_CATEGORIES).optional(),
  direction: z.enum(TRANSACTION_DIRECTIONS).optional(),
  referenceType: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});
export type FinancialReportFilter = z.infer<typeof financialReportFilterSchema>;
