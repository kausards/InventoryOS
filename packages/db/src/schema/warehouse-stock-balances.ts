import { pgTable, uuid, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { warehouses } from './warehouses';
import { productVariants } from './product-variants';

export const warehouseStockBalances = pgTable(
  'warehouse_stock_balances',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id),
    onHand: integer('on_hand').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    available: integer('available').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_stock_balances_tenant').on(table.tenantId),
    uniqueIndex('idx_stock_balances_unique').on(table.tenantId, table.warehouseId, table.variantId),
    index('idx_stock_balances_variant').on(table.variantId),
  ]
);
