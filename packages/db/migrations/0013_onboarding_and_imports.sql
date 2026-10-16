-- 0013_onboarding_and_imports.sql
-- M11: Onboarding Setup Wizard & Data Import Batches with Reversion

-- 1. Alter tenants table with onboarding flags and metadata
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

-- 2. Create import_batches table
CREATE TABLE IF NOT EXISTS "import_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL, -- 'products' | 'customers' | 'orders'
  "file_name" text NOT NULL,
  "total_rows" integer NOT NULL,
  "successful_rows" integer NOT NULL,
  "failed_rows" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'completed', -- 'completed' | 'reverted'
  "imported_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "errors" jsonb,
  "reverted_at" timestamp with time zone,
  "reverted_by" uuid REFERENCES "users"("id"),
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_import_batches_tenant" ON "import_batches" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_import_batches_status" ON "import_batches" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_import_batches_created" ON "import_batches" ("tenant_id", "created_at");

-- 3. Enable and Force Row Level Security
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" FORCE ROW LEVEL SECURITY;

-- 4. App Role Grants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "import_batches" TO growthomic_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_platform_admin') THEN
    GRANT SELECT ON "import_batches" TO growthomic_platform_admin;
  END IF;
END $$;

-- 5. RLS Policies
CREATE POLICY "import_batches_select" ON "import_batches" FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "import_batches_insert" ON "import_batches" FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "import_batches_update" ON "import_batches" FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "import_batches_delete" ON "import_batches" FOR DELETE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_setting('app.is_system', true) = 'true');
