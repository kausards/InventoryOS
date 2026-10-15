import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { orders } from './orders';

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    actorType: text('actor_type').notNull(), // 'user' | 'system' | 'worker'
    actorId: uuid('actor_id'),
    reason: text('reason'),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_order_history_tenant').on(table.tenantId),
    index('idx_order_history_order').on(table.orderId),
    index('idx_order_history_created').on(table.createdAt),
  ]
);
