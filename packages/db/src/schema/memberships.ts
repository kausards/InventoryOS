import { pgTable, uuid, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { roles } from './roles';

export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('unq_tenant_user').on(table.tenantId, table.userId),
    index('idx_memberships_tenant_user').on(table.tenantId, table.userId),
    index('idx_memberships_tenant_status').on(table.tenantId, table.status),
  ]
);
