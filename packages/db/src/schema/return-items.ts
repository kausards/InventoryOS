import { pgTable, uuid, text, integer, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { returns } from './returns';
import { orderItems } from './order-items';
import { productVariants } from './product-variants';

export const returnItems = pgTable(
  'return_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    returnId: uuid('return_id')
      .notNull()
      .references(() => returns.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .references(() => orderItems.id, { onDelete: 'set null' }),
    productVariantId: uuid('product_variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantity: integer('quantity').notNull().default(1),
    condition: text('condition').notNull().default('unknown'), // 'unknown' | 'intact' | 'damaged' | 'opened' | 'missing_parts'
    disposition: text('disposition').notNull().default('pending'), // 'pending' | 'restock' | 'damage_writeoff' | 'return_to_customer'
    exchangeVariantId: uuid('exchange_variant_id').references(() => productVariants.id),
    exchangeQuantity: integer('exchange_quantity').notNull().default(0),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    notes: text('notes'),
    inspectedAt: timestamp('inspected_at', { withTimezone: true, mode: 'string' }),
    restockedAt: timestamp('restocked_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_return_items_tenant').on(table.tenantId),
    index('idx_return_items_return').on(table.returnId),
    index('idx_return_items_variant').on(table.productVariantId),
    index('idx_return_items_disposition').on(table.disposition),
  ]
);
