import { pgTable, uuid, text, integer, bigint, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(), // 'Starter', 'Growth', 'Pro', 'Enterprise'
    slug: text('slug').notNull().unique(), // 'starter', 'growth', 'pro', 'enterprise'
    description: text('description'),
    monthlyPriceMinor: bigint('monthly_price_minor', { mode: 'bigint' }).notNull().default(sql`0`), // in paisa
    annualPriceMinor: bigint('annual_price_minor', { mode: 'bigint' }).notNull().default(sql`0`), // in paisa
    trialDays: integer('trial_days').notNull().default(14),
    isActive: boolean('is_active').notNull().default(true),
    entitlements: jsonb('entitlements')
      .notNull()
      .default(
        sql`'{"maxMonthlyOrders": 100, "maxStores": 1, "maxStaff": 2, "maxWarehouses": 1, "maxCouriers": 2, "featureFlags": []}'::jsonb`
      ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_subscription_plans_slug').on(table.slug),
    index('idx_subscription_plans_active').on(table.isActive),
  ]
);

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
