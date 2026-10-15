import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { customers } from './customers';
import { users } from './users';

export const blacklistEntries = pgTable(
  'blacklist_entries',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    normalizedPhone: text('normalized_phone').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    type: text('type').notNull().default('blacklist'), // 'blacklist' | 'watchlist'
    reason: text('reason').notNull(),
    addedBy: uuid('added_by').references(() => users.id),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_blacklist_entries_tenant').on(table.tenantId),
    index('idx_blacklist_entries_tenant_phone').on(table.tenantId, table.normalizedPhone),
    index('idx_blacklist_entries_tenant_active').on(table.tenantId, table.isActive),
  ]
);
