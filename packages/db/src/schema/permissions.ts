import { pgTable, text, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { roles } from './roles';

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  description: text('description').notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionKey] }),
  ]
);
