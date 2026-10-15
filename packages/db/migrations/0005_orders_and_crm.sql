-- 0005_orders_and_crm.sql
-- M3: Customers, Addresses, Tags, Tag Assignments, Orders, Order Items, Order Status History, Order Sequences

-- 1. Customers
CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "normalized_phone" text NOT NULL,
  "email" text,
  "notes" text,
  "total_orders" integer NOT NULL DEFAULT 0,
  "delivered_orders" integer NOT NULL DEFAULT 0,
  "cancelled_orders" integer NOT NULL DEFAULT 0,
  "returned_orders" integer NOT NULL DEFAULT 0,
  "total_spent_minor" bigint NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'BDT',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_customers_tenant" ON "customers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_customers_tenant_phone" ON "customers" ("tenant_id", "normalized_phone");
CREATE INDEX IF NOT EXISTS "idx_customers_tenant_created" ON "customers" ("tenant_id", "created_at");

-- 2. Customer Addresses
CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "label" text NOT NULL DEFAULT 'Home',
  "division" text NOT NULL,
  "district" text NOT NULL,
  "upazila_thana" text,
  "area" text,
  "street_address" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_customer_addresses_tenant" ON "customer_addresses" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_customer_addresses_customer" ON "customer_addresses" ("customer_id");

-- 3. Customer Tags
CREATE TABLE IF NOT EXISTS "customer_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#2563EB',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_customer_tags_tenant" ON "customer_tags" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_tags_tenant_name" ON "customer_tags" ("tenant_id", "name");

-- 4. Customer Tag Assignments
CREATE TABLE IF NOT EXISTS "customer_tag_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "customer_tags"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_cust_tag_assign_tenant" ON "customer_tag_assignments" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_cust_tag_assign_unique" ON "customer_tag_assignments" ("tenant_id", "customer_id", "tag_id");

-- 5. Orders
CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "order_number" text NOT NULL,
  "order_sequence" integer NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT,
  "source" text NOT NULL DEFAULT 'manual',
  "source_reference" text,
  "order_status" text NOT NULL DEFAULT 'pending',
  "payment_status" text NOT NULL DEFAULT 'unpaid',
  "shipment_status" text NOT NULL DEFAULT 'unfulfilled',
  "subtotal_minor" bigint NOT NULL DEFAULT 0,
  "discount_minor" bigint NOT NULL DEFAULT 0,
  "delivery_charge_minor" bigint NOT NULL DEFAULT 0,
  "total_amount_minor" bigint NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'BDT',
  "payment_method" text NOT NULL DEFAULT 'cod',
  "customer_notes" text,
  "internal_notes" text,
  "hold_reason" text,
  "cancel_reason" text,
  "is_duplicate_warning" boolean NOT NULL DEFAULT false,
  "duplicate_of_order_id" uuid,
  "assigned_staff_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "confirmed_at" timestamp with time zone,
  "shipped_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_orders_tenant" ON "orders" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_orders_tenant_number" ON "orders" ("tenant_id", "order_number");
CREATE INDEX IF NOT EXISTS "idx_orders_tenant_status" ON "orders" ("tenant_id", "order_status");
CREATE INDEX IF NOT EXISTS "idx_orders_tenant_customer" ON "orders" ("tenant_id", "customer_id");
CREATE INDEX IF NOT EXISTS "idx_orders_tenant_created" ON "orders" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_orders_tenant_source" ON "orders" ("tenant_id", "source");

-- 6. Order Sequences
CREATE TABLE IF NOT EXISTS "order_sequences" (
  "tenant_id" uuid PRIMARY KEY REFERENCES "tenants"("id") ON DELETE CASCADE,
  "prefix" text NOT NULL DEFAULT 'ORD-',
  "last_number" integer NOT NULL DEFAULT 1000,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 7. Order Items
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  "product_name" text NOT NULL,
  "variant_name" text NOT NULL,
  "sku" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price_minor" bigint NOT NULL,
  "total_price_minor" bigint NOT NULL,
  "unit_cost_minor" bigint NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_order_items_tenant" ON "order_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_order_items_order" ON "order_items" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_order_items_variant" ON "order_items" ("variant_id");

-- 8. Order Status History (Append-only)
CREATE TABLE IF NOT EXISTS "order_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "from_status" text NOT NULL,
  "to_status" text NOT NULL,
  "actor_type" text NOT NULL,
  "actor_id" uuid,
  "reason" text,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_order_history_tenant" ON "order_status_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_order_history_order" ON "order_status_history" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_order_history_created" ON "order_status_history" ("created_at");

-- ENABLE AND FORCE ROW LEVEL SECURITY ON ALL M3 TABLES
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;

ALTER TABLE "customer_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_addresses" FORCE ROW LEVEL SECURITY;

ALTER TABLE "customer_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_tags" FORCE ROW LEVEL SECURITY;

ALTER TABLE "customer_tag_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_tag_assignments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;

ALTER TABLE "order_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_sequences" FORCE ROW LEVEL SECURITY;

ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;

ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_status_history" FORCE ROW LEVEL SECURITY;

-- ROLE GRANTS
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "customers", "customer_addresses", "customer_tags", "customer_tag_assignments", "orders", "order_sequences", "order_items" TO growthomic_app;
    GRANT SELECT, INSERT ON "order_status_history" TO growthomic_app;
    REVOKE UPDATE, DELETE ON "order_status_history" FROM growthomic_app; -- strictly append-only
  END IF;
END $$;

-- POLICIES
CREATE POLICY "customers_select" ON "customers" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "customers_write" ON "customers" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "customer_addresses_select" ON "customer_addresses" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "customer_addresses_write" ON "customer_addresses" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "customer_tags_select" ON "customer_tags" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "customer_tags_write" ON "customer_tags" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "customer_tag_assignments_select" ON "customer_tag_assignments" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "customer_tag_assignments_write" ON "customer_tag_assignments" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "orders_select" ON "orders" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "orders_write" ON "orders" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "order_sequences_select" ON "order_sequences" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "order_sequences_write" ON "order_sequences" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "order_items_select" ON "order_items" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "order_items_write" ON "order_items" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "order_status_history_select" ON "order_status_history" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "order_status_history_insert" ON "order_status_history" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
