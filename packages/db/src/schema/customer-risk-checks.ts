import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { customers } from './customers';
import { orders } from './orders';
import { users } from './users';

export const customerRiskChecks = pgTable(
  'customer_risk_checks',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    normalizedPhone: text('normalized_phone').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    riskStatus: text('risk_status').notNull(), // 'not_checked' | 'checking' | 'low' | 'medium' | 'high' | 'insufficient_data' | 'provider_unavailable' | 'manual_review_required'
    riskScore: integer('risk_score').notNull().default(0), // 0 to 100
    riskFactors: jsonb('risk_factors').notNull().default(sql`'[]'::jsonb`), // array of { factor: string, level: string, details: string }
    dataSource: text('data_source').notNull().default('internal_history'), // 'internal_history' | 'blacklist' | 'courier'
    dataConfidence: text('data_confidence').notNull().default('medium'), // 'low' | 'medium' | 'high'
    metrics: jsonb('metrics'), // { eligibleOrders, delivered, cancelled, returned, deliveryRate, cancelRate, returnRate }
    decision: text('decision'), // 'pending' | 'approved' | 'rejected' | 'overridden'
    decisionReason: text('decision_reason'),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'string' }),
    validUntil: timestamp('valid_until', { withTimezone: true, mode: 'string' }).notNull(), // caching TTL
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_customer_risk_checks_tenant').on(table.tenantId),
    index('idx_customer_risk_checks_tenant_phone').on(table.tenantId, table.normalizedPhone),
    index('idx_customer_risk_checks_tenant_status').on(table.tenantId, table.riskStatus),
    index('idx_customer_risk_checks_tenant_created').on(table.tenantId, table.createdAt),
  ]
);
