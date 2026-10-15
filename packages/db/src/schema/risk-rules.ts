import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';

export const riskRules = pgTable(
  'risk_rules',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    minEligibleOrders: integer('min_eligible_orders').notNull().default(3),
    cancellationThresholdPercent: integer('cancellation_threshold_percent').notNull().default(40),
    returnThresholdPercent: integer('return_threshold_percent').notNull().default(25),
    deliveryFailureThresholdPercent: integer('delivery_failure_threshold_percent').notNull().default(30),
    autoFlagHighRisk: boolean('auto_flag_high_risk').notNull().default(true),
    manualReviewRequiredForHighRisk: boolean('manual_review_required_for_high_risk').notNull().default(true),
    cacheDurationHours: integer('cache_duration_hours').notNull().default(24),
    updatedBy: uuid('updated_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_risk_rules_tenant').on(table.tenantId),
  ]
);

export const riskRuleHistory = pgTable(
  'risk_rule_history',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    rulesSnapshot: jsonb('rules_snapshot').notNull(),
    changedBy: uuid('changed_by').references(() => users.id),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_risk_rule_history_tenant').on(table.tenantId),
    index('idx_risk_rule_history_created').on(table.tenantId, table.createdAt),
  ]
);
