import { pgTable, uuid, text, bigint, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { orders } from './orders';
import { courierAccounts } from './courier-accounts';

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    courierAccountId: uuid('courier_account_id')
      .notNull()
      .references(() => courierAccounts.id),
    courierCode: text('courier_code').notNull(), // 'steadfast' | 'pathao' | 'redx'
    consignmentId: text('consignment_id'),
    trackingCode: text('tracking_code'),
    operationId: uuid('operation_id')
      .notNull()
      .default(sql`gen_random_uuid()`),
    shipmentStatus: text('shipment_status')
      .notNull()
      .default('pending'), // 'draft' | 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'partially_delivered' | 'cancelled' | 'returned' | 'failed' | 'unknown_pending_reconciliation'
    recipientName: text('recipient_name').notNull(),
    recipientPhone: text('recipient_phone').notNull(),
    recipientAddress: text('recipient_address').notNull(),
    recipientDivision: text('recipient_division'),
    recipientDistrict: text('recipient_district'),
    codAmountMinor: bigint('cod_amount_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    deliveryChargeMinor: bigint('delivery_charge_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    codFeeMinor: bigint('cod_fee_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    returnFeeMinor: bigint('return_fee_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    actualSettledMinor: bigint('actual_settled_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    instructions: text('instructions'),
    rawResponse: jsonb('raw_response'),
    shippedAt: timestamp('shipped_at', { withTimezone: true, mode: 'string' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'string' }),
    returnedAt: timestamp('returned_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_shipments_tenant').on(table.tenantId),
    index('idx_shipments_order').on(table.tenantId, table.orderId),
    index('idx_shipments_tracking').on(table.tenantId, table.trackingCode),
    uniqueIndex('idx_shipments_order_courier_uniq').on(table.tenantId, table.orderId, table.courierCode),
    uniqueIndex('idx_shipments_operation_id_uniq').on(table.tenantId, table.operationId),
  ]
);
