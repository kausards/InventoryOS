import { pgTable, uuid, text, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { integrationStores } from './integration-stores';

export const integrationEvents = pgTable(
  'integration_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => integrationStores.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    externalEventId: text('external_event_id'),
    deduplicationKey: text('deduplication_key').notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: text('status').notNull().default('pending'), // 'pending' | 'processed' | 'failed' | 'ignored'
    errorMessage: text('error_message'),
    attempts: integer('attempts').notNull().default(0),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_integration_events_tenant_status').on(table.tenantId, table.status),
    index('idx_integration_events_store').on(table.tenantId, table.storeId),
    uniqueIndex('idx_integration_events_dedupe').on(table.tenantId, table.storeId, table.deduplicationKey),
  ]
);

export type IntegrationEvent = typeof integrationEvents.$inferSelect;
export type NewIntegrationEvent = typeof integrationEvents.$inferInsert;
