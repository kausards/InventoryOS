-- 0007_courier_and_shipments.sql
-- M5: Courier Accounts, Shipments, Append-only Shipment Events, Courier Settlements, and Settlement Allocations

-- 1. Courier Accounts (Stores encrypted credentials, sender info, settings)
CREATE TABLE IF NOT EXISTS "courier_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "courier_code" text NOT NULL, -- 'steadfast' | 'pathao' | 'redx'
  "account_name" text NOT NULL,
  "encrypted_credentials" text NOT NULL, -- AES-256-GCM ciphertext
  "sender_name" text,
  "sender_phone" text,
  "sender_address" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "test_mode" boolean NOT NULL DEFAULT false,
  "last_connection_test_at" timestamp with time zone,
  "last_connection_status" text, -- 'connected' | 'failed'
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_courier_accounts_tenant" ON "courier_accounts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_courier_accounts_tenant_code" ON "courier_accounts" ("tenant_id", "courier_code");

-- 2. Shipments (Core courier shipment records with strict deduplication & charge breakdowns)
CREATE TABLE IF NOT EXISTS "shipments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "courier_account_id" uuid NOT NULL REFERENCES "courier_accounts"("id"),
  "courier_code" text NOT NULL,
  "consignment_id" text,
  "tracking_code" text,
  "operation_id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shipment_status" text NOT NULL DEFAULT 'pending', -- 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'partially_delivered' | 'cancelled' | 'returned' | 'failed' | 'unknown_pending_reconciliation'
  "recipient_name" text NOT NULL,
  "recipient_phone" text NOT NULL,
  "recipient_address" text NOT NULL,
  "recipient_division" text,
  "recipient_district" text,
  "cod_amount_minor" bigint NOT NULL DEFAULT 0,
  "delivery_charge_minor" bigint NOT NULL DEFAULT 0,
  "cod_fee_minor" bigint NOT NULL DEFAULT 0,
  "return_fee_minor" bigint NOT NULL DEFAULT 0,
  "actual_settled_minor" bigint NOT NULL DEFAULT 0,
  "instructions" text,
  "raw_response" jsonb,
  "shipped_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "returned_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shipments_tenant" ON "shipments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_shipments_order" ON "shipments" ("tenant_id", "order_id");
CREATE INDEX IF NOT EXISTS "idx_shipments_tracking" ON "shipments" ("tenant_id", "tracking_code");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_shipments_order_courier_uniq" ON "shipments" ("tenant_id", "order_id", "courier_code");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_shipments_operation_id_uniq" ON "shipments" ("tenant_id", "operation_id");

-- 3. Shipment Events (Strictly append-only audit trail of status transitions & provider updates)
CREATE TABLE IF NOT EXISTS "shipment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "shipment_id" uuid NOT NULL REFERENCES "shipments"("id") ON DELETE CASCADE,
  "provider_status" text NOT NULL,
  "normalized_status" text NOT NULL,
  "event_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "location" text,
  "note" text,
  "raw_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shipment_events_tenant_shipment" ON "shipment_events" ("tenant_id", "shipment_id");
CREATE INDEX IF NOT EXISTS "idx_shipment_events_timestamp" ON "shipment_events" ("tenant_id", "event_timestamp");

-- 4. Courier Settlements (Batch COD settlements & statements)
CREATE TABLE IF NOT EXISTS "courier_settlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "courier_account_id" uuid NOT NULL REFERENCES "courier_accounts"("id"),
  "statement_reference" text NOT NULL,
  "statement_date" timestamp with time zone DEFAULT now() NOT NULL,
  "total_expected_cod_minor" bigint NOT NULL DEFAULT 0,
  "total_settled_minor" bigint NOT NULL DEFAULT 0,
  "total_fee_deducted_minor" bigint NOT NULL DEFAULT 0,
  "settlement_status" text NOT NULL DEFAULT 'pending', -- 'pending' | 'partially_settled' | 'settled' | 'disputed' | 'reconciled'
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  "imported_by" uuid REFERENCES "users"("id"),
  "raw_statement" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_courier_settlements_tenant" ON "courier_settlements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_courier_settlements_reference" ON "courier_settlements" ("tenant_id", "statement_reference");

-- 5. Courier Settlement Allocations (Per-shipment breakdown of settlements)
CREATE TABLE IF NOT EXISTS "courier_settlement_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "settlement_id" uuid NOT NULL REFERENCES "courier_settlements"("id") ON DELETE CASCADE,
  "shipment_id" uuid REFERENCES "shipments"("id"),
  "order_id" uuid REFERENCES "orders"("id"),
  "consignment_id" text,
  "cod_amount_minor" bigint NOT NULL DEFAULT 0,
  "courier_fee_minor" bigint NOT NULL DEFAULT 0,
  "net_settled_minor" bigint NOT NULL DEFAULT 0,
  "dispute_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_settlement_alloc_tenant" ON "courier_settlement_allocations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_settlement_alloc_settlement" ON "courier_settlement_allocations" ("tenant_id", "settlement_id");
CREATE INDEX IF NOT EXISTS "idx_settlement_alloc_shipment" ON "courier_settlement_allocations" ("tenant_id", "shipment_id");

-- ENABLE RLS & FORCE RLS ON ALL TABLES
ALTER TABLE "courier_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courier_accounts" FORCE ROW LEVEL SECURITY;

ALTER TABLE "shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "shipment_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipment_events" FORCE ROW LEVEL SECURITY;

ALTER TABLE "courier_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courier_settlements" FORCE ROW LEVEL SECURITY;

ALTER TABLE "courier_settlement_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courier_settlement_allocations" FORCE ROW LEVEL SECURITY;

-- GRANTS FOR APP ROLE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "courier_accounts" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "shipments" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "courier_settlements" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "courier_settlement_allocations" TO growthomic_app;

    GRANT SELECT, INSERT ON "shipment_events" TO growthomic_app;
    REVOKE UPDATE, DELETE ON "shipment_events" FROM growthomic_app; -- strictly append-only
  END IF;
END $$;

-- RLS POLICIES WITH TENANT ISOLATION
CREATE POLICY "courier_accounts_select" ON "courier_accounts" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "courier_accounts_write" ON "courier_accounts" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "shipments_select" ON "shipments" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "shipments_write" ON "shipments" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "shipment_events_select" ON "shipment_events" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "shipment_events_insert" ON "shipment_events" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "courier_settlements_select" ON "courier_settlements" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "courier_settlements_write" ON "courier_settlements" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "courier_settlement_allocations_select" ON "courier_settlement_allocations" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY "courier_settlement_allocations_write" ON "courier_settlement_allocations" FOR ALL
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
