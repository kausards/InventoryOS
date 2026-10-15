import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const warehouses = pgTable(
  'warehouses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    code: text('code').notNull().default('WH-MAIN'),
    isDefault: boolean('is_default').notNull().default(false),
    address: text('address'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_warehouses_tenant').on(table.tenantId),
    uniqueIndex('idx_warehouses_tenant_code').on(table.tenantId, table.code),
  ]
);
