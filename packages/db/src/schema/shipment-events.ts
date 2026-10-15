import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { shipments } from './shipments';

export const shipmentEvents = pgTable(
  'shipment_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    providerStatus: text('provider_status').notNull(),
    normalizedStatus: text('normalized_status').notNull(),
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    location: text('location'),
    note: text('note'),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_shipment_events_tenant_shipment').on(table.tenantId, table.shipmentId),
    index('idx_shipment_events_timestamp').on(table.tenantId, table.eventTimestamp),
  ]
);
