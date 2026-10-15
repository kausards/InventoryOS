import { pgTable, uuid, text, integer, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { orders } from './orders';
import { products } from './products';
import { productVariants } from './product-variants';

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id),
    productName: text('product_name').notNull(),
    variantName: text('variant_name').notNull(),
    sku: text('sku').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'bigint' }).notNull(),
    totalPriceMinor: bigint('total_price_minor', { mode: 'bigint' }).notNull(),
    unitCostMinor: bigint('unit_cost_minor', { mode: 'bigint' }).notNull().default(sql`0`), // Historical cost snapshot
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_order_items_tenant').on(table.tenantId),
    index('idx_order_items_order').on(table.orderId),
    index('idx_order_items_variant').on(table.variantId),
  ]
);
