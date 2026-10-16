import { pgTable, uuid, text, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { subscriptionPlans } from './subscription-plans';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id),
    status: text('status')
      .notNull()
      .default('trial'), // 'trial' | 'active' | 'payment_pending' | 'past_due' | 'grace_period' | 'cancelled' | 'expired' | 'suspended'
    billingCycle: text('billing_cycle')
      .notNull()
      .default('monthly'), // 'monthly' | 'annual'
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'string' })
      .notNull(),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true, mode: 'string' }),
    graceEndsAt: timestamp('grace_ends_at', { withTimezone: true, mode: 'string' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_subscriptions_tenant_unique').on(table.tenantId),
    index('idx_subscriptions_plan').on(table.planId),
    index('idx_subscriptions_status').on(table.status),
    index('idx_subscriptions_period_end').on(table.currentPeriodEnd),
  ]
);

export const subscriptionUsage = pgTable(
  'subscription_usage',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    periodStart: timestamp('period_start', { withTimezone: true, mode: 'string' })
      .notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true, mode: 'string' })
      .notNull(),
    ordersCount: integer('orders_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_subscription_usage_tenant_period').on(table.tenantId, table.periodStart, table.periodEnd),
    index('idx_subscription_usage_sub').on(table.subscriptionId),
  ]
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type SubscriptionUsage = typeof subscriptionUsage.$inferSelect;
export type NewSubscriptionUsage = typeof subscriptionUsage.$inferInsert;
