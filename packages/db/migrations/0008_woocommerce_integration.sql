-- 0008_woocommerce_integration.sql
-- M6: WooCommerce Integration (Stores, Product Mappings, Integration Events, External Order Linking)

-- 1. Integration Stores (Connected WooCommerce stores with AES-256-GCM credentials)
CREATE TABLE IF NOT EXISTS "integration_stores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "platform" text NOT NULL DEFAULT 'woocommerce',
  "store_name" text NOT NULL,
  "store_url" text NOT NULL,
  "encrypted_credentials" text NOT NULL, -- AES-256-GCM ciphertext of { consumerKey, consumerSecret, webhookSecret }
  "is_active" boolean NOT NULL DEFAULT true,
  "sync_orders" boolean NOT NULL DEFAULT true,
  "push_stock" boolean NOT NULL DEFAULT true,
  "default_warehouse_id" uuid REFERENCES "warehouses"("id") ON DELETE SET NULL,
  "last_order_synced_at" timestamp with time zone,
  "last_stock_pushed_at" timestamp with time zone,
  "health_status" text NOT NULL DEFAULT 'healthy', -- 'healthy' | 'warning' | 'error' | 'disconnected'
  "health_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_integration_stores_tenant" ON "integration_stores" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_integration_stores_tenant_active" ON "integration_stores" ("tenant_id", "is_active");

-- 2. Product Mappings (Maps external store products/variants to internal inventory product_variants)
CREATE TABLE IF NOT EXISTS "product_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "integration_stores"("id") ON DELETE CASCADE,
  "external_product_id" text NOT NULL,
  "external_variant_id" text NOT NULL DEFAULT '',
  "external_sku" text,
  "external_name" text NOT NULL,
  "external_price_minor" bigint NOT NULL DEFAULT 0,
  "external_stock_quantity" integer,
  "internal_variant_id" uuid REFERENCES "product_variants"("id") ON DELETE SET NULL,
  "mapping_status" text NOT NULL DEFAULT 'unmapped', -- 'mapped' | 'unmapped' | 'ignored'
  "last_pushed_stock" integer,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_product_mappings_tenant_store" ON "product_mappings" ("tenant_id", "store_id");
CREATE INDEX IF NOT EXISTS "idx_product_mappings_internal_variant" ON "product_mappings" ("tenant_id", "internal_variant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_mappings_external_uniq" ON "product_mappings" ("tenant_id", "store_id", "external_product_id", "external_variant_id");

-- 3. Integration Events (Stores raw webhook and sync events with deduplication key)
CREATE TABLE IF NOT EXISTS "integration_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "integration_stores"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL, -- 'woocommerce.order.created' | 'woocommerce.order.updated' | 'stock.pushed' | 'reconciliation.sync'
  "external_event_id" text,
  "deduplication_key" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'pending', -- 'pending' | 'processed' | 'failed' | 'ignored'
  "error_message" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_integration_events_tenant_status" ON "integration_events" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_integration_events_store" ON "integration_events" ("tenant_id", "store_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_integration_events_dedupe" ON "integration_events" ("tenant_id", "store_id", "deduplication_key");

-- 4. Alter orders table to link store_id and external_order_id with strict unique constraint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "store_id" uuid REFERENCES "integration_stores"("id") ON DELETE SET NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "external_order_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_orders_tenant_store_external" 
  ON "orders" ("tenant_id", "store_id", "external_order_id") 
  WHERE "store_id" IS NOT NULL AND "external_order_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_orders_store" ON "orders" ("tenant_id", "store_id");

-- 5. ENABLE AND FORCE ROW LEVEL SECURITY
ALTER TABLE "integration_stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_stores" FORCE ROW LEVEL SECURITY;

ALTER TABLE "product_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_mappings" FORCE ROW LEVEL SECURITY;

ALTER TABLE "integration_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_events" FORCE ROW LEVEL SECURITY;

-- 6. GRANTS FOR APP ROLE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "integration_stores" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "product_mappings" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "integration_events" TO growthomic_app;
  END IF;
END $$;

-- 7. RLS POLICIES WITH STRICT TENANT ISOLATION
CREATE POLICY "integration_stores_select" ON "integration_stores" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "integration_stores_write" ON "integration_stores" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "product_mappings_select" ON "product_mappings" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "product_mappings_write" ON "product_mappings" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "integration_events_select" ON "integration_events" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "integration_events_write" ON "integration_events" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
