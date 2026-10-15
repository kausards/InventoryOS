import { pgTable, uuid, text, timestamp, bigint, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { products } from './products';

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    barcode: text('barcode'),
    name: text('name').notNull(),
    options: jsonb('options').$type<Record<string, string>>().default({}),
    retailPrice: bigint('retail_price', { mode: 'bigint' }).notNull(),
    wholesalePrice: bigint('wholesale_price', { mode: 'bigint' }),
    purchaseCost: bigint('purchase_cost', { mode: 'bigint' }).notNull().default(sql`0::bigint`),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    weightGrams: integer('weight_grams').notNull().default(0),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_product_variants_tenant').on(table.tenantId),
    index('idx_product_variants_product').on(table.productId),
    uniqueIndex('idx_product_variants_tenant_sku').on(table.tenantId, table.sku),
    index('idx_product_variants_tenant_barcode').on(table.tenantId, table.barcode),
  ]
);
