import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { warehouses } from './warehouses';

export const integrationStores = pgTable(
  'integration_stores',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull().default('woocommerce'),
    storeName: text('store_name').notNull(),
    storeUrl: text('store_url').notNull(),
    encryptedCredentials: text('encrypted_credentials').notNull(), // AES-256-GCM ciphertext
    isActive: boolean('is_active').notNull().default(true),
    syncOrders: boolean('sync_orders').notNull().default(true),
    pushStock: boolean('push_stock').notNull().default(true),
    defaultWarehouseId: uuid('default_warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
    lastOrderSyncedAt: timestamp('last_order_synced_at', { withTimezone: true, mode: 'string' }),
    lastStockPushedAt: timestamp('last_stock_pushed_at', { withTimezone: true, mode: 'string' }),
    healthStatus: text('health_status').notNull().default('healthy'), // 'healthy' | 'warning' | 'error' | 'disconnected'
    healthMessage: text('health_message'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_integration_stores_tenant').on(table.tenantId),
    index('idx_integration_stores_tenant_active').on(table.tenantId, table.isActive),
  ]
);

export type IntegrationStore = typeof integrationStores.$inferSelect;
export type NewIntegrationStore = typeof integrationStores.$inferInsert;
