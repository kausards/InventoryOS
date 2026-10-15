import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';

export const documents = pgTable(
  'documents',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    documentType: text('document_type').notNull(), // 'invoice' | 'packing_slip' | 'barcode_labels' | 'bulk_batch'
    title: text('title').notNull(),
    referenceId: text('reference_id'), // e.g. orderId or batchId
    storagePath: text('storage_path').notNull(), // private storage path
    fileSize: integer('file_size'),
    mimeType: text('mime_type').notNull().default('application/pdf'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (table) => [
    index('idx_documents_tenant').on(table.tenantId),
    index('idx_documents_tenant_type').on(table.tenantId, table.documentType),
    index('idx_documents_tenant_ref').on(table.tenantId, table.referenceId),
  ]
);
