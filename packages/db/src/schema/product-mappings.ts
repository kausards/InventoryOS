import { pgTable, uuid, text, integer, bigint, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { integrationStores } from './integration-stores';
import { productVariants } from './product-variants';

export const productMappings = pgTable(
  'product_mappings',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => integrationStores.id, { onDelete: 'cascade' }),
    externalProductId: text('external_product_id').notNull(),
    externalVariantId: text('external_variant_id').notNull().default(''),
    externalSku: text('external_sku'),
    externalName: text('external_name').notNull(),
    externalPriceMinor: bigint('external_price_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    externalStockQuantity: integer('external_stock_quantity'),
    internalVariantId: uuid('internal_variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    mappingStatus: text('mapping_status').notNull().default('unmapped'), // 'mapped' | 'unmapped' | 'ignored'
    lastPushedStock: integer('last_pushed_stock'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_product_mappings_tenant_store').on(table.tenantId, table.storeId),
    index('idx_product_mappings_internal_variant').on(table.tenantId, table.internalVariantId),
    uniqueIndex('idx_product_mappings_external_uniq').on(
      table.tenantId,
      table.storeId,
      table.externalProductId,
      table.externalVariantId
    ),
  ]
);

export type ProductMapping = typeof productMappings.$inferSelect;
export type NewProductMapping = typeof productMappings.$inferInsert;
