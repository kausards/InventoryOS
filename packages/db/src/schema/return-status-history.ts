import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { returns } from './returns';

export const returnStatusHistory = pgTable(
  'return_status_history',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    returnId: uuid('return_id')
      .notNull()
      .references(() => returns.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    actorType: text('actor_type').notNull(), // 'user' | 'system' | 'courier'
    actorId: uuid('actor_id'),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_return_history_tenant').on(table.tenantId),
    index('idx_return_history_return').on(table.returnId),
    index('idx_return_history_created').on(table.createdAt),
  ]
);
