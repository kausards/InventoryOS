# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow milestone numbers until a public API is established.

---

## [M9] — 2026-10-16 — Finance MVP + Dashboard

### Added
- **Database Schema & DDL Migration (`packages/db/migrations/0011_finance_and_expenses.sql`):**
  - Tables: `financial_transactions`, `expenses`.
  - Immutable single-entry financial ledger architecture (`financial_transactions`), double-entry ready with nullable `account_id` and self-referential `reversal_of` foreign key.
  - Operating expenses management table (`expenses`) with categories (`rent`, `marketing`, `salaries`, `utilities`, `software`, `packaging_supplies`, etc.), payment status, and automated ledger posting upon payment.
  - Multi-tenant Row Level Security (`FORCE ROW LEVEL SECURITY`) with `growthomic_app` role permissions and isolation policies.
  - Registered migration index 9 in `packages/db/migrations/meta/_journal.json`.
- **Shared Financial Formulas & Validation Schemas (`packages/shared`):**
  - PRD Part R deterministic formulas in `packages/shared/src/finance-calc.ts`:
    - `calculateOrderFinance`: Deterministic net sales, gross profit, contribution margin after order costs.
    - `calculateOperatingProfit`: Gross Profit − Operating Expenses.
    - `calculateNetCashMovement`: Actual Cash Inflows − Outflows.
    - `calculateMarginPercent`: Margin percentage with 2-decimal precision.
  - Zod schemas: `createFinancialTransactionSchema`, `reverseFinancialTransactionSchema`, `createExpenseSchema`, `updateExpenseSchema`, `financialReportFilterSchema`.
  - All financial amounts strictly enforced as positive `BIGINT` in minor units (paisa, where 100 paisa = ৳1.00 BDT).
- **Backend Finance & Expenses API (`apps/api`):**
  - `FinanceService`:
    - Revenue recognition strictly at delivery (`delivered` order status) with historical COGS snapshotting, packaging fee snapshot, and courier fee snapshot.
    - Idempotent delivery recognition ensuring duplicate events never double-post ledger entries.
    - Immutable ledger reversal mechanics: Creates an offsetting reversal transaction with inverted direction (`in` $\leftrightarrow$ `out`), pointing to `reversal_of`, and marks original transaction as `reversed`.
    - `getPnLReport`: Accrual-based deterministic P&L statement (Gross Sales, Net Sales, COGS, Gross Profit, Direct Order Costs, Contribution Margin, Operating Expenses, Operating Profit, Margins, and Net Cash Movement).
    - `getDashboardMetrics`: 30-day time-series revenue vs expenses daily trend chart data, order volume, and AOV.
  - `ExpensesService`: Full CRUD for operating expenses with automatic transaction posting to financial ledger for paid expenses and category aggregation.
  - `FinanceController` & `ExpensesController` with server-side RBAC protection (`FINANCE_VIEW`, `FINANCE_MANAGE`, `EXPENSES_VIEW`, `EXPENSES_CREATE`).
  - Integrated `OrdersService` automatic revenue recognition upon order status reaching `delivered`.
- **Frontend Shopeers UI (`apps/web`):**
  - `/finances`: Complete Profit & Loss (P&L) statement page with quick date range filters (Today, 7D, 30D, 90D, All), top KPI cards, and waterfall statement breakdown conforming to PRD R.3.
  - `/finances/ledger`: Immutable single-entry financial transactions ledger with type, category, and direction filters, search, and interactive Reversal Modal.
  - `/finances/expenses`: Operating Expenses hub with category spend metrics, breakdown percentages, filterable table, and Add/Edit Expense modal.
  - `/dashboard`: Enhanced executive dashboard with live BDT (৳) financial KPIs, delivered order metrics, 30-day operating profit, and direct navigation links to finance reports.
  - `Sidebar`: Updated Finances navigation submenu linking to P&L Statement, Transaction Ledger, Operating Expenses, and COD Settlements.
- **Documentation (`docs/`):**
  - `docs/finance-policy.md`: Complete accounting treatment for revenue recognition, COGS snapshotting, order costs, operating expenses, ledger immutability, reversal mechanics, and PRD R.3 worked example.
  - `docs/kpi-definitions.md`: Exact mathematical definitions and timing for Net Product Sales, COGS, Gross Profit, Contribution, Operating Profit, Net Cash Movement, and AOV.

### Acceptance Gates & Tests
- 206 passing tests across the entire monorepo (`packages/shared`: 94, `apps/api`: 107, `apps/worker`: 4, `apps/web`: 1).
- **Gate 1: PRD R.3 Worked Example** — Verified in paisa (`finance-calc.test.ts` & `finance-service.test.ts`).
- **Gate 2: Ledger Immutability & Reversal Workflow** — Verified reversal direction flipping, idempotency, and double-reversal rejection (`finance-service.test.ts`).
- **Gate 3: P&L Statement Reconciliation** — Verified exact accrual calculation matching ledger records (`finance-service.test.ts`).

---

## [M8] — 2026-10-15 — Notifications, Adapters, Consent & Message Credits Ledger

### Added
- Database Schema & DDL Migration (`packages/db/migrations/0010_notifications_and_credits.sql`):
  - Tables: `message_credit_ledgers`, `notification_templates`, `notification_preferences`, `customer_consents`, `notifications`.
  - Append-only credit ledger architecture tracking tenant credit changes with `balance_after` running balance.
  - Customer consent registry for compliance with SMS and WhatsApp marketing laws (opt-in and opt-out tracking).
  - Strict RLS & `FORCE ROW LEVEL SECURITY` with tenant isolation and `growthomic_app` role grants.
- Shared Notification Schemas & Bilingual Templates (`packages/shared`):
  - Zod schemas: `sendNotificationSchema`, `topUpCreditsSchema`, `updateConsentSchema`, `createTemplateSchema`, `updateTemplateSchema`, `updatePreferencesSchema`.
  - Template variable interpolation engine (`renderTemplate`) supporting `{{customer_name}}`, `{{order_number}}`, `{{total_amount}}`, `{{tracking_code}}`, etc.
  - Built-in bilingual system templates (Bangla and English) for order confirmation, order dispatched, order delivered, and WhatsApp notifications.
  - New RBAC permissions: `NOTIFICATIONS_VIEW`, `NOTIFICATIONS_MANAGE`, `NOTIFICATIONS_SEND`.
- Backend Notification Service & Adapters (`apps/api`):
  - `ElitbuzzSmsAdapter`: Official Bangladesh ElitBuzz REST API implementation supporting ASCII and Unicode/Bangla segmentation with sandbox mock fallback.
  - `MetaWhatsAppAdapter`: Meta Cloud API WhatsApp provider adapter for template and text message dispatch.
  - `CreditsLedgerService`:
    - **Acceptance Gate 1:** Atomic credit deduction inside PostgreSQL row-locked transactions (`FOR UPDATE`). Guarantees credit balance can NEVER drop below zero.
    - Top-up credit ledger appending and automated provider error credit refunding.
  - `ConsentService`:
    - **Acceptance Gate 2:** Strict opt-out enforcement. If customer phone number is opted-out, notifications are blocked immediately with zero credits deducted and no provider dispatch.
  - `NotificationsService`:
    - Unified dispatch pipeline: consent check → variable interpolation → credit check & atomic deduction → provider adapter dispatch → status logging → automatic refund on provider failure.
    - In-app notification center alerts with unread counter and read status tracking.
    - Safe retries for failed or credit-exhausted notifications.
  - `NotificationsController` (`/api/v1/notifications`): Full REST API suite for messaging, credits, templates, preferences, and consents.
- Frontend Shopeers UI (`apps/web`):
  - `/settings/notifications`: Clean, modern, multi-tabbed Notification Settings & Messaging Hub:
    - **Credits & Ledger Tab:** Real-time SMS and WhatsApp balance cards, interactive Top-Up modal, and immutable running ledger table.
    - **Delivery Status Logs Tab:** Chronological delivery log table with channel badges, message preview, credit usage, status chips, and one-click retry for failed messages.
    - **Templates Tab:** Visual card grid of active bilingual templates with live variable tags and editing modal.
    - **Customer Consent & Gateways Tab:** Customer opt-out registry with manual opt-out blocker and gateway credential management (ElitBuzz, Greenweb, Meta Cloud API).
  - In-App Notification Center: Bell icon in Topbar ([`apps/web/components/topbar.tsx`](file:///e:/inventoryOS/apps/web/components/topbar.tsx)) with real-time unread badge, interactive dropdown of latest alerts, "Mark all read" button, and deep-link to notifications hub.
  - Navigation Sidebar: Direct link to `/settings/notifications` in sidebar navigation.

### Acceptance Gates & Tests
- 193 passing tests across entire monorepo (`packages/shared`: 88, `apps/api`: 100, `apps/worker`: 4, `apps/web`: 1).
- Gate 1: Atomic credit deduction & ledger integrity (`notifications-service.test.ts`).
- Gate 2: Customer consent & opt-out respected without credit deduction (`notifications-service.test.ts`).

---

## [M7] — 2026-10-15 — Returns Management + Pathao Logistics Adapter

### Added
- Database Schema & DDL Migration (`packages/db/migrations/0009_returns_and_pathao.sql`):
  - Tables: `returns`, `return_items`, `return_status_history`
  - Columns: return reasons, return types (`customer_return`, `courier_return_rto`, `exchange`), conditions (`intact`, `damaged`, `opened`, `missing_parts`), dispositions (`restock`, `damage_writeoff`, `return_to_customer`), shipping costs, refund amounts, exchange variant links, and timestamps.
  - Strict RLS & `FORCE ROW LEVEL SECURITY` with tenant isolation and system bypass (`withSystem()`) policies.
- Shared Returns & Reverse Logistics Schemas (`packages/shared`):
  - Zod validation schemas: `createReturnSchema`, `inspectReturnSchema`, `receiveReturnSchema`, `completeReturnSchema`, `returnReportFilterSchema`.
  - Pathao Courier Types: Extended `CreateCourierOrderParams`, `CourierAccountCredentials`, and `MaskedCourierAccount` for Pathao OAuth2 credentials (clientId, clientSecret, username, password, storeId).
  - Return rate analytics and status history types.
- Backend Returns Service & Pathao Adapter (`apps/api`):
  - `PathaoAdapter`: Official Pathao Merchant API v2 implementation with OAuth2 password grant token exchange, token caching, order creation with consignment ID & tracking code generation, ambiguous timeout safety, and status normalization.
  - `ReturnsService`:
    - Reverse logistics lifecycle: request → receive → inspect → restock / damage write-off → refund → complete.
    - **Gate 1 Safeguard:** Damaged return creates NO restock movement into sellable inventory. Damaged items marked for restock are rejected with `BadRequestException`, or written off with 0 quantity movement to available inventory.
    - **Gate 2 Safeguard:** Exchange creates balanced inventory movements (replacement variant decremented from available warehouse stock, returned variant incremented if condition is intact).
    - Return rate analytics engine: aggregated return rates by product SKU, by courier partner (Steadfast vs Pathao), and by delivery district.
    - Fastify BigInt serialization safety: minor paisa values converted to numbers.
  - `ReturnsController` (`/api/v1/returns`): Authenticated & permission-guarded routes (`PERMISSIONS.RETURNS_VIEW`, `RETURNS_CREATE`, `RETURNS_INSPECT`).
- Frontend Shopeers UI (`apps/web`):
  - `/returns`: Full Returns & Exchanges dashboard with summary metric cards (Total Returns, Pending Inspection, Return Shipping Cost, Total Refund Payouts), live search and filters.
  - Return Rate Analytics tab: visual breakdown of return rates by SKU, by courier, and by district.
  - Interactive Modals: Initiate Return modal, Inspect Return modal with real-time Gate 1 safety banner, and Complete & Refund modal.
  - `/returns/[id]`: Return detail overview with customer info, logistics summary, returned items table, and chronological audit history timeline.
  - Navigation Sidebar: Added `Returns & RTO` direct navigation link with amber badge.

### Acceptance Gates & Tests
- 178 passing tests across entire monorepo (`packages/shared`: 80, `apps/api`: 93, `apps/worker`: 4, `apps/web`: 1)
- Gate 1: Damaged return creates NO restock movement into sellable inventory (`returns-service.test.ts`)
- Gate 2: Exchange creates balanced inventory movements (`returns-service.test.ts`)
- Gate 3: Pathao test order dispatches successfully with consignment ID and tracking code (`pathao-adapter.test.ts`)
- Gate 4: Completion Report delivered

---

## [M6] — 2026-10-14 — WooCommerce Integration (Store Sync, Webhooks, Reconciliation, Stock Push)

### Added
- Database Schema & DDL Migration (`packages/db/migrations/0008_woocommerce_integration.sql`):
  - Tables: `integration_stores`, `product_mappings`, `integration_events`
  - Columns added to `orders`: `store_id`, `external_order_id`
  - Unique constraint: `idx_orders_tenant_store_external` ensuring strictly unique orders per store
  - Strict RLS & `FORCE ROW LEVEL SECURITY` enabled on all tables
- Shared Integration Libraries & Security Utilities (`packages/shared`):
  - SSRF URL Firewall (`validateSsrfSafeUrl`): blocks loopback, RFC 1918 private IPs, AWS/GCP metadata (`169.254.169.254`), and dangerous protocols
  - HMAC-SHA256 Webhook Verification (`verifyWooCommerceWebhookSignature`) with constant-time equality checks
  - Deduplication key generator (`computeWebhookDeduplicationKey`)
  - AES-256-GCM authenticated encryption for WooCommerce REST keys with masking helper (`maskStoreCredentials`)
  - Permissions: `INTEGRATIONS_VIEW`, `INTEGRATIONS_MANAGE`
  - Money utilities: `toPaisa`, `fromPaisa`
  - Zod schemas for store connection, variant mapping, reconciliation, and stock push
- Backend REST API (`apps/api`):
  - `WooCommerceClient`: Official WooCommerce REST API v3 client (`/products`, `/orders`, `/webhooks`, stock updates)
  - `IntegrationsModule` (`/api/v1/integrations`):
    - Connect store with SSRF validation and live connection verification
    - Masked credentials preview in API responses (`ck_...****`)
    - Webhook handler with HMAC signature verification & event deduplication
    - Order ingestion with atomic sequence, customer resolution, and inventory reservation
    - Scheduled / manual order reconciliation with date window recovery
    - One-way stock push with loop prevention (`lastPushedStock` check)
    - Store disconnection preserving historical orders, shipments, and ledger
- Frontend Shopeers UI (`apps/web`):
  - `/settings/integrations`: WooCommerce Store Gateway, Connect Store modal with SSRF firewall notices, live connection test, product catalog sync, and order reconciliation modal
  - Product & Variant Mappings tab with live search, status filters (`mapped`, `unmapped`, `ignored`), and quick-assign dropdown
  - Disconnect Store confirmation modal preserving historical records
  - Navigation Sidebar: Added `WooCommerce Store` direct navigation link

### Acceptance Gates & Tests
- 155 passing tests across entire monorepo (`packages/shared`: 68, `apps/api`: 82, `apps/worker`: 4, `apps/web`: 1)
- Gate 1: Replayed webhook creates no duplicate order and returns `duplicate_ignored`
- Gate 2: Invalid or tampered webhook signature rejected with `UnauthorizedException`
- Gate 3: Missed events recovered by scheduled or manual date-window reconciliation
- Gate 4: SSRF firewall blocks loopback, RFC 1918 private ranges, AWS metadata, and non-http schemes on store connection

---

## [M5] — 2026-10-14 — Courier Integration (Steadfast) + Courier Fraud Check + Tracking + COD Settlements

### Added
- Database Schema & DDL Migration (`packages/db/migrations/0007_courier_and_shipments.sql`):
  - Tables: `courier_accounts`, `shipments`, `shipment_events`, `cod_statements`, `cod_statement_allocations`
  - Strict RLS & `FORCE ROW LEVEL SECURITY` enabled on all 5 new tables
  - Append-only immutability enforced on `shipment_events` (`REVOKE UPDATE, DELETE`)
- Shared Courier Interfaces, Types & Authenticated Encryption (`packages/shared`):
  - `CourierAdapter` interface with capability flags (`cancel`, `track`, `fraud_check`, `webhooks`, `balance`)
  - Authenticated encryption (AES-256-GCM) with random IV and auth tags for securing courier credentials in DB
  - Credential masking utility (`maskCourierCredentials`) ensuring secrets are returned as `******`
  - Normalized shipment statuses (`pending`, `in_transit`, `out_for_delivery`, `delivered`, `partially_delivered`, `cancelled`, `returned`, `failed`, `unknown_pending_reconciliation`)
  - Terminal status transition protection logic (`canTransitionShipmentStatus`) preventing backward regressions
  - Permissions: `SETTLEMENTS_VIEW`, `SETTLEMENTS_MANAGE`
  - Zod validation schemas for courier accounts, shipments, and settlements
- Backend REST API (`apps/api`):
  - `SteadfastAdapter`: Official Steadfast API v1 integration (`/create_order`, `/status_by_cid/:cid`, `/status_by_trackingcode/:code`, `/get_balance`, `/fraud_check/:phone`)
  - `CouriersModule` (`/api/v1/couriers`):
    - Courier account management with AES-256-GCM encryption and masked secrets
    - Live connection test & balance retrieval
    - Order dispatch with unique `operation_id` duplicate prevention
    - Ambiguous network timeout detection setting `unknown_pending_reconciliation` (Gate 1)
    - Manual reconciliation endpoint (`/reconcile-unknown`) with `confirm_found` and `mark_cancelled`
    - Live tracking synchronization with terminal state immutability protection (Gate 2)
    - COD statement import, allocation breakdown, and reconciliation status management
  - `RiskModule` Integration:
    - Wired Steadfast courier fraud check directly into `RiskService.checkCustomerRisk` as primary source
    - Strict Gate 3 enforcement: courier provider timeout or error returns `provider_unavailable`, never `low`
- Frontend Shopeers UI (`apps/web`):
  - `/settings/couriers`: Courier Integration Gateway with connected accounts list, Add Steadfast Account modal, AES-256-GCM encryption banner, Test Connection button, and live wallet balance card
  - `/finances/settlements`: COD Settlement Statements dashboard with Net Settled / Deductions KPI summary cards, statement list, and Import Statement modal
  - `/orders/[id]`: Enhanced with Courier Dispatch card, Send to Steadfast button, Live Tracking sync button, Gate 1 Timeout Reconciliation banner & modal, Gate 2 Terminal Protection badge, and audit event timeline
  - Navigation Sidebar: Added `Courier Integration` and `COD Settlements` links

### Acceptance Gates & Tests
- 129 passing tests across entire monorepo (`packages/shared`: 53, `apps/api`: 71, `apps/worker`: 4, `apps/web`: 1)
- Gate 1: Ambiguous dispatch timeout sets status to `unknown_pending_reconciliation`, records audit event, and locks out duplicate dispatches
- Gate 2: Out-of-order tracking events cannot regress terminal statuses (`delivered`, `partially_delivered`, `cancelled`, `returned`)
- Gate 3: Courier fraud check provider failure or timeout returns `provider_unavailable` and never falls back to `low` risk
- Gate 4: Encrypted credentials are never exposed in any API response or log, always masked as `******`

---

## [M4] — 2026-10-13 — Printing + Risk Engine Shell

### Added
- Database Schema & DDL Migration (`packages/db/migrations/0006_printing_and_risk_engine.sql`):
  - Tables: `risk_rules`, `risk_rule_history`, `blacklist_entries`, `customer_risk_checks`, `documents`, `print_logs`
  - Columns added to `orders`: `risk_level`, `risk_score`, `risk_decision`, `risk_decided_by`, `risk_decision_reason`
  - Strict RLS & `FORCE ROW LEVEL SECURITY` enabled on all 6 new tables
  - Append-only immutability enforced on `risk_rule_history` and `print_logs` (`REVOKE UPDATE, DELETE`)
- Shared Types & Deterministic Risk Calculations (`packages/shared`):
  - Deterministic evaluation engine (`evaluateCustomerRisk`, `DEFAULT_RISK_RULES`)
  - Strict Acceptance Gate 1 rule: Insufficient data (< minEligibleOrders) or courier provider down NEVER returns "low"
  - Zod schemas: `updateRiskRulesSchema`, `createBlacklistEntrySchema`, `updateBlacklistEntrySchema`, `manualRiskReviewSchema`, `checkRiskInputSchema`, `createPrintLogSchema`, `generateDocumentSignedUrlSchema`, `verifySignedUrlSchema`
  - Permissions: `DOCUMENTS_VIEW`, `DOCUMENTS_PRINT`, `RISK_VIEW`, `RISK_MANAGE`, `RISK_OVERRIDE`
- Backend REST API (`apps/api`):
  - `RiskModule` (`/api/v1/risk`):
    - Settings with audit history snapshots (`/settings`, `/history`)
    - Blacklist & watchlist CRUD with normalized Bangladesh phone (`/blacklist`)
    - Live risk evaluation with TTL caching per normalized phone (`/check`)
    - Manager manual review & override with mandatory justification (`/orders/:id/review`)
    - Flagged orders review queue (`/review-queue`)
  - `DocumentsModule` (`/api/v1/documents`):
    - Cryptographically signed HMAC time-limited URLs with tenant scope (`/signed-url`)
    - Token verification with constant-time equality check (`/verify-token`)
    - Document metadata and rendering endpoint (`/render`)
    - Print audit logging (`/print-log`, `/print-logs`)
- Frontend Shopeers UI (`apps/web`):
  - `/print/[type]`: Print-ready view for Invoices and Packing Slips in A4 and 80mm POS Thermal formats, bilingual English/Bangla text, `@media print` layout, and automatic print logging
  - `/settings/risk`: Full Risk Engine configuration UI with 3 tabs: Threshold tuning & automation toggles, Blacklist & Watchlist management with modal drawer, and immutable Rule Revision Audit history
  - `/orders`: Risk Protection badge column (`low`, `medium`, `high`, `insufficient_data`, `manual_review_required`), row print icon button, and Bulk Print Invoices button
  - `/orders/[id]`: Print buttons in header (A4 Invoice, 80mm Receipt, Packing Slip), Risk & Delivery Shield card with 0-100 meter, live Re-evaluate button, and Manager Manual Review / Override modal
  - Sidebar: Direct navigation link to `Risk & Fraud Engine` (`/settings/risk`)

### Tests
- 114 passing tests across monorepo (`packages/shared`: 46, `apps/api`: 63, `apps/worker`: 4, `apps/web`: 1)
- Gate 1: Insufficient order count or courier provider failure strictly returns `insufficient_data` or `provider_unavailable`, never `low`
- Gate 2: HMAC signed URL expiry rejects expired tokens with `ForbiddenException`; cross-tenant scope access or signature tampering strictly rejected
- Verified blacklist match triggers high risk classification
- Verified risk check caching reuses valid records without re-querying order history
- Verified manual review & override updates order status and logs to `audit_logs`

---

## [M3] — 2026-10-12 — Orders & Customer Management (CRM)

### Added
- Database Schema & DDL Migration (`packages/db/migrations/0005_orders_and_crm.sql`):
  - Tables: `customers`, `customer_addresses`, `customer_tags`, `customer_tag_assignments`, `orders`, `order_sequences`, `order_items`, `order_status_history`
  - Strict RLS & `FORCE ROW LEVEL SECURITY` enabled on all 8 tables
  - Append-only status audit log enforcement: `REVOKE UPDATE, DELETE ON order_status_history`
  - Historical unit cost minor snapshot on `order_items.unit_cost_minor` preserving valuation
- Shared Types & Business Calculations (`packages/shared`):
  - Bangladesh address hierarchy (`BANGLADESH_DIVISIONS`, `BANGLADESH_DISTRICTS`, `getDistrictsByDivision`, `isValidBangladeshDistrict`)
  - Phone normalization helper with typed return (`normalizeBdPhone`)
  - Order state machine transitions (`ORDER_STATUSES`, `canTransition`, `ORDER_TRANSITIONS`)
  - Zod schemas: `createCustomerSchema`, `updateCustomerSchema`, `customerAddressInputSchema`, `createCustomerTagSchema`, `createOrderSchema`, `transitionOrderStatusSchema`, `cancelOrderSchema`, `holdOrderSchema`, `bulkOrderActionSchema`
- Backend REST API (`apps/api`):
  - `OrdersModule`: order catalog with filters, summary counts, detail view, atomic sequence order numbering (`ORD-1001`), duplicate order warning flag, state machine transitions, atomic stock reservation on `confirmed`, reservation release on `cancelled`, bulk operations (`/api/v1/orders`)
  - `CustomersModule`: customer profiles, phone lookup, addresses, customer tags (`/api/v1/customers`)
  - `GeoModule`: Bangladesh divisions and districts lookup (`/api/v1/geo`)
- Frontend Shopeers UI (`apps/web`):
  - `/orders`: KPI summary cards (Total, Pending, Confirmed, Shipped, Delivered, Cancelled), channel filter, status tabs, orders data table with duplicate alert badges, bulk actions, and **Quick Order Intake Drawer** (phone lookup, cascading division/district dropdowns, variant selector, delivery charges, immediate confirm switch)
  - `/orders/[id]`: Order detail header, status badges, action controls (Confirm, Hold modal, Cancel modal with reason), delivery address card, items breakdown, financial summary, and chronological status audit timeline
  - `/customers`: CRM customer table, high-value tags, delivered rate indicators, total lifetime spend, and customer edit slide-over drawer
  - Updated Sidebar navigation active route indicators for `/orders` and `/customers`

### Tests
- 95 passing tests across monorepo (`packages/shared`: 38, `apps/api`: 52, `apps/worker`: 4, `apps/web`: 1)
- Verified invalid state machine transitions rejected server-side
- Verified order cancellation releases stock reservation exactly once
- Verified cross-tenant order access returns 404 (NotFoundException)
- Verified duplicate order warning flag when customer phone matches orders within 24-hour window

---

## [M2] — 2026-10-12 — Products & Inventory Core

### Added
- Database Schema & DDL Migration (`packages/db/migrations/0004_products_and_inventory.sql`):
  - Tables: `warehouses`, `categories`, `brands`, `products`, `product_variants`, `product_bundles`, `inventory_movements`, `warehouse_stock_balances`, `stock_adjustments`
  - Strict RLS & `FORCE ROW LEVEL SECURITY` enabled on all 9 tables
  - `inventory_movements` append-only enforcement: `REVOKE UPDATE, DELETE ON inventory_movements`
- Shared Types & Business Calculations (`packages/shared`):
  - Bundle bottleneck availability calculator (`calculateBundleAvailability`)
  - Weighted average cost calculator with minor units precision (`calculateWeightedAverageCost`)
  - CSV formula-injection sanitizer (`sanitizeCsvCell`) protecting against `=`, `+`, `-`, `@`, `\t`, `\r`
  - Zod schemas: `createProductSchema`, `stockAdjustmentSchema`, `stockReservationSchema`, `stockReleaseSchema`, `csvImportBatchSchema` (5,000 max row cap)
- Backend REST API (`apps/api`):
  - `ProductsModule`: product catalog, variant matrix, bundle components, categories, brands (`/api/v1/products`)
  - `InventoryModule`: stock balances, low stock alerts, stock summary, immutable ledger history (`/api/v1/inventory`)
  - Atomic stock adjustments with live delta and reason (`/inventory/adjust`)
  - Atomic stock reservations with row-level locks (`FOR UPDATE`) and negative stock prevention (`/inventory/reserve`, `/inventory/release`)
  - Real-time ledger drift reconciliation endpoint (`/inventory/reconcile/:warehouseId/:variantId`)
- Worker Nightly Job (`apps/worker`):
  - `inventory.drift-check`: compares cached `onHand` against `SUM(inventory_movements.quantity)` and records anomaly audit logs
- Frontend Shopeers UI (`apps/web`):
  - `/products`: KPI summary cards, filter tabs, product table with expandable variants preview, New Product slide-over drawer with variant generator and bundle builder, Barcode printable modal
  - `/inventory`: KPI summary, Stock balances matrix, Immutable ledger history audit feed, Drift reconcile action, Stock adjustment slide-over drawer
  - Fully responsive, Light/Dark mode compatible, Royal Blue Shopeers theme

### Tests
- 75 passing tests across monorepo (`packages/shared`: 28, `apps/api`: 42, `apps/worker`: 4, `apps/web`: 1)
- Verified concurrent reservation race safety with atomic database row locks
- Verified negative stock prevention on adjustments and reservations
- Verified price changes do not alter historical inventory movements cost snapshots
- Verified ledger drift detection and nightly reconciliation job
- Verified CSV formula-injection defense and batch row limits

---

## [M1] — 2026-10-12 — SaaS Core (Auth, Tenants, Roles & Shopeers UI)

### Added
- Supabase Postgres connection via MCP (`quciaoulprvllskaqdfd`) with migrations `0001_initial_schema`, `0002_rls_policies`, `0003_roles_unique_indexes` applied
- System seeded data: 42 permissions, 5 system roles (`Owner`, `Admin`, `Order Staff`, `Inventory Staff`, `Accountant`), and 119 role-permissions
- NestJS API modules:
  - `AuthService` & `AuthController`: token verification, tenant onboarding with unique slug, getMe profile resolution, and tenant switching
  - `RolesService` & `RolesController`: system roles, tenant custom roles creation, permission assignment, and role deletion
  - `TeamService` & `TeamController`: staff listing, member invitations, role updates, and member removal
  - `TenantsService` & `TenantsController`: tenant settings management (name, timezone, currency)
- Security & Isolation:
  - Strict **Last-Owner Rule**: backend throws error if attempting to demote or remove the last active Owner of an organization
  - Cross-tenant custom role modification and deletion protection
  - `AuthGuard` extracting and validating Bearer tokens with active tenant membership
  - `PermissionsGuard` enforcing `@RequirePermissions(...)` on all protected endpoints
  - Audit logging for tenant onboarding, staff invites, role changes, and custom role updates
- Frontend Web (`apps/web`):
  - Shopeers B2B Analytics Dashboard design system with native Light Mode (`#F4F6F9`) and Dark Mode (`#0B0F17`)
  - Accent color: Electric / Royal Blue (`#2563EB`)
  - Pages: `/login`, `/register`, `/` (dashboard with KPI cards, spline profit chart, customer breakdown pills, best-selling table, day active bar chart, repeat customer gauge, AI assistant orb, and widget drawer), and `/settings/roles` (custom roles & dashboard visibility permissions checklist)
- Context Continuity:
  - Added `AI_CONTEXT.md` at root for AI model handoffs and immediate session onboarding

### Tests
- 48 passing tests across the monorepo (`packages/shared`: 16, `apps/api`: 30, `apps/worker`: 1, `apps/web`: 1)
- Verified Last-Owner demotion & removal protection (`apps/api/test/unit/team-service.test.ts`)
- Verified custom roles tenant isolation and system role immutability (`apps/api/test/unit/roles-service.test.ts`)
- Verified permissions guard endpoint authorization matrix (`apps/api/test/unit/permissions-guard.test.ts`)
- Verified onboarding and context switching (`apps/api/test/unit/auth-service.test.ts`)

---

## [M0] — 2026-10-10 — Foundations

### Added
- Monorepo scaffold: `apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/shared`
- pnpm workspaces + TypeScript strict mode + ESLint + Prettier
- Root `tsconfig.base.json`, `.gitignore`, `.prettierrc.json`
- `DECISIONS.md`, `SECURITY_AND_TESTING_RULES.md`, `ANTI_SLOP_UI_RULES.md`, `PROGRESS.md`
- `/docs/permission-matrix.md`, `/docs/erd-mvp.md`, `/docs/deployment.md`, `/docs/test-plan.md`
- `/docs/kpi-definitions.md` (template), `/docs/finance-policy.md` (template)
- Drizzle ORM + Drizzle Kit setup; migration working
- Tables: `tenants`, `users`, `tenant_memberships`, `roles`, `permissions`, `role_permissions`, `audit_logs`, `outbox_events`, `test_items` (test-only)
- RLS enabled + `FORCE ROW LEVEL SECURITY` on all tenant tables
- Dedicated app DB role (no BYPASSRLS, no superuser)
- `withTenant()` wrapper with transaction-local `set_config`
- `withPlatformAdmin()` — separate role, unused in M0
- `@growthomic/shared`: money utilities (paisa), order state machine, phone normalization, permission keys
- Unit tests for money, state machine, phone normalization
- NestJS API skeleton: `/api/v1/health`, request-ID middleware, error format, Zod validation pipe, CORS, JWT guard (stub)
- Worker skeleton: pg-boss + `system.ping` job; jobs without `tenant_id` rejected
- Next.js web skeleton: Tailwind + shadcn/ui + i18n (en/bn) + API client
- GitHub Actions CI: install, lint, typecheck, unit tests, RLS tests, secret scan, dependency audit, RLS-policy-presence check
- `.env.example` for each app with all variables documented
- Test folder structure per SECURITY_AND_TESTING_RULES.md §11.2

### Security
- All tenant tables have RLS + FORCE ROW LEVEL SECURITY
- App DB role created without BYPASSRLS
- No service-role key in frontend code or browser-accessible env
- `withTenant()` is the single entry point for all DB access

### Tests
- `packages/db/tests/rls/tenant-isolation.test.ts`: 8 RLS tests (cross-tenant read/write/insert/no-context/pooling/audit/worker/platform-admin)
- `packages/shared/src/__tests__/money.test.ts`: paisa arithmetic, rounding, PRD R.3 worked example
- `packages/shared/src/__tests__/order-state-machine.test.ts`: allowed/rejected transitions
- `packages/shared/src/__tests__/phone.test.ts`: BD phone normalization
- `apps/api/test/unit/health.test.ts`: health endpoint

---

_Older entries will appear above as milestones are completed._
