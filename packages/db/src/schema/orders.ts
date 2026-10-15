import { pgTable, uuid, text, integer, bigint, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { customers } from './customers';
import { warehouses } from './warehouses';
import { users } from './users';
import { integrationStores } from './integration-stores';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderNumber: text('order_number').notNull(),
    orderSequence: integer('order_sequence').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    storeId: uuid('store_id').references(() => integrationStores.id, { onDelete: 'set null' }),
    externalOrderId: text('external_order_id'),
    source: text('source').notNull().default('manual'), // 'manual' | 'social_facebook' | 'social_instagram' | 'social_whatsapp' | 'website_woocommerce' | 'import'
    sourceReference: text('source_reference'), // chat link, external order id, campaign
    orderStatus: text('order_status').notNull().default('pending'), // 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'on_hold' | 'returned' | 'closed'
    paymentStatus: text('payment_status').notNull().default('unpaid'), // 'unpaid' | 'partially_paid' | 'paid' | 'refunded'
    shipmentStatus: text('shipment_status').notNull().default('unfulfilled'), // 'unfulfilled' | 'preparing' | 'in_transit' | 'delivered' | 'failed' | 'returned'
    subtotalMinor: bigint('subtotal_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    discountMinor: bigint('discount_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    deliveryChargeMinor: bigint('delivery_charge_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    totalAmountMinor: bigint('total_amount_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    currency: text('currency').notNull().default('BDT'),
    paymentMethod: text('payment_method').notNull().default('cod'), // 'cod' | 'bkash' | 'nagad' | 'bank_transfer' | 'card'
    customerNotes: text('customer_notes'),
    internalNotes: text('internal_notes'),
    holdReason: text('hold_reason'),
    cancelReason: text('cancel_reason'),
    isDuplicateWarning: boolean('is_duplicate_warning').notNull().default(false),
    duplicateOfOrderId: uuid('duplicate_of_order_id'),
    assignedStaffId: uuid('assigned_staff_id').references(() => users.id),
    riskLevel: text('risk_level').notNull().default('not_checked'), // 'not_checked' | 'checking' | 'low' | 'medium' | 'high' | 'insufficient_data' | 'provider_unavailable' | 'manual_review_required'
    riskScore: integer('risk_score'),
    riskDecision: text('risk_decision'), // 'pending' | 'approved' | 'rejected' | 'overridden'
    riskDecidedBy: uuid('risk_decided_by').references(() => users.id),
    riskDecisionReason: text('risk_decision_reason'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'string' }),
    shippedAt: timestamp('shipped_at', { withTimezone: true, mode: 'string' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'string' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_orders_tenant').on(table.tenantId),
    uniqueIndex('idx_orders_tenant_number').on(table.tenantId, table.orderNumber),
    index('idx_orders_tenant_status').on(table.tenantId, table.orderStatus),
    index('idx_orders_tenant_customer').on(table.tenantId, table.customerId),
    index('idx_orders_tenant_created').on(table.tenantId, table.createdAt),
    index('idx_orders_tenant_source').on(table.tenantId, table.source),
    index('idx_orders_tenant_risk').on(table.tenantId, table.riskLevel),
    index('idx_orders_store').on(table.tenantId, table.storeId),
    uniqueIndex('idx_orders_tenant_store_external').on(table.tenantId, table.storeId, table.externalOrderId),
  ]
);

export const orderSequences = pgTable(
  'order_sequences',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id),
    prefix: text('prefix').notNull().default('ORD-'),
    lastNumber: integer('last_number').notNull().default(1000),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  }
);
