import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';

export const messageCreditLedgers = pgTable(
  'message_credit_ledgers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'top_up' | 'deduction' | 'refund' | 'adjustment'
    channel: text('channel').notNull(), // 'sms' | 'whatsapp' | 'system'
    amount: integer('amount').notNull(), // Positive for add/refund, negative for deduction
    balanceAfter: integer('balance_after').notNull(), // Running credit balance
    referenceId: text('reference_id'), // notificationId or paymentId
    description: text('description').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('idx_message_credits_tenant').on(table.tenantId),
    tenantChannelIdx: index('idx_message_credits_tenant_channel').on(table.tenantId, table.channel),
    createdIdx: index('idx_message_credits_created').on(table.tenantId, table.createdAt),
  })
);
