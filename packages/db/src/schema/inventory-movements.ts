import { pgTable, uuid, text, integer, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { warehouses } from './warehouses';
import { productVariants } from './product-variants';
import { users } from './users';

export const inventoryMovements = pgTable(
  'inventory_movements',
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
    type: text('type').notNull(), // 'opening' | 'purchase_receipt' | 'fulfillment_deduction' | 'reservation' | 'reservation_release' | 'customer_return_receipt' | 'supplier_return' | 'adjustment' | 'damaged' | 'transfer_out' | 'transfer_in'
    quantity: integer('quantity').notNull(), // signed integer (+ for addition, - for reduction)
    referenceType: text('reference_type'), // 'order' | 'adjustment' | 'purchase' | 'manual' | 'transfer'
    referenceId: text('reference_id'),
    reason: text('reason'),
    note: text('note'),
    unitCost: bigint('unit_cost', { mode: 'bigint' }).notNull().default(sql`0::bigint`),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_inventory_movements_tenant').on(table.tenantId),
    index('idx_inventory_movements_variant').on(table.variantId),
    index('idx_inventory_movements_warehouse').on(table.warehouseId),
    index('idx_inventory_movements_created').on(table.createdAt),
  ]
);
