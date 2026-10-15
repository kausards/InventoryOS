import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { categories } from './categories';
import { brands } from './brands';

export const products = pgTable(
  'products',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    type: text('type').notNull().default('standard'), // 'standard' | 'bundle'
    categoryId: uuid('category_id').references(() => categories.id),
    brandId: uuid('brand_id').references(() => brands.id),
    status: text('status').notNull().default('active'), // 'active' | 'draft' | 'archived'
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_products_tenant').on(table.tenantId),
    uniqueIndex('idx_products_tenant_slug').on(table.tenantId, table.slug),
    index('idx_products_tenant_status').on(table.tenantId, table.status),
    index('idx_products_category').on(table.categoryId),
  ]
);
