-- 0010_notifications_and_credits.sql
-- M8: Notifications, Templates, Customer Consent & Message Credits Ledger

-- 1. Message Credit Ledgers table (Append-only)
CREATE TABLE IF NOT EXISTS "message_credit_ledgers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "type" text NOT NULL, -- 'top_up' | 'deduction' | 'refund' | 'adjustment'
  "channel" text NOT NULL, -- 'sms' | 'whatsapp' | 'system'
  "amount" integer NOT NULL, -- Positive for top_up/refund, negative for deduction
  "balance_after" integer NOT NULL,
  "reference_id" text,
  "description" text NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_message_credits_tenant" ON "message_credit_ledgers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_message_credits_tenant_channel" ON "message_credit_ledgers" ("tenant_id", "channel");
CREATE INDEX IF NOT EXISTS "idx_message_credits_created" ON "message_credit_ledgers" ("tenant_id", "created_at");

-- 2. Notification Templates table
CREATE TABLE IF NOT EXISTS "notification_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "trigger_event" text NOT NULL,
  "channel" text NOT NULL,
  "language" text NOT NULL DEFAULT 'bn',
  "content" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_notification_templates_tenant" ON "notification_templates" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_notification_templates_event" ON "notification_templates" ("tenant_id", "trigger_event", "channel");

-- 3. Notification Preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "channel_sms_enabled" boolean NOT NULL DEFAULT true,
  "channel_whatsapp_enabled" boolean NOT NULL DEFAULT true,
  "channel_email_enabled" boolean NOT NULL DEFAULT true,
  "channel_in_app_enabled" boolean NOT NULL DEFAULT true,
  "sms_provider" text NOT NULL DEFAULT 'elitbuzz',
  "sms_api_key" text,
  "sms_sender_id" text,
  "whatsapp_provider" text NOT NULL DEFAULT 'mock',
  "whatsapp_api_token" text,
  "whatsapp_phone_number_id" text,
  "events_config" jsonb DEFAULT '{"order_created": true, "order_confirmed": true, "order_shipped": true, "order_delivered": true}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_notification_preferences_tenant" ON "notification_preferences" ("tenant_id");

-- 4. Customer Consents table (Opt-in & Opt-out Tracking)
CREATE TABLE IF NOT EXISTS "customer_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "phone" text NOT NULL,
  "channel" text NOT NULL,
  "consent_status" text NOT NULL DEFAULT 'opted_in', -- 'opted_in' | 'opted_out'
  "opted_out_at" timestamp with time zone,
  "opt_out_reason" text,
  "source" text NOT NULL DEFAULT 'checkout',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_customer_consents_tenant" ON "customer_consents" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_consents_phone_channel" ON "customer_consents" ("tenant_id", "phone", "channel");

-- 5. Notifications table (Delivery Status Log & In-App Center)
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "recipient" text NOT NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "channel" text NOT NULL, -- 'in_app' | 'sms' | 'whatsapp' | 'email'
  "type" text NOT NULL DEFAULT 'customer_alert', -- 'customer_alert' | 'staff_alert' | 'system_alert'
  "template_id" uuid REFERENCES "notification_templates"("id") ON DELETE SET NULL,
  "title" text,
  "content" text NOT NULL,
  "status" text NOT NULL DEFAULT 'queued', -- 'queued' | 'sent' | 'delivered' | 'failed' | 'credit_exhausted' | 'opted_out'
  "credits_deducted" integer NOT NULL DEFAULT 0,
  "external_message_id" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "error_details" text,
  "read_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_notifications_tenant" ON "notifications" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_status" ON "notifications" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_channel" ON "notifications" ("tenant_id", "channel");
CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_created" ON "notifications" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_order" ON "notifications" ("tenant_id", "order_id");

-- 6. Enable and Force Row Level Security
ALTER TABLE "message_credit_ledgers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_credit_ledgers" FORCE ROW LEVEL SECURITY;

ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_templates" FORCE ROW LEVEL SECURITY;

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;

ALTER TABLE "customer_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_consents" FORCE ROW LEVEL SECURITY;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

-- 7. App Role Grants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "message_credit_ledgers" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "notification_templates" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "notification_preferences" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "customer_consents" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "notifications" TO growthomic_app;
  END IF;
END $$;

-- 8. RLS Policies for Tenant Isolation & System Bypass
CREATE POLICY "message_credit_ledgers_select" ON "message_credit_ledgers" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "message_credit_ledgers_insert" ON "message_credit_ledgers" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notification_templates_select" ON "notification_templates" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notification_templates_insert" ON "notification_templates" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notification_templates_update" ON "notification_templates" FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notification_templates_delete" ON "notification_templates" FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notification_preferences_select" ON "notification_preferences" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notification_preferences_insert" ON "notification_preferences" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notification_preferences_update" ON "notification_preferences" FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "customer_consents_select" ON "customer_consents" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "customer_consents_insert" ON "customer_consents" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "customer_consents_update" ON "customer_consents" FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notifications_select" ON "notifications" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notifications_insert" ON "notifications" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "notifications_update" ON "notifications" FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');
