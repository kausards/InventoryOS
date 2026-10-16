import { pgTable, uuid, text, bigint, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';

export const financialTransactions = pgTable(
  'financial_transactions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    transactionNumber: text('transaction_number').notNull(),
    type: text('type').notNull(), // 'sale' | 'cogs' | 'courier_fee' | 'packaging_cost' | 'cod_fee' | 'return_cost' | 'expense' | 'refund' | 'adjustment' | 'payout'
    direction: text('direction').notNull(), // 'in' | 'out'
    category: text('category').notNull(), // 'revenue' | 'cogs' | 'order_cost' | 'operating_expense' | 'settlement' | 'refund' | 'other'
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(), // positive integer in paisa
    currency: text('currency').notNull().default('BDT'),
    date: timestamp('date', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    referenceType: text('reference_type'), // 'order' | 'return' | 'shipment' | 'expense' | 'manual'
    referenceId: text('reference_id'),
    paymentMethod: text('payment_method'), // 'cash' | 'bank' | 'bkash' | 'nagad' | 'card' | 'cod_deduction'
    status: text('status').notNull().default('posted'), // 'draft' | 'posted' | 'voided' | 'reversed'
    accountId: uuid('account_id'), // nullable, future double-entry chart of accounts
    reversalOf: uuid('reversal_of').references((): AnyPgColumn => financialTransactions.id),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    approvedBy: uuid('approved_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_financial_transactions_tenant').on(table.tenantId),
    index('idx_financial_transactions_date').on(table.tenantId, table.date),
    index('idx_financial_transactions_ref').on(table.tenantId, table.referenceType, table.referenceId),
    index('idx_financial_transactions_category').on(table.tenantId, table.category),
    index('idx_financial_transactions_type').on(table.tenantId, table.type),
    index('idx_financial_transactions_status').on(table.tenantId, table.status),
    index('idx_financial_transactions_reversal').on(table.reversalOf),
  ]
);

export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type NewFinancialTransaction = typeof financialTransactions.$inferInsert;
