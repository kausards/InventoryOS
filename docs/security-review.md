# Shopeers Security Architecture & Audit Review

**Version:** 1.0.0  
**Status:** Approved & Production-Hardened  
**Date:** October 2026  
**Applicability:** Monorepo (`apps/api`, `apps/web`, `packages/db`, `packages/shared`)

---

## 1. Executive Summary

Shopeers is an enterprise-grade multi-tenant B2B eCommerce and Inventory Operating System designed specifically for Bangladeshi online businesses, multi-channel retailers, and wholesale distributors.

This document reviews and certifies the security boundaries implemented across:
- **Tenant Isolation:** Row-Level Security (RLS) across all 13 database migrations.
- **Spreadsheet Formula Injection (CSV / DDE Attack Defense):** Sanitization of intake and export vectors.
- **Cryptographic Protection:** Authenticated AES-256-GCM encryption for courier credentials and payment secrets.
- **Data Privacy & GDPR/BD Compliance:** Customer PII redaction and irreversible anonymization.
- **Role-Based Access Control (RBAC):** Strict permission guard enforcement across all API endpoints.

---

## 2. Row-Level Security (RLS) Audit

Shopeers enforces database-level tenant isolation using PostgreSQL Row-Level Security (RLS). Even in the event of an application-layer logical vulnerability, cross-tenant data leakage is structurally impossible at the database engine level.

### 2.1 RLS Implementation Standard

Every tenant-bound table enforces:
1. `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
2. `ALTER TABLE <table> FORCE ROW LEVEL SECURITY;`
3. Isolation Policy:
   ```sql
   CREATE POLICY <table>_isolation_policy ON <table>
     FOR ALL
     USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
   ```

### 2.2 Migrations Audit Matrix

| Migration | Scope | Tables Covered | RLS Status | Verified |
|---|---|---|---|---|
| `0000_baseline_tenants_and_users.sql` | Tenants, Users, Roles | `tenants`, `users`, `roles`, `permissions`, `memberships` | Enabled & Enforced | Yes |
| `0001_audit_logs.sql` | Immutable Audit Ledger | `audit_logs` | Enabled & Enforced | Yes |
| `0002_outbox_events.sql` | Transactional Outbox Pattern | `outbox_events` | Enabled & Enforced | Yes |
| `0003_test_items.sql` | Integration Testing Fixtures | `test_items` | Enabled & Enforced | Yes |
| `0004_products_and_inventory.sql` | Catalog & Multi-Warehouse | `warehouses`, `categories`, `brands`, `products`, `product_variants`, `product_bundles`, `warehouse_stock_balances`, `inventory_movements`, `stock_adjustments` | Enabled & Enforced | Yes |
| `0005_orders_and_crm.sql` | Orders & Customers | `customers`, `customer_addresses`, `customer_tags`, `customer_tag_assignments`, `orders`, `order_items`, `order_status_history` | Enabled & Enforced | Yes |
| `0006_risk_and_documents.sql` | Risk Engine & PDF Documents | `risk_rules`, `blacklist_entries`, `customer_risk_checks`, `print_logs`, `documents` | Enabled & Enforced | Yes |
| `0007_courier_and_settlements.sql` | Steadfast Gateway & COD Reconcile | `courier_accounts`, `shipments`, `shipment_events`, `courier_settlements`, `courier_settlement_allocations` | Enabled & Enforced | Yes |
| `0008_woocommerce_integration.sql` | WooCommerce Webhooks & Store Sync | `integration_stores`, `product_mappings`, `integration_events` | Enabled & Enforced | Yes |
| `0009_returns_and_pathao.sql` | Reverse Logistics & Pathao | `returns`, `return_items`, `return_status_history` | Enabled & Enforced | Yes |
| `0010_notifications_and_credits.sql` | SMS/Email Ledger & Gateway | `message_credit_ledgers`, `notification_templates`, `notification_preferences`, `customer_consents`, `notifications` | Enabled & Enforced | Yes |
| `0011_finances_and_expenses.sql` | Double-Entry & Operating Expenses | `financial_transactions`, `expenses` | Enabled & Enforced | Yes |
| `0012_subscriptions_and_billing.sql` | SaaS Plans & Platform Admin | `subscription_plans`, `subscriptions`, `manual_payments` | Enabled & Enforced | Yes |
| `0013_onboarding_and_imports.sql` | CSV Batch & Setup Wizard | `import_batches` | Enabled & Enforced | Yes |

---

## 3. Spreadsheet Formula Injection Defense

### 3.1 Threat Model
When users export sales reports, inventory lists, or customer directories to CSV, malicious actors may have embedded payload strings starting with `=`, `+`, `-`, `@`, `\t`, or `\r`. If opened in Microsoft Excel or Google Sheets, the spreadsheet program can execute Dynamic Data Exchange (DDE) commands, launch local subprocesses, or exfiltrate credentials.

### 3.2 Implemented Countermeasures (`@growthomic/shared`)

1. **Intake Cleaning (`cleanImportCell`):**
   - Automatically strips leading formula trigger characters before database storage.
   - Example: `=cmd|' /C calc'!A0` is sanitized to `cmd|' /C calc'!A0`.
2. **Export Neutralization (`sanitizeCsvCell`):**
   - Prepends a single quote (`'`) to any cell beginning with dangerous prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`).
   - Forces spreadsheet programs to treat the cell contents strictly as plain literal strings without formula evaluation.
3. **Automated Verification:**
   - Certified by automated test suite in `packages/shared/src/__tests__/csv-safety.test.ts` and `apps/api/test/security/security-review.test.ts`.

---

## 4. Cryptographic Storage & Key Management

### 4.1 Courier & Gateway Credentials
- Courier credentials (Steadfast API Key/Secret, Pathao Client Secrets) are never stored in plaintext.
- Encrypted using **AES-256-GCM** with a distinct 12-byte random initialization vector (IV) per entry and an authenticated 16-byte authentication tag (`IV:AuthTag:Ciphertext`).
- Prevents tampering or ciphertext manipulation attacks.

### 4.2 API Authentication & Secret Suppression
- Supabase JWT authentication verified with strict role claims.
- Passwords and encrypted credentials are excluded from JSON responses using DTO masking and projection filters.

---

## 5. Privacy & Data Minimization (GDPR & BD Cyber Security Act)

1. **Irreversible Customer Anonymization (`POST /customers/:id/anonymize`):**
   - Redacts Customer Name to `'Anonymized Customer'`.
   - Redacts Phone Number to a non-dialable pseudo-identifier (`00000000000-xxxx`).
   - Redacts Addresses to `'[REDACTED]'`.
   - Drops all tag profiling assignments.
   - **Crucial Invariant:** Retains `totalOrders`, `totalSpentMinor`, and order historical line items to preserve financial accounting integrity and double-entry general ledger balance.
2. **Audit Logging:**
   - Every anonymization event is immutably logged with actor ID, timestamp, and request correlation ID.
