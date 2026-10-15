import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { customers } from './customers';

export const customerTags = pgTable(
  'customer_tags',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    color: text('color').notNull().default('#2563EB'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_customer_tags_tenant').on(table.tenantId),
    uniqueIndex('idx_customer_tags_tenant_name').on(table.tenantId, table.name),
  ]
);

export const customerTagAssignments = pgTable(
  'customer_tag_assignments',
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
    tagId: uuid('tag_id')
      .notNull()
      .references(() => customerTags.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_cust_tag_assign_tenant').on(table.tenantId),
    uniqueIndex('idx_cust_tag_assign_unique').on(table.tenantId, table.customerId, table.tagId),
  ]
);
