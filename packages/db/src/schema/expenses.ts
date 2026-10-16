import { pgTable, uuid, text, bigint, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    expenseNumber: text('expense_number').notNull(),
    title: text('title').notNull(),
    category: text('category').notNull(), // 'rent' | 'utilities' | 'marketing' | 'packaging_supplies' | 'software' | 'salaries' | 'maintenance' | 'courier_equipment' | 'office' | 'other'
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(), // positive integer in paisa
    currency: text('currency').notNull().default('BDT'),
    expenseDate: timestamp('expense_date', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    paymentStatus: text('payment_status').notNull().default('paid'), // 'paid' | 'unpaid' | 'partial'
    paymentMethod: text('payment_method').notNull().default('cash'), // 'cash' | 'bank' | 'bkash' | 'nagad' | 'card' | 'cod_deduction'
    receiptUrl: text('receipt_url'),
    description: text('description'),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurringRule: jsonb('recurring_rule'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    approvedBy: uuid('approved_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_expenses_tenant').on(table.tenantId),
    index('idx_expenses_date').on(table.tenantId, table.expenseDate),
    index('idx_expenses_category').on(table.tenantId, table.category),
    index('idx_expenses_status').on(table.tenantId, table.paymentStatus),
  ]
);

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
