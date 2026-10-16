import { pgTable, uuid, text, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { subscriptionPlans } from './subscription-plans';
import { subscriptions } from './subscriptions';
import { users } from './users';

export const manualPaymentSubmissions = pgTable(
  'manual_payment_submissions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id),
    billingCycle: text('billing_cycle').notNull().default('monthly'), // 'monthly' | 'annual'
    paymentMethod: text('payment_method').notNull(), // 'bkash' | 'nagad' | 'rocket' | 'bank_transfer'
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(), // positive integer in paisa
    transactionId: text('transaction_id').notNull(), // TrxID
    senderNumber: text('sender_number').notNull(),
    receiptUrl: text('receipt_url'),
    notes: text('notes'),
    status: text('status').notNull().default('pending'), // 'pending' | 'verified' | 'rejected'
    verifiedBy: uuid('verified_by').references(() => users.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'string' }),
    rejectionReason: text('rejection_reason'),
    submittedBy: uuid('submitted_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_manual_payments_tenant').on(table.tenantId),
    index('idx_manual_payments_status').on(table.status),
    index('idx_manual_payments_trx').on(table.transactionId),
  ]
);

export const billingInvoices = pgTable(
  'billing_invoices',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    invoiceNumber: text('invoice_number').notNull(), // 'INV-SUB-202610-0001'
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    planName: text('plan_name').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull().default('BDT'),
    billingPeriodStart: timestamp('billing_period_start', { withTimezone: true, mode: 'string' }).notNull(),
    billingPeriodEnd: timestamp('billing_period_end', { withTimezone: true, mode: 'string' }).notNull(),
    paymentStatus: text('payment_status').notNull().default('paid'), // 'paid' | 'unpaid' | 'void'
    paymentMethod: text('payment_method'),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'string' }),
    invoiceUrl: text('invoice_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_billing_invoices_tenant').on(table.tenantId),
    index('idx_billing_invoices_number').on(table.invoiceNumber),
    index('idx_billing_invoices_status').on(table.paymentStatus),
  ]
);

export type ManualPaymentSubmission = typeof manualPaymentSubmissions.$inferSelect;
export type NewManualPaymentSubmission = typeof manualPaymentSubmissions.$inferInsert;
export type BillingInvoice = typeof billingInvoices.$inferSelect;
export type NewBillingInvoice = typeof billingInvoices.$inferInsert;
