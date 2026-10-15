import { pgTable, uuid, text, boolean, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const roles = pgTable(
  'roles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id').references(() => tenants.id), // null = system role
    name: text('name').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
  },
  (table) => [
    index('idx_roles_tenant_id').on(table.tenantId),
  ]
);
