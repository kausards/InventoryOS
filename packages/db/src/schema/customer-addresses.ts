import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { customers } from './customers';

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    label: text('label').notNull().default('Home'),
    division: text('division').notNull(),
    district: text('district').notNull(),
    upazilaThana: text('upazila_thana'),
    area: text('area'),
    streetAddress: text('street_address').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_customer_addresses_tenant').on(table.tenantId),
    index('idx_customer_addresses_customer').on(table.customerId),
  ]
);
