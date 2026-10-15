import { pgTable, uuid, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { products } from './products';
import { productVariants } from './product-variants';

export const productBundles = pgTable(
  'product_bundles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    bundleProductId: uuid('bundle_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    componentVariantId: uuid('component_variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_product_bundles_tenant').on(table.tenantId),
    index('idx_product_bundles_bundle').on(table.bundleProductId),
    uniqueIndex('idx_product_bundles_unique').on(table.bundleProductId, table.componentVariantId),
  ]
);
