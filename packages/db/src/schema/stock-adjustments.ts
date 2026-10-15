import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { warehouses } from './warehouses';
import { productVariants } from './product-variants';
import { users } from './users';

export const stockAdjustments = pgTable(
  'stock_adjustments',
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
    systemQuantity: integer('system_quantity').notNull(),
    countedQuantity: integer('counted_quantity').notNull(),
    deltaQuantity: integer('delta_quantity').notNull(),
    reason: text('reason').notNull(), // 'damaged' | 'shrinkage' | 'stocktake' | 'correction' | 'other'
    note: text('note'),
    status: text('status').notNull().default('approved'), // 'pending' | 'approved' | 'rejected'
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_stock_adjustments_tenant').on(table.tenantId),
    index('idx_stock_adjustments_variant').on(table.variantId),
    index('idx_stock_adjustments_created').on(table.createdAt),
  ]
);
