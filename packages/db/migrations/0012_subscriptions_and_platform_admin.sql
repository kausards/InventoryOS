-- 0012_subscriptions_and_platform_admin.sql
-- M10: Subscriptions, Entitlements & Platform Admin

-- 1. Subscription Plans table (Global catalog)
CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "description" text,
  "monthly_price_minor" bigint NOT NULL DEFAULT 0,
  "annual_price_minor" bigint NOT NULL DEFAULT 0,
  "trial_days" integer NOT NULL DEFAULT 14,
  "is_active" boolean NOT NULL DEFAULT true,
  "entitlements" jsonb NOT NULL DEFAULT '{"maxMonthlyOrders": 100, "maxStores": 1, "maxStaff": 2, "maxWarehouses": 1, "maxCouriers": 2, "featureFlags": []}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_subscription_plans_slug" ON "subscription_plans" ("slug");
CREATE INDEX IF NOT EXISTS "idx_subscription_plans_active" ON "subscription_plans" ("is_active");

-- 2. Tenant Subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "plan_id" uuid NOT NULL REFERENCES "subscription_plans"("id"),
  "status" text NOT NULL DEFAULT 'trial',
  "billing_cycle" text NOT NULL DEFAULT 'monthly',
  "current_period_start" timestamp with time zone DEFAULT now() NOT NULL,
  "current_period_end" timestamp with time zone NOT NULL,
  "trial_ends_at" timestamp with time zone,
  "grace_ends_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_subscriptions_tenant_unique" ON "subscriptions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_plan" ON "subscriptions" ("plan_id");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "subscriptions" ("status");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_period_end" ON "subscriptions" ("current_period_end");

-- 3. Subscription Usage table
CREATE TABLE IF NOT EXISTS "subscription_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "subscription_id" uuid NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "orders_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_subscription_usage_tenant_period" ON "subscription_usage" ("tenant_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "idx_subscription_usage_sub" ON "subscription_usage" ("subscription_id");

-- 4. Manual Payment Submissions table
CREATE TABLE IF NOT EXISTS "manual_payment_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "plan_id" uuid NOT NULL REFERENCES "subscription_plans"("id"),
  "billing_cycle" text NOT NULL DEFAULT 'monthly',
  "payment_method" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "transaction_id" text NOT NULL,
  "sender_number" text NOT NULL,
  "receipt_url" text,
  "notes" text,
  "status" text NOT NULL DEFAULT 'pending',
  "verified_by" uuid REFERENCES "users"("id"),
  "verified_at" timestamp with time zone,
  "rejection_reason" text,
  "submitted_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_manual_payments_tenant" ON "manual_payment_submissions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_manual_payments_status" ON "manual_payment_submissions" ("status");
CREATE INDEX IF NOT EXISTS "idx_manual_payments_trx" ON "manual_payment_submissions" ("transaction_id");

-- 5. Billing Invoices table
CREATE TABLE IF NOT EXISTS "billing_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "invoice_number" text NOT NULL,
  "subscription_id" uuid REFERENCES "subscriptions"("id"),
  "plan_name" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'BDT',
  "billing_period_start" timestamp with time zone NOT NULL,
  "billing_period_end" timestamp with time zone NOT NULL,
  "payment_status" text NOT NULL DEFAULT 'paid',
  "payment_method" text,
  "paid_at" timestamp with time zone,
  "invoice_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_billing_invoices_tenant" ON "billing_invoices" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_billing_invoices_number" ON "billing_invoices" ("invoice_number");
CREATE INDEX IF NOT EXISTS "idx_billing_invoices_status" ON "billing_invoices" ("payment_status");

-- 6. Seed Default Subscription Plans if table empty
INSERT INTO "subscription_plans" ("name", "slug", "description", "monthly_price_minor", "annual_price_minor", "trial_days", "entitlements")
VALUES
  (
    'Starter',
    'starter',
    'For small online businesses starting their journey in Bangladesh',
    99900,
    999000,
    14,
    '{"maxMonthlyOrders": 500, "maxStores": 1, "maxStaff": 2, "maxWarehouses": 1, "maxCouriers": 2, "featureFlags": ["basic_reports"]}'::jsonb
  ),
  (
    'Growth',
    'growth',
    'For rapidly growing multi-channel e-commerce brands',
    249900,
    2499000,
    14,
    '{"maxMonthlyOrders": 2500, "maxStores": 3, "maxStaff": 5, "maxWarehouses": 2, "maxCouriers": 5, "featureFlags": ["basic_reports", "ai_module", "custom_api"]}'::jsonb
  ),
  (
    'Pro',
    'pro',
    'For high-volume retail operations requiring scale and custom workflows',
    499900,
    4999000,
    14,
    '{"maxMonthlyOrders": 10000, "maxStores": 10, "maxStaff": 15, "maxWarehouses": 5, "maxCouriers": 10, "featureFlags": ["basic_reports", "ai_module", "custom_api", "advanced_analytics", "priority_support"]}'::jsonb
  ),
  (
    'Enterprise',
    'enterprise',
    'Unlimited scale, multi-warehouse routing, and dedicated SLA support',
    999900,
    9999000,
    14,
    '{"maxMonthlyOrders": 50000, "maxStores": 50, "maxStaff": 50, "maxWarehouses": 20, "maxCouriers": 50, "featureFlags": ["basic_reports", "ai_module", "custom_api", "advanced_analytics", "priority_support", "dedicated_manager"]}'::jsonb
  )
ON CONFLICT ("slug") DO NOTHING;

-- 7. Enable and Force Row Level Security on tenant tables
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "subscription_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_usage" FORCE ROW LEVEL SECURITY;

ALTER TABLE "manual_payment_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "manual_payment_submissions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "billing_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_invoices" FORCE ROW LEVEL SECURITY;

-- 8. App Role Grants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT ON "subscription_plans" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "subscriptions" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_usage" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "manual_payment_submissions" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "billing_invoices" TO growthomic_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_platform_admin') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_plans" TO growthomic_platform_admin;
    GRANT SELECT, UPDATE ON "manual_payment_submissions" TO growthomic_platform_admin;
    GRANT SELECT ON "subscriptions", "subscription_usage", "billing_invoices" TO growthomic_platform_admin;
  END IF;
END $$;

-- 9. RLS Policies
CREATE POLICY "subscriptions_select" ON "subscriptions" FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "subscriptions_insert" ON "subscriptions" FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "subscriptions_update" ON "subscriptions" FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "subscription_usage_select" ON "subscription_usage" FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "subscription_usage_insert" ON "subscription_usage" FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "subscription_usage_update" ON "subscription_usage" FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "manual_payments_select" ON "manual_payment_submissions" FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "manual_payments_insert" ON "manual_payment_submissions" FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "manual_payments_update" ON "manual_payment_submissions" FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "billing_invoices_select" ON "billing_invoices" FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "billing_invoices_insert" ON "billing_invoices" FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "billing_invoices_update" ON "billing_invoices" FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');
