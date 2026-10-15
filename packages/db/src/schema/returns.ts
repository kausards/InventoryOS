import { pgTable, uuid, text, bigint, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { orders } from './orders';
import { customers } from './customers';
import { warehouses } from './warehouses';
import { users } from './users';

export const returns = pgTable(
  'returns',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    returnNumber: text('return_number').notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    returnType: text('return_type').notNull().default('customer_return'), // 'customer_return' | 'courier_return_rto' | 'exchange'
    status: text('status').notNull().default('requested'), // 'requested' | 'approved' | 'received' | 'inspecting' | 'completed' | 'rejected' | 'cancelled'
    reason: text('reason').notNull().default('other'), // 'defective' | 'wrong_item' | 'size_fit' | 'undelivered_rto' | 'mind_change' | 'other'
    notes: text('notes'),
    shippingCostMinor: bigint('shipping_cost_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    customerDeliveryChargeRefunded: boolean('customer_delivery_charge_refunded').notNull().default(false),
    refundAmountMinor: bigint('refund_amount_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    refundStatus: text('refund_status').notNull().default('none'), // 'none' | 'pending' | 'refunded' | 'failed'
    exchangeOrderId: uuid('exchange_order_id').references(() => orders.id, { onDelete: 'set null' }),
    processedBy: uuid('processed_by').references(() => users.id),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_returns_tenant').on(table.tenantId),
    uniqueIndex('idx_returns_tenant_number').on(table.tenantId, table.returnNumber),
    index('idx_returns_tenant_order').on(table.tenantId, table.orderId),
    index('idx_returns_tenant_status').on(table.tenantId, table.status),
    index('idx_returns_tenant_type').on(table.tenantId, table.returnType),
  ]
);
