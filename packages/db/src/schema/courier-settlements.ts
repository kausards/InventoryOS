import { pgTable, uuid, text, bigint, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { courierAccounts } from './courier-accounts';
import { shipments } from './shipments';
import { orders } from './orders';

export const courierSettlements = pgTable(
  'courier_settlements',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    courierAccountId: uuid('courier_account_id')
      .notNull()
      .references(() => courierAccounts.id),
    statementReference: text('statement_reference').notNull(),
    statementDate: timestamp('statement_date', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    totalExpectedCodMinor: bigint('total_expected_cod_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    totalSettledMinor: bigint('total_settled_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    totalFeeDeductedMinor: bigint('total_fee_deducted_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    settlementStatus: text('settlement_status')
      .notNull()
      .default('pending'), // 'pending' | 'partially_settled' | 'settled' | 'disputed' | 'reconciled'
    importedAt: timestamp('imported_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    importedBy: uuid('imported_by').references(() => users.id),
    rawStatement: jsonb('raw_statement'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_courier_settlements_tenant').on(table.tenantId),
    index('idx_courier_settlements_reference').on(table.tenantId, table.statementReference),
  ]
);

export const courierSettlementAllocations = pgTable(
  'courier_settlement_allocations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => courierSettlements.id, { onDelete: 'cascade' }),
    shipmentId: uuid('shipment_id')
      .references(() => shipments.id),
    orderId: uuid('order_id')
      .references(() => orders.id),
    consignmentId: text('consignment_id'),
    codAmountMinor: bigint('cod_amount_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    courierFeeMinor: bigint('courier_fee_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    netSettledMinor: bigint('net_settled_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    disputeNote: text('dispute_note'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_settlement_alloc_tenant').on(table.tenantId),
    index('idx_settlement_alloc_settlement').on(table.tenantId, table.settlementId),
    index('idx_settlement_alloc_shipment').on(table.tenantId, table.shipmentId),
  ]
);
