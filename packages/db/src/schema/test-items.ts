import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

// !! THIS TABLE IS TEST-ONLY. DO NOT USE IN PRODUCTION CODE !!
// Exists solely to prove RLS works in M0.

export const testItems = pgTable(
  'test_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_test_items_tenant').on(table.tenantId),
  ]
);
