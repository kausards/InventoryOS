import { pgTable, uuid, text, timestamp, integer, bigint, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const customers = pgTable(
  'customers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    normalizedPhone: text('normalized_phone').notNull(),
    email: text('email'),
    notes: text('notes'),
    totalOrders: integer('total_orders').notNull().default(0),
    deliveredOrders: integer('delivered_orders').notNull().default(0),
    cancelledOrders: integer('cancelled_orders').notNull().default(0),
    returnedOrders: integer('returned_orders').notNull().default(0),
    totalSpentMinor: bigint('total_spent_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    currency: text('currency').notNull().default('BDT'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_customers_tenant').on(table.tenantId),
    index('idx_customers_tenant_phone').on(table.tenantId, table.normalizedPhone),
    index('idx_customers_tenant_created').on(table.tenantId, table.createdAt),
  ]
);
