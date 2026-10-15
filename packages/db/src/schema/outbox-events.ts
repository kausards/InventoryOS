import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending'), // pending | processing | done | failed
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_outbox_tenant_status_created').on(table.tenantId, table.status, table.createdAt),
  ]
);
