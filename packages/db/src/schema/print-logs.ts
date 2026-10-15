import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';

export const printLogs = pgTable(
  'print_logs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    documentType: text('document_type').notNull(), // 'invoice_a4' | 'invoice_thermal' | 'packing_slip' | 'barcode_label' | 'bulk_invoice'
    orderIds: jsonb('order_ids').notNull(), // array of order UUIDs
    format: text('format').notNull().default('a4'), // 'a4' | 'thermal_80mm' | 'sticker'
    printedBy: uuid('printed_by').references(() => users.id),
    printedByName: text('printed_by_name'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_print_logs_tenant').on(table.tenantId),
    index('idx_print_logs_tenant_created').on(table.tenantId, table.createdAt),
    index('idx_print_logs_tenant_doc_type').on(table.tenantId, table.documentType),
  ]
);
