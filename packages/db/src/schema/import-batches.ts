import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';

export const importBatches = pgTable(
  'import_batches',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // 'products' | 'customers' | 'orders'
    fileName: text('file_name').notNull(),
    totalRows: integer('total_rows').notNull(),
    successfulRows: integer('successful_rows').notNull(),
    failedRows: integer('failed_rows').notNull().default(0),
    status: text('status').notNull().default('completed'), // 'completed' | 'reverted'
    importedIds: jsonb('imported_ids').notNull().default(sql`'[]'::jsonb`),
    errors: jsonb('errors'),
    revertedAt: timestamp('reverted_at', { withTimezone: true, mode: 'string' }),
    revertedBy: uuid('reverted_by').references(() => users.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_import_batches_tenant').on(table.tenantId),
    index('idx_import_batches_status').on(table.tenantId, table.status),
    index('idx_import_batches_created').on(table.tenantId, table.createdAt),
  ]
);

export type ImportBatch = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
