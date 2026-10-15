-- 0004_products_and_inventory.sql
-- M2: Products, Variants, Bundles, Warehouses, Stock Balances, Stock Adjustments, and Inventory Ledger

-- 1. Warehouses
CREATE TABLE IF NOT EXISTS "warehouses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "code" text NOT NULL DEFAULT 'WH-MAIN',
  "is_default" boolean NOT NULL DEFAULT false,
  "address" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_warehouses_tenant" ON "warehouses" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_warehouses_tenant_code" ON "warehouses" ("tenant_id", "code");

-- 2. Categories
CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "parent_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_categories_tenant" ON "categories" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_categories_tenant_slug" ON "categories" ("tenant_id", "slug");

-- 3. Brands
CREATE TABLE IF NOT EXISTS "brands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_brands_tenant" ON "brands" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_brands_tenant_slug" ON "brands" ("tenant_id", "slug");

-- 4. Products
CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "type" text NOT NULL DEFAULT 'standard', -- 'standard' | 'bundle'
  "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
  "brand_id" uuid REFERENCES "brands"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'active', -- 'active' | 'draft' | 'archived'
  "image_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_products_tenant" ON "products" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_tenant_slug" ON "products" ("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "idx_products_tenant_status" ON "products" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products" ("category_id");

-- 5. Product Variants
CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "sku" text NOT NULL,
  "barcode" text,
  "name" text NOT NULL,
  "options" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "retail_price" bigint NOT NULL,
  "wholesale_price" bigint,
  "purchase_cost" bigint DEFAULT 0::bigint NOT NULL,
  "low_stock_threshold" integer DEFAULT 5 NOT NULL,
  "weight_grams" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_product_variants_tenant" ON "product_variants" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_product_variants_product" ON "product_variants" ("product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_variants_tenant_sku" ON "product_variants" ("tenant_id", "sku");
CREATE INDEX IF NOT EXISTS "idx_product_variants_tenant_barcode" ON "product_variants" ("tenant_id", "barcode");

-- 6. Product Bundles
CREATE TABLE IF NOT EXISTS "product_bundles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "bundle_product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "component_variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "quantity" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_product_bundles_tenant" ON "product_bundles" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_product_bundles_bundle" ON "product_bundles" ("bundle_product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_bundles_unique" ON "product_bundles" ("bundle_product_id", "component_variant_id");

-- 7. Inventory Movements (Immutable Ledger)
CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  "type" text NOT NULL,
  "quantity" integer NOT NULL,
  "reference_type" text,
  "reference_id" text,
  "reason" text,
  "note" text,
  "unit_cost" bigint DEFAULT 0::bigint NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_inventory_movements_tenant" ON "inventory_movements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_variant" ON "inventory_movements" ("variant_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_warehouse" ON "inventory_movements" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_created" ON "inventory_movements" ("created_at");

-- 8. Warehouse Stock Balances
CREATE TABLE IF NOT EXISTS "warehouse_stock_balances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "on_hand" integer DEFAULT 0 NOT NULL,
  "reserved" integer DEFAULT 0 NOT NULL,
  "available" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_stock_balances_tenant" ON "warehouse_stock_balances" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_stock_balances_unique" ON "warehouse_stock_balances" ("tenant_id", "warehouse_id", "variant_id");
CREATE INDEX IF NOT EXISTS "idx_stock_balances_variant" ON "warehouse_stock_balances" ("variant_id");

-- 9. Stock Adjustments
CREATE TABLE IF NOT EXISTS "stock_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  "system_quantity" integer NOT NULL,
  "counted_quantity" integer NOT NULL,
  "delta_quantity" integer NOT NULL,
  "reason" text NOT NULL,
  "note" text,
  "status" text DEFAULT 'approved' NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_stock_adjustments_tenant" ON "stock_adjustments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_stock_adjustments_variant" ON "stock_adjustments" ("variant_id");
CREATE INDEX IF NOT EXISTS "idx_stock_adjustments_created" ON "stock_adjustments" ("created_at");

-- ==========================================
-- ROW LEVEL SECURITY (RLS) FOR ALL NEW TABLES
-- ==========================================

-- Enable & Force RLS
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" FORCE ROW LEVEL SECURITY;

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;

ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brands" FORCE ROW LEVEL SECURITY;

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;

ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;

ALTER TABLE "product_bundles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_bundles" FORCE ROW LEVEL SECURITY;

ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" FORCE ROW LEVEL SECURITY;

ALTER TABLE "warehouse_stock_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouse_stock_balances" FORCE ROW LEVEL SECURITY;

ALTER TABLE "stock_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_adjustments" FORCE ROW LEVEL SECURITY;

-- Grant permissions to growthomic_app role
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "warehouses", "categories", "brands", "products", "product_variants", "product_bundles", "warehouse_stock_balances", "stock_adjustments" TO growthomic_app;
    GRANT SELECT, INSERT ON "inventory_movements" TO growthomic_app;
    REVOKE UPDATE, DELETE ON "inventory_movements" FROM growthomic_app; -- strictly append-only
  END IF;
END $$;

-- POLICIES
CREATE POLICY "warehouses_select" ON "warehouses" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "warehouses_write" ON "warehouses" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "categories_select" ON "categories" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "categories_write" ON "categories" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "brands_select" ON "brands" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "brands_write" ON "brands" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "products_select" ON "products" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "products_write" ON "products" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "product_variants_select" ON "product_variants" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "product_variants_write" ON "product_variants" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "product_bundles_select" ON "product_bundles" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "product_bundles_write" ON "product_bundles" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "inventory_movements_select" ON "inventory_movements" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "inventory_movements_insert" ON "inventory_movements" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "warehouse_stock_balances_select" ON "warehouse_stock_balances" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "warehouse_stock_balances_write" ON "warehouse_stock_balances" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "stock_adjustments_select" ON "stock_adjustments" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "stock_adjustments_write" ON "stock_adjustments" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
