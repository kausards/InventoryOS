-- 0009_returns_and_pathao.sql
-- M7: Returns Management + Pathao Logistics Adapter

-- 1. Returns table
CREATE TABLE IF NOT EXISTS "returns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "return_number" text NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id"),
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id"),
  "return_type" text NOT NULL DEFAULT 'customer_return', -- 'customer_return' | 'courier_return_rto' | 'exchange'
  "status" text NOT NULL DEFAULT 'requested', -- 'requested' | 'approved' | 'received' | 'inspecting' | 'completed' | 'rejected' | 'cancelled'
  "reason" text NOT NULL DEFAULT 'other', -- 'defective' | 'wrong_item' | 'size_fit' | 'undelivered_rto' | 'mind_change' | 'other'
  "notes" text,
  "shipping_cost_minor" bigint NOT NULL DEFAULT 0,
  "customer_delivery_charge_refunded" boolean NOT NULL DEFAULT false,
  "refund_amount_minor" bigint NOT NULL DEFAULT 0,
  "refund_status" text NOT NULL DEFAULT 'none', -- 'none' | 'pending' | 'refunded' | 'failed'
  "exchange_order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "processed_by" uuid REFERENCES "users"("id"),
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "received_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_returns_tenant" ON "returns" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_returns_tenant_number" ON "returns" ("tenant_id", "return_number");
CREATE INDEX IF NOT EXISTS "idx_returns_tenant_order" ON "returns" ("tenant_id", "order_id");
CREATE INDEX IF NOT EXISTS "idx_returns_tenant_status" ON "returns" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_returns_tenant_type" ON "returns" ("tenant_id", "return_type");

-- 2. Return Items table
CREATE TABLE IF NOT EXISTS "return_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "return_id" uuid NOT NULL REFERENCES "returns"("id") ON DELETE CASCADE,
  "order_item_id" uuid REFERENCES "order_items"("id") ON DELETE SET NULL,
  "product_variant_id" uuid NOT NULL REFERENCES "product_variants"("id"),
  "quantity" integer NOT NULL DEFAULT 1,
  "condition" text NOT NULL DEFAULT 'unknown', -- 'unknown' | 'intact' | 'damaged' | 'opened' | 'missing_parts'
  "disposition" text NOT NULL DEFAULT 'pending', -- 'pending' | 'restock' | 'damage_writeoff' | 'return_to_customer'
  "exchange_variant_id" uuid REFERENCES "product_variants"("id"),
  "exchange_quantity" integer NOT NULL DEFAULT 0,
  "unit_price_minor" bigint NOT NULL DEFAULT 0,
  "notes" text,
  "inspected_at" timestamp with time zone,
  "restocked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_return_items_tenant" ON "return_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_return_items_return" ON "return_items" ("return_id");
CREATE INDEX IF NOT EXISTS "idx_return_items_variant" ON "return_items" ("tenant_id", "product_variant_id");
CREATE INDEX IF NOT EXISTS "idx_return_items_disposition" ON "return_items" ("tenant_id", "disposition");

-- 3. Return Status History table
CREATE TABLE IF NOT EXISTS "return_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "return_id" uuid NOT NULL REFERENCES "returns"("id") ON DELETE CASCADE,
  "from_status" text NOT NULL,
  "to_status" text NOT NULL,
  "actor_type" text NOT NULL, -- 'user' | 'system' | 'courier'
  "actor_id" uuid,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_return_history_tenant" ON "return_status_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_return_history_return" ON "return_status_history" ("tenant_id", "return_id");
CREATE INDEX IF NOT EXISTS "idx_return_history_created" ON "return_status_history" ("tenant_id", "created_at");

-- 4. Enable and Force Row Level Security
ALTER TABLE "returns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "returns" FORCE ROW LEVEL SECURITY;

ALTER TABLE "return_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "return_items" FORCE ROW LEVEL SECURITY;

ALTER TABLE "return_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "return_status_history" FORCE ROW LEVEL SECURITY;

-- 5. Grants for App Role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "returns" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "return_items" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "return_status_history" TO growthomic_app;
  END IF;
END $$;

-- 6. RLS Policies with Tenant Isolation & System Bypass
CREATE POLICY "returns_select" ON "returns" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');
CREATE POLICY "returns_write" ON "returns" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "return_items_select" ON "return_items" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');
CREATE POLICY "return_items_write" ON "return_items" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "return_status_history_select" ON "return_status_history" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');
CREATE POLICY "return_status_history_write" ON "return_status_history" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');
