-- 0011_finance_and_expenses.sql
-- M9: Finance Ledger (Immutable Transactions) & Operating Expenses

-- 1. Financial Transactions table (Immutable Single-Entry Ledger, Double-Entry Ready)
CREATE TABLE IF NOT EXISTS "financial_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "transaction_number" text NOT NULL,
  "type" text NOT NULL, -- 'sale' | 'cogs' | 'courier_fee' | 'packaging_cost' | 'cod_fee' | 'return_cost' | 'expense' | 'refund' | 'adjustment' | 'payout'
  "direction" text NOT NULL, -- 'in' | 'out'
  "category" text NOT NULL, -- 'revenue' | 'cogs' | 'order_cost' | 'operating_expense' | 'settlement' | 'refund' | 'other'
  "amount_minor" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'BDT',
  "date" timestamp with time zone DEFAULT now() NOT NULL,
  "reference_type" text, -- 'order' | 'return' | 'shipment' | 'expense' | 'manual'
  "reference_id" text,
  "payment_method" text, -- 'cash' | 'bank' | 'bkash' | 'nagad' | 'card' | 'cod_deduction'
  "status" text NOT NULL DEFAULT 'posted', -- 'draft' | 'posted' | 'voided' | 'reversed'
  "account_id" uuid,
  "reversal_of" uuid REFERENCES "financial_transactions"("id"),
  "notes" text,
  "metadata" jsonb,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "approved_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_financial_transactions_tenant" ON "financial_transactions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_financial_transactions_date" ON "financial_transactions" ("tenant_id", "date");
CREATE INDEX IF NOT EXISTS "idx_financial_transactions_ref" ON "financial_transactions" ("tenant_id", "reference_type", "reference_id");
CREATE INDEX IF NOT EXISTS "idx_financial_transactions_category" ON "financial_transactions" ("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "idx_financial_transactions_type" ON "financial_transactions" ("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "idx_financial_transactions_status" ON "financial_transactions" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_financial_transactions_reversal" ON "financial_transactions" ("reversal_of");

-- 2. Expenses table (Operating Expenses)
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "expense_number" text NOT NULL,
  "title" text NOT NULL,
  "category" text NOT NULL, -- 'rent' | 'utilities' | 'marketing' | 'packaging_supplies' | 'software' | 'salaries' | 'maintenance' | 'courier_equipment' | 'office' | 'other'
  "amount_minor" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'BDT',
  "expense_date" timestamp with time zone DEFAULT now() NOT NULL,
  "payment_status" text NOT NULL DEFAULT 'paid', -- 'paid' | 'unpaid' | 'partial'
  "payment_method" text NOT NULL DEFAULT 'cash', -- 'cash' | 'bank' | 'bkash' | 'nagad' | 'card' | 'cod_deduction'
  "receipt_url" text,
  "description" text,
  "is_recurring" boolean NOT NULL DEFAULT false,
  "recurring_rule" jsonb,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "approved_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_expenses_tenant" ON "expenses" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_expenses_date" ON "expenses" ("tenant_id", "expense_date");
CREATE INDEX IF NOT EXISTS "idx_expenses_category" ON "expenses" ("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "idx_expenses_status" ON "expenses" ("tenant_id", "payment_status");

-- 3. Enable and Force Row Level Security
ALTER TABLE "financial_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_transactions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;

-- 4. App Role Grants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthomic_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "financial_transactions" TO growthomic_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "expenses" TO growthomic_app;
  END IF;
END $$;

-- 5. RLS Policies
CREATE POLICY "financial_transactions_select" ON "financial_transactions" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "financial_transactions_insert" ON "financial_transactions" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "financial_transactions_update" ON "financial_transactions" FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "expenses_select" ON "expenses" FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "expenses_insert" ON "expenses" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "expenses_update" ON "expenses" FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');

CREATE POLICY "expenses_delete" ON "expenses" FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.is_system', true) = 'true');
