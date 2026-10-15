-- 0006_printing_and_risk_engine.sql
-- M4: Risk Rules, Rule History, Blacklist Entries, Customer Risk Checks, Print Logs, Documents

-- 1. Alter Orders Table to Add Risk Engine Fields
ALTER TABLE "orders" 
  ADD COLUMN IF NOT EXISTS "risk_level" text NOT NULL DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS "risk_score" integer,
  ADD COLUMN IF NOT EXISTS "risk_decision" text,
  ADD COLUMN IF NOT EXISTS "risk_decided_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "risk_decision_reason" text;

CREATE INDEX IF NOT EXISTS "idx_orders_tenant_risk" ON "orders" ("tenant_id", "risk_level");

-- 2. Risk Rules (Tenant-configurable thresholds)
CREATE TABLE IF NOT EXISTS "risk_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "min_eligible_orders" integer NOT NULL DEFAULT 3,
  "cancellation_threshold_percent" integer NOT NULL DEFAULT 40,
  "return_threshold_percent" integer NOT NULL DEFAULT 25,
  "delivery_failure_threshold_percent" integer NOT NULL DEFAULT 30,
  "auto_flag_high_risk" boolean NOT NULL DEFAULT true,
  "manual_review_required_for_high_risk" boolean NOT NULL DEFAULT true,
  "cache_duration_hours" integer NOT NULL DEFAULT 24,
  "updated_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_risk_rules_tenant" ON "risk_rules" ("tenant_id");

-- 3. Risk Rule History (Audit trail of threshold/rule modifications)
CREATE TABLE IF NOT EXISTS "risk_rule_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "rules_snapshot" jsonb NOT NULL,
  "changed_by" uuid REFERENCES "users"("id"),
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_risk_rule_history_tenant" ON "risk_rule_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_risk_rule_history_created" ON "risk_rule_history" ("tenant_id", "created_at");

-- 4. Blacklist / Watchlist Entries
CREATE TABLE IF NOT EXISTS "blacklist_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "phone" text NOT NULL,
  "normalized_phone" text NOT NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "type" text NOT NULL DEFAULT 'blacklist',
  "reason" text NOT NULL,
  "added_by" uuid REFERENCES "users"("id"),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_blacklist_entries_tenant" ON "blacklist_entries" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_blacklist_entries_tenant_phone" ON "blacklist_entries" ("tenant_id", "normalized_phone");
CREATE INDEX IF NOT EXISTS "idx_blacklist_entries_tenant_active" ON "blacklist_entries" ("tenant_id", "is_active");

-- 5. Customer Risk Checks (Evaluations with TTL caching)
CREATE TABLE IF NOT EXISTS "customer_risk_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "phone" text NOT NULL,
  "normalized_phone" text NOT NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "risk_status" text NOT NULL,
  "risk_score" integer NOT NULL DEFAULT 0,
  "risk_factors" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "data_source" text NOT NULL DEFAULT 'internal_history',
  "data_confidence" text NOT NULL DEFAULT 'medium',
  "metrics" jsonb,
  "decision" text,
  "decision_reason" text,
  "decided_by" uuid REFERENCES "users"("id"),
  "decided_at" timestamp with time zone,
  "valid_until" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_customer_risk_checks_tenant" ON "customer_risk_checks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_customer_risk_checks_tenant_phone" ON "customer_risk_checks" ("tenant_id", "normalized_phone");
CREATE INDEX IF NOT EXISTS "idx_customer_risk_checks_tenant_status" ON "customer_risk_checks" ("tenant_id", "risk_status");
CREATE INDEX IF NOT EXISTS "idx_customer_risk_checks_tenant_created" ON "customer_risk_checks" ("tenant_id", "created_at");

-- 6. Print Logs (Audit log of document prints)
CREATE TABLE IF NOT EXISTS "print_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "document_type" text NOT NULL,
  "order_ids" jsonb NOT NULL,
  "format" text NOT NULL DEFAULT 'a4',
  "printed_by" uuid REFERENCES "users"("id"),
  "printed_by_name" text,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_print_logs_tenant" ON "print_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_print_logs_tenant_created" ON "print_logs" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_print_logs_tenant_doc_type" ON "print_logs" ("tenant_id", "document_type");

-- 7. Documents (Private metadata & paths for generated documents)
CREATE TABLE IF NOT EXISTS "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "document_type" text NOT NULL,
  "title" text NOT NULL,
  "reference_id" text,
  "storage_path" text NOT NULL,
  "file_size" integer,
  "mime_type" text NOT NULL DEFAULT 'application/pdf',
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "idx_documents_tenant" ON "documents" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_documents_tenant_type" ON "documents" ("tenant_id", "document_type");
CREATE INDEX IF NOT EXISTS "idx_documents_tenant_ref" ON "documents" ("tenant_id", "reference_id");

-- ENABLE AND FORCE ROW LEVEL SECURITY ON ALL NEW TABLES
ALTER TABLE "risk_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risk_rules" FORCE ROW LEVEL SECURITY;

ALTER TABLE "risk_rule_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risk_rule_history" FORCE ROW LEVEL SECURITY;

ALTER TABLE "blacklist_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blacklist_entries" FORCE ROW LEVEL SECURITY;

ALTER TABLE "customer_risk_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_risk_checks" FORCE ROW LEVEL SECURITY;

ALTER TABLE "print_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_logs" FORCE ROW LEVEL SECURITY;

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;

-- GRANTS FOR APPLICATION DB ROLE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "risk_rules" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "blacklist_entries" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "customer_risk_checks" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "documents" TO growthomic_app;

    GRANT SELECT, INSERT ON "risk_rule_history" TO growthomic_app;
    REVOKE UPDATE, DELETE ON "risk_rule_history" FROM growthomic_app; -- strictly append-only

    GRANT SELECT, INSERT ON "print_logs" TO growthomic_app;
    REVOKE UPDATE, DELETE ON "print_logs" FROM growthomic_app; -- strictly append-only
  END IF;
END $$;

-- RLS POLICIES
CREATE POLICY "risk_rules_select" ON "risk_rules" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "risk_rules_write" ON "risk_rules" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "risk_rule_history_select" ON "risk_rule_history" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "risk_rule_history_insert" ON "risk_rule_history" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "blacklist_entries_select" ON "blacklist_entries" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "blacklist_entries_write" ON "blacklist_entries" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "customer_risk_checks_select" ON "customer_risk_checks" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "customer_risk_checks_write" ON "customer_risk_checks" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "print_logs_select" ON "print_logs" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "print_logs_insert" ON "print_logs" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "documents_select" ON "documents" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "documents_write" ON "documents" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
