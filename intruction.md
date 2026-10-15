# GROWTHOMIC INVENTORY & BUSINESS OS — PRD v2.0
**Type:** Product Requirements + Functional Spec + Technical Architecture + Build Plan
**Category:** Multi-tenant, subscription-based SaaS
**Initial market:** Bangladesh e-commerce (Facebook/Instagram/WhatsApp sellers, WooCommerce/Shopify/custom sites)
**Build method:** Vibe-coded with AI coding tools, in small verifiable milestones
**Changes from v1:** MVP-first scope, re-ordered phases (courier + fraud early), decided architecture (separate frontend/backend/worker), decided money/ledger/RLS strategy, Bangladesh-specific requirements, printing, bundles, notifications, import/onboarding, retention, plan-downgrade rules, order state machine, outbox events, aggregates, feature flags, optional AI module.

---

# PART A — HOW TO USE THIS DOCUMENT (VIBE-CODING RULES)

These rules are mandatory for the AI coding tool and the human reviewing it.

1. **Build one milestone at a time** (Part N). Never ask the AI to "build the whole system."
2. **Before each milestone:** the AI must restate scope, list the tables/endpoints/screens it will touch, and wait for approval.
3. **After each milestone:** run the milestone's acceptance tests. Do not start the next milestone until they pass.
4. **Never use mock data in production paths.** Mock data is allowed only in clearly named `/mocks` for UI prototyping.
5. **Business logic lives in the backend only.** The frontend never calculates money, stock, status transitions or permissions as the source of truth.
6. **Any change touching money, stock or tenant isolation requires a written test first.**
7. **Keep a `DECISIONS.md`** in the repo. Every decision in Part B is copied there and not changed without an entry.
8. **Keep a `CHANGELOG.md` and `.env.example`** updated per milestone.
9. If the AI is unsure about a provider API (courier, payment gateway, WooCommerce), it must read the provider's current official documentation and must not guess endpoints or fields.
10. **`SECURITY_AND_TESTING_RULES.md` (repo root) is binding.** The AI must read it before every milestone, list the applicable sections in its pre-coding plan, and output the Completion Report (its Section 12) at the end of every milestone.
11. The AI must never disable, skip or weaken a security control or a test to make something pass.
13. **`ANTI_SLOP_UI_RULES.md` (repo root) is binding for all UI work.** The owner's reference images in `/design/reference/` are the design source of truth. Before building any UI the AI must produce `/docs/design-spec.md` from the references, get owner approval, and implement it as design tokens. If no reference exists the AI must ask for one instead of guessing a style. Every UI task ends with screenshots (1440/768/390, English + Bangla) and the Slop Checklist.
12. **`PROGRESS.md` (repo root) is the build tracker.** The AI must read it at the start of every session, work only on the first milestone that is not fully complete, and tick an item `[x]` only after its code, tests, authorization, tenant isolation and docs are verified (with evidence on the same line). It updates the "Current Status" block and "Session Log" at the end of every session. New requirements discovered during work are added as unchecked items, never silently built.

---

# PART B — FINAL ARCHITECTURE DECISIONS (LOCKED)

| # | Decision | Choice |
|---|----------|--------|
| B1 | Deployment layout | **Three separately deployed units:** Frontend, Backend API, Worker |
| B2 | Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, deployed on Vercel. **Calls only the Backend API.** No direct DB queries from the frontend. |
| B3 | Backend API | Node.js + TypeScript (NestJS or Fastify), deployed on Railway / Render / Fly.io as a long-running service. REST, versioned `/api/v1`. Zod (or class-validator) for all input. |
| B4 | Worker | Same codebase as backend (shared packages), separate process/service. Runs queues, scheduled jobs, webhook processing, sync, exports. |
| B5 | Database | Managed PostgreSQL on **Supabase**. Backend accesses it through **Drizzle ORM** with **Drizzle Kit** migrations (LOCKED). RLS policies and other raw SQL live inside Drizzle migration files. No schema changes outside migrations. |
| B6 | Auth | Supabase Auth (or equivalent). Backend verifies the JWT on every request. Tenant membership/roles are stored in our own tables. |
| B7 | Queue | Start with **pg-boss** (Postgres-backed, no extra infra). Move to Redis/BullMQ only if load requires it. |
| B8 | Money | **Integer minor units (paisa) stored as BIGINT.** Currency column on every money row. No floats anywhere. UI formats to ৳. |
| B9 | Ledger | **Simple single-entry transaction ledger for MVP**, with schema designed so double-entry can be added later (see §13.7). |
| B10 | Tenant isolation | PostgreSQL RLS **plus** server-side checks (defense in depth). See Part C. |
| B11 | Source of truth for stock | SaaS inventory ledger. Website sync is **one-way (SaaS → website)** in MVP. |
| B12 | Events | Transactional outbox pattern for order/stock/shipment/payment events. |
| B13 | Plan limits | Feature flags + entitlements table; never hard-coded in the frontend. |
| B14 | Languages | UI: English + Bangla (i18n from day one). |
| B15 | Timezone | Tenant timezone default `Asia/Dhaka`; timestamps stored UTC. |
| B16 | Tax | Tax-exclusive in MVP; schema keeps `tax_amount` columns (default 0) for future. |

**Environment layout:** `dev`, `staging`, `production`, each with its own database, secrets and queue. Staging must be used to test integrations before production.

**Repository layout (recommended monorepo):**
```
/apps/web        (frontend)
/apps/api        (backend)
/apps/worker     (worker)
/packages/db     (schema, migrations, tenant-safe db wrapper)
/packages/shared (types, zod schemas, enums, money utils, state machines)
```

---

# PART C — MULTI-TENANT ISOLATION & RLS STRATEGY (CRITICAL)

## C.1 Rules
1. Every tenant-owned table has `tenant_id UUID NOT NULL` and an index starting with `tenant_id`.
2. The application connects to the database with a **non-superuser role that does NOT have `BYPASSRLS`**. The Supabase `service_role` key must never be used for normal tenant requests and must never reach the browser.
3. Every request and every job runs inside a transaction that begins with:
   `SELECT set_config('app.tenant_id', '<validated tenant uuid>', true);`
   (the `true` = transaction-local, so connection pooling cannot leak context).
4. RLS policy pattern on every tenant table:
   `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)` and the same in `WITH CHECK`.
5. If `app.tenant_id` is not set, queries must return zero rows (policy fails closed).
6. **Single entry point:** all DB access goes through a `withTenant(tenantId, userId, fn)` wrapper in `/packages/db`. Direct pool usage in feature code is forbidden (enforced by lint rule / code review).
7. **Workers:** every job payload contains `tenant_id`. The worker uses the same `withTenant` wrapper. A job with no valid `tenant_id` is rejected and sent to the dead-letter queue.
8. **Platform Super Admin** uses a separate DB role and separate API namespace (`/api/v1/platform/*`). Access to tenant business data by platform staff is off by default, requires a time-limited, reason-recorded support grant, and is audit-logged.
9. Never trust a client-submitted `tenant_id`. Tenant is resolved from the authenticated user's membership (and an active-tenant header validated against membership).

## C.2 Required tests (run in CI)
- Tenant A cannot read, update or delete Tenant B rows by direct ID, list, search, export or report.
- Query without `app.tenant_id` returns nothing.
- Worker job with wrong/missing tenant is rejected.
- Pooled-connection reuse does not leak tenant context.
- Platform admin cannot read tenant business tables without an active support grant.

---

# PART D — PRODUCT VISION & PRINCIPLES

## D.1 Vision
A centralized, multi-user, subscription-based Inventory and Business Management SaaS. A business owner connects stores and social channels, imports products and orders, confirms orders, runs risk checks, ships via couriers, tracks COD and returns, manages customers and stock, and sees real profit — from one place.

## D.2 Core objectives
1. Centralize orders from websites, social channels (Facebook/WhatsApp/Instagram) and manual entry.
2. Sync catalogs and stock with connected websites (one-way first).
3. Accurate stock via an inventory ledger.
4. Courier integration (Steadfast first, then Pathao, RedX).
5. Practical customer risk checks using real, permitted data.
6. Returns, return costs and COD settlement reconciliation.
7. CRM.
8. Sales, COGS, gross profit, operating profit.
9. Suppliers, purchases, expenses, (later) payroll.
10. Receivables and payables.
11. Analytics.
12. Monetization via subscriptions.
13. Platform Super Admin panel.

## D.3 Principles (mandatory)
- Financial calculations are deterministic code, never AI-generated.
- Stock changes are traceable through the ledger.
- Historical order costs/prices never change when current product prices change.
- Every record belongs to a tenant.
- Integration failures are recoverable without duplicate orders or shipments.
- Financial records keep audit history; posted records are corrected via reversal/adjustment entries.
- Operational status, payment status, shipment status and return status are **separate fields**.
- All permissions are enforced on the server.
- Thresholds are configurable, never hard-coded.

---

# PART E — SCOPE: MVP vs LATER

## E.1 MVP (Release 1) — must be shippable and sellable
1. Auth, tenants, memberships, roles/permissions, audit log.
2. Products, variants, bundles, warehouses (single default warehouse UI), inventory ledger, reservation, adjustments, low-stock alerts.
3. Orders: manual + social-source + WooCommerce import; state machine; cancellation/hold reasons; timeline.
4. Customers/CRM basics + tags + duplicate-phone handling.
5. Risk checker v1 using the **courier's built-in fraud checker** (primary) + own order history + manual blacklist.
6. Courier: Steadfast first (including its fraud check); shipment creation, tracking, duplicate prevention; Pathao second.
7. Returns (receive, inspect, restock/damage).
8. COD settlement reconciliation (basic).
9. Printing: invoice, packing slip, courier label, barcode (bulk print).
10. Notifications: in-app + email; SMS/WhatsApp order confirmation (credit-based).
11. Basic expenses + simple P&L + dashboard KPIs.
12. Subscription plans (manual bKash/Nagad payment verification + gateway where available), plan enforcement, Super Admin panel (basic).
13. CSV import for onboarding (products, customers, historical orders).
14. Bangla + English UI.

## E.2 Release 2
Purchases & suppliers (full GRN), supplier returns, recurring bills, receivables/payables, advanced analytics, Shopify connector, RedX, warehouse transfers (multi-warehouse UI), AI assistant module (Part M).

## E.3 Release 3
Payroll/attendance, loans, cash-flow reports, custom API connector for third parties, two-way stock sync, marketing analytics (ROAS/CAC), double-entry ledger migration, advanced customer analytics.

> Everything not in the MVP list stays in the schema roadmap but is **not built** until its release. The AI tool must not build Release 2/3 modules during the MVP.

---

# PART F — USERS, ROLES & PERMISSIONS

## F.1 Platform level
**Platform Super Admin** (separate app area, separate auth rules): manage tenants, plans, pricing, limits, subscription payments (including manual payment verification), grace periods, suspension/reactivation, system health, integration failure monitoring, maintenance notices, support requests, platform audit logs. No default access to tenant business data (see C.1.8).

## F.2 Tenant level
Roles: **Owner**, **Admin/Manager**, **Order Staff**, **Inventory Staff**, **Accountant**, **Custom roles** (owner-defined, granular permissions).

Permission model: `resource.action` strings (e.g. `orders.confirm`, `orders.cancel`, `inventory.adjust`, `finance.view`, `finance.export`, `payroll.view`, `settings.integrations`). Roles map to permission sets. The server checks the permission on every endpoint. A permission matrix must be produced in Phase 0 and kept as a seed file.

Additional controls: session management, revoke access, invitation expiry, activity logs.

## F.3 Soft ownership rules
- A tenant must always have at least one Owner.
- Owner transfer is an explicit, logged action.
- Staff removal revokes sessions immediately.

---

# PART G — NAVIGATION

Dashboard · Orders · Products & Inventory · Customers · Shipments & Couriers · Returns · Finance (Sales/P&L, Expenses, Settlements; later: Payables/Receivables, Payroll, Cash flow) · Purchases & Suppliers (R2) · Analytics & Reports · Notifications · Team & Permissions · Settings · Subscription & Billing.

Platform Admin is a separate area with separate authorization.

---

# PART H — DASHBOARD

Filters: Today, Yesterday, 7d, 30d, This/Last Month, This Year, Custom; Store, Courier, Warehouse.

**KPI definitions must be documented in code comments and in a `/docs/kpi-definitions.md`** (what each card includes/excludes).

MVP KPIs: Gross Order Value, Net Sales (delivered), Gross Profit, Operating Expenses, Net Operating Profit, Total/Pending/Confirmed/On-Hold/Shipped/Delivered/Cancelled/Delivery-Failed/Returned orders, High-Risk orders, Courier exceptions, Failed syncs, Pending returns, Low-stock/out-of-stock, Inventory valuation, Outstanding COD with couriers.

Charts: sales & profit trend, daily orders, status distribution, delivery/cancel trend, top products, courier performance, expense categories.

Activity feed: order/stock/shipment/return/expense/integration events with timestamp and actor.

**Performance rule:** dashboards read from **pre-aggregated daily tables** (`agg_daily_sales`, `agg_daily_orders`, `agg_daily_inventory`, …) updated by worker jobs and event handlers, not live scans of big tables. Aggregates are rebuildable from source data (a `rebuild` job per tenant/date range).

---

# PART I — INTEGRATIONS

## I.1 Order sources
`website_woocommerce`, `website_shopify` (R2), `custom_api` (R3), `manual`, `social_facebook`, `social_instagram`, `social_whatsapp`, `growthomic_ai` (chat-originated, see Part M), `import`. Every order stores its source and (if applicable) campaign/ref.

## I.2 Website connection workflow (WooCommerce first)
1. Settings → Integrations → Add Website → choose platform.
2. Enter URL + credentials (WooCommerce REST keys).
3. Validate connection and scopes.
4. Import/map products and variants.
5. Import eligible orders (date window selectable).
6. Show sync progress, status and errors.

Secrets are encrypted at rest (envelope encryption or KMS-backed key), never returned to the browser, never logged.

## I.3 Product sync & mapping
Import external product/variant IDs, name, SKU, barcode, images, category, price, status, attributes, website stock, last sync time. Map to internal products; never auto-merge on ambiguous SKU/name match; manual mapping UI; store-specific SKUs allowed.

## I.4 Order sync
Import external order ID/number/date, customer name/phone/email, addresses, items (product/variant IDs), qty, price, discount, shipping, total, payment method/status, source status, notes. Unique constraint: `(tenant_id, store_id, external_order_id)`. Repeat deliveries upsert, never duplicate.

## I.5 Webhooks & reconciliation
Signature verification · event persistence (`integration_events`) · dedupe key · retry with backoff · scheduled reconciliation (e.g. every 15 min, window-based) · failed-event log · manual resync · connection health indicator. Never assume exactly-once delivery. Webhook endpoints must return quickly (persist event, enqueue job, respond).

## I.6 Stock sync policy (MVP)
- **One-way: SaaS available stock → website.** Website stock changes are ignored for authority but logged as conflicts if they differ.
- Per-store toggle for stock push; push is debounced and queued; each push has an idempotency key; avoid loops by tagging updates originated by us.
- Two-way sync is Release 3 and needs a written conflict-resolution rule first.

## I.7 Disconnecting a store
Never deletes orders, shipments or financial records.

## I.8 Custom API (R3)
Authenticated REST, API keys/OAuth, webhook docs, rate limits, versioning, request IDs, error format, logs. No direct DB access for third parties.

---

# PART J — ORDER MANAGEMENT

## J.1 Statuses (separate dimensions)
- **order_status:** `pending, confirmed, on_hold, cancelled, processing, ready_to_ship, shipped, delivered, delivery_failed, returned, closed`
- **payment_status:** `unpaid, partially_paid, paid, cod_pending, cod_collected, refunded, partially_refunded`
- **shipment_status:** `none, created, picked_up, in_transit, delivery_attempted, delivered, failed, return_initiated, return_in_transit, returned_to_origin, cancelled`
- **return_status:** `none, requested, in_transit, received, inspected, completed`
- **risk_status:** separate (see Part K).

## J.2 Order state machine (server-enforced)
Transitions are defined in a single shared module (`/packages/shared/order-state-machine`) and a DB transition table; invalid transitions are rejected with a clear error. Every transition writes `order_status_history` (previous, new, reason, note, actor, timestamp, related stock movement, related shipment action).

| From | Allowed To |
|------|-----------|
| pending | confirmed, on_hold, cancelled |
| confirmed | processing, on_hold, cancelled |
| on_hold | confirmed, cancelled |
| processing | ready_to_ship, on_hold, cancelled |
| ready_to_ship | shipped, on_hold, cancelled |
| shipped | delivered, delivery_failed, returned (via return flow) |
| delivery_failed | shipped (re-attempt), returned |
| delivered | returned (customer return), closed |
| returned | closed |
| cancelled | (terminal; reopen only by explicit authorized "reopen" creating a history entry) |

Notes: courier events drive shipment_status; shipment_status changes **propose** order_status changes through the same state machine (never bypass it). Late/out-of-order courier events must not move an order backwards.

## J.3 Order list
Columns: internal ID, external number, customer, phone, store/source, date, product summary, amount, payment status, order status, risk level, courier, tracking, assigned staff, last updated. Search (ID, phone, name, tracking), filters (status, store, source, date, courier, risk, staff), server-side pagination/sort, bulk actions (permission-gated), export, saved filters.

## J.4 Manual & social order creation
Fields: customer name/phone/address (with Bangladesh address hierarchy, see Part O), product/variant/bundle, qty, unit price, discount, delivery charge, payment method/status, note, source (incl. Facebook/WhatsApp/Instagram), optional campaign/reference/assigned staff. Search existing customers by normalized phone; select or explicitly create. **Duplicate-order detection:** same normalized phone + same items within a configurable time window → warning.

## J.5 Confirmation rules
On confirm: validate customer/address; validate availability; check duplicates; run risk check; reserve stock; record action; update timeline; show next action. Risk flag ≠ fraud. If tenant requires manual review for high-risk, the order cannot progress until an authorized user records a decision.

## J.6 Cancel / hold
Reason required (predefined list + "Other" requiring note). On cancel: release reservation (once), handle shipment cancellation according to courier capability (do not assume success), log everything.

## J.7 Order edit
Sections: customer, items (with cost snapshot), financials, shipment, risk, timeline. Unshipped orders editable per permission. After shipment creation, changes to items/qty/address/COD trigger a validation and a shipment modify or cancel-and-recreate workflow. Delivered-order corrections use adjustment/reversal entries — never silent rewrites.

## J.8 Stock reservation
`available = on_hand − reserved`. Atomic reservation using row-level locking or conditional `UPDATE ... WHERE available >= qty` inside a transaction. Tenant-configurable reservation point (default: at confirmation). Physical deduction at dispatch (when shipment is created/handed over — documented, configurable). Reservation expiry and failed fulfillment release reservations. **Negative stock is not allowed** unless a tenant explicitly enables backorder mode.

## J.9 Bulk operations
Confirm, assign, tag, hold, cancel (reason), export, run risk checks, create shipments. Return per-order success/failure results; never report blanket success.

## J.10 Order numbering
Per-tenant prefix + sequential counter (gap-safe, race-safe).

---

# PART K — CUSTOMER RISK CHECKER (REALISTIC V1)

## K.1 Data sources
**Primary source: the courier's own built-in fraud/delivery-history checker** (the customer's delivery success/cancel/return statistics provided by the courier account the tenant has connected, e.g. Steadfast). This is called through the courier adapter (`checkCustomerRisk(phone)`), using the tenant's own connected courier credentials.

Supporting sources (combined with the courier result, shown separately):
1. Tenant's own order history (delivered/cancelled/failed/returned by normalized phone).
2. Tenant-managed blacklist/watchlist (manual entries with reason, who added, when).
3. Authorized third-party fraud-check providers (Release 2+), pluggable via adapter.

Rules:
- The developer must read each courier's current official API documentation to confirm the exact fraud-check endpoint, authentication, response fields and rate limits before implementing it. Do not guess endpoints or fields.
- If a courier does not offer a fraud check, the system falls back to own history + blacklist and marks the result's data confidence accordingly.
- Courier fraud-check calls are rate-limited, cached for a configurable period per normalized phone (to avoid repeated calls/costs), and logged with source and timestamp.
- Never scrape or buy unauthorized personal data. Source and confidence are stored with every check.

## K.2 Metrics (when data exists)
Eligible orders, delivered, cancelled, failed, returned, success rate, cancellation rate, return rate, last activity, data source, confidence, check time. Internal and external stats stay separate.

## K.3 Phone normalization
Normalize BD numbers (`01XXXXXXXXX`, `+8801…`, `8801…`, spaces/dashes) to one canonical format (E.164 `+8801XXXXXXXXX`). Validate operator prefixes. Reject/flag invalid numbers. Normalized value is the matching key.

## K.4 Rules (configurable per tenant)
Minimum eligible orders, cancellation threshold, delivery-failure threshold, return threshold, blacklist hit behavior, insufficient-data handling, manual-review policy, auto-flag rules.

## K.5 Statuses & decisions
`not_checked, checking, low, medium, high, insufficient_data, provider_unavailable, manual_review_required`. Insufficient data ≠ fraud. Provider failure never silently returns "low". Red/amber/green with the triggering rule explained. Authorized users can override with a mandatory reason. All checks timestamped; rule changes versioned in history.

---

# PART L — COURIER & SHIPMENTS

## L.1 Adapter architecture
Common `CourierAdapter` interface: `validateCredentials, createShipment, getShipment, trackShipment, checkCustomerRisk?, cancelShipment?, getRates?, getAreas?, getSettlements?, parseWebhook?`. Each adapter declares its **capability flags** (supports cancel? webhooks? area IDs? bulk?). Build order: **Steadfast → Pathao → RedX**. The AI tool must verify each provider's current API docs, auth, limits and webhook support before coding the adapter.

## L.2 Settings
Multiple accounts per tenant; encrypted credentials; test connection; enable/disable; sender info; pickup location; default service; integration logs; disconnect.

## L.3 Send-to-courier workflow
Eligible order → pick courier → review/edit shipment fields (name, phone, address, area/zone, weight, description, COD amount, delivery charge, instructions) → server validates status/permission → check existing shipment → create unique internal `operation_id` → call provider → store raw response → record tracking/consignment → update shipment status → timeline entry.

## L.4 Duplicate-shipment prevention
Unique `operation_id` per attempt; idempotency key where supported; request/response logging; retry classification (retryable vs not); **on timeout or ambiguous result, status becomes `unknown_pending_reconciliation` and the system queries the provider (by invoice/reference) before any retry**; manual recovery screen for unresolved cases. Unique constraint: one active shipment per order+courier.

## L.5 Tracking
Normalized statuses with original provider status retained. Webhooks where supported + polling fallback. Out-of-order events are ordered by provider timestamp and never regress a terminal state.

## L.6 Charges
Store separately: base fee, COD fee, return fee, extra fees, other, actual settlement deduction, customer-paid delivery charge, business-absorbed cost. Estimated ≠ actual.

## L.7 COD settlement reconciliation
Batch settlement records allocated across shipments. Track expected COD, expected deduction, expected net, actual settled, date, provider reference, difference, status (`pending, partially_settled, settled, disputed, reconciled`). Support CSV import of courier settlement statements as a fallback when API is unavailable.

---

# PART M — AI-ASSISTED MODULE (OPTIONAL, RELEASE 2) — GROWTHOMIC INTEGRATION

Purpose: connect Growthomic's chat automation (Facebook/Instagram/WhatsApp) to this OS.

Features:
- **Chat → draft order:** AI extracts customer name, phone, address, items, quantity from a conversation and creates an order in `pending` with source `growthomic_ai` and a link to the conversation. A human confirms.
- **Address cleanup:** normalize free-text Bangla/Banglish addresses to district/thana/area suggestions (human-verifiable).
- **Risk explanation:** generate a plain-language explanation of why an order was flagged (explanation only, the flag itself is rule-based).
- **Stock-aware replies:** Growthomic can query available stock and product price via a read-only API.

Hard rules:
- AI never computes or changes ledger balances, stock quantities, salaries, profit/loss.
- AI-created records are always marked `created_by = ai` and require human confirmation before reservation/shipment.
- Integration uses a scoped API key per tenant with least-privilege permissions and rate limits.

---

# PART N — PRODUCTS & INVENTORY

## N.1 Catalog
Product: ID, name, SKU, barcode, description, images, category, brand, supplier refs, status, default price, default cost, low-stock threshold. Variants (size/color/model) each with own SKU, barcode, stock identity and cost.

## N.2 Bundles/Combos
`bundle` product type = a set of component variants with quantities. Selling a bundle reserves/deducts **component stock** (not bundle stock). Bundle price may differ from component sum; COGS = sum of component costs. Bundle availability = min over components of floor(component_available / qty).

## N.3 Price lists
Default price + optional price lists (e.g., Retail, Wholesale, Reseller) per variant; customer/tag can be linked to a price list; order line stores the actual price used.

## N.4 Stock ledger
Immutable `inventory_movements` (append-only). Types: opening, purchase_receipt, fulfillment_deduction, reservation, reservation_release, customer_return_receipt, supplier_return, adjustment, damaged, transfer_out, transfer_in, approved_correction. Fields: tenant, variant, warehouse, type, quantity (signed), reference type/id, date, actor, reason, cost basis, created_at. `warehouse_stock_balances` is a derived/cached table updated **in the same transaction** as the movement; a nightly job verifies balance = SUM(ledger) and alerts on drift.

## N.5 Adjustments
Variant, warehouse, system qty, counted qty or delta, reason, note, actor, timestamp. Never overwrites history. Large adjustments can require approval (configurable).

## N.6 Low stock & reorder
Min stock, reorder point, suggested qty, preferred supplier, lead time. Alerts in-app/email. Purchase suggestions never auto-create POs without approval.

## N.7 Valuation
MVP: **Weighted Average** per tenant (locked once transactions exist). FIFO is Release 3 and needs a migration plan. Order costs are snapshotted at fulfillment; never use the current product cost for past orders.

## N.8 Import/export
CSV/Excel with column mapping, validation preview, duplicate detection, error report, partial import, import history, async processing for large files.

## N.9 Barcodes
Generate and print variant barcodes (Code128/EAN-compatible), scan-to-find on product search and packing screens.

---

# PART O — BANGLADESH-SPECIFIC REQUIREMENTS

1. **Bangla UI:** full i18n (en/bn); numerals/date formats switchable; Bangla fonts in print outputs.
2. **Address hierarchy:** Division → District → Upazila/Thana → Area, from a maintained dataset; free-text fallback. Courier area/zone ID mapping table per courier (`courier_area_mappings`) so shipments carry valid courier area IDs.
3. **Currency:** BDT (৳) formatting, Indian-style grouping optional (lakh/crore) setting.
4. **Phone:** normalization per K.3.
5. **Invoices/receipts:** bilingual (Bangla/English) templates.
6. **Payments for SaaS subscriptions (realistic):**
   - Primary: **manual payment submission** (bKash/Nagad/Rocket/bank transfer with TrxID + screenshot) → platform admin verifies → plan activated.
   - Gateway option: SSLCommerz / AamarPay / bKash PGW **one-time payments per billing cycle** with server-side verification (recurring auto-debit only if the chosen provider actually supports it for the merchant — verify first).
   - Renewal flow: reminder (7d/3d/1d) → invoice → pay → verify → renew; grace period if unpaid.
7. **Social-commerce reality:** many orders originate in Facebook/WhatsApp chats — quick-order screen optimized for mobile and fast entry; order source tracking; customer chat link/reference field.
8. **COD-first:** COD fields, COD fee, COD settlement are first-class.
9. **Festival/peak load:** queue and rate-limit design must tolerate order spikes (Eid, sales campaigns).

---

# PART P — RETURNS

Types: customer return, failed-delivery return, return-to-origin, partial, full, supplier return (R2).

Workflow: return event/request → link to order/shipment → record status → warehouse physically receives → inspect → record sellable/damaged/missing → update inventory → record refund/payment adjustment → allocate return costs → complete.

Rules: a courier "returned" notification does not mean stock received or sellable. Track separately: original delivery cost, return delivery cost, packaging loss, handling cost, damaged product cost, refund, recoverable customer charge, courier compensation. Avoid double-counting costs. Customer delivery-charge paid/unpaid is a financial state backed by transactions.

Reports: return rate/cost/reasons, courier-wise, product-wise, damaged stock, recoverable charges, outstanding refunds.

---

# PART Q — CRM

Profile: ID, name, normalized phone, email, addresses, notes, tags, first/last order, counts (total/delivered/cancelled/returned), net purchase value, due balance. Tenant-scoped.

Tags: create/edit/remove, multiple per customer, filter, bulk assign, segmentation. Tags are separate from system risk status.

Timeline: orders, payments, returns, refunds, notes, contact attempts, tag changes, risk checks, status changes.

Duplicates: suggest matches by normalized phone/address; never auto-merge ambiguous identities; merges are authorized, logged, and reversible where practical.

Metrics (with documented windows): order frequency, repeat rate, LTV, AOV, delivery success, cancellation, return rate.

---

# PART R — FINANCE ENGINE

## R.1 Core
Deterministic, auditable, independent of the UI. Formulas live in code with unit tests. AI never produces authoritative numbers.

## R.2 Revenue recognition (default policy)
Recognize product sales **at delivery**. Pending/cancelled/undelivered orders are not sales. Cash collection and courier settlement are separate events.

## R.3 Formulas
- Net Product Sales = product subtotal − discounts − recognized reversals
- Gross Profit = Net Sales − COGS
- Contribution After Order Costs = Gross Profit − direct order-level costs (courier, packaging, COD fees, absorbed delivery, return logistics)
- Operating Profit = Gross Profit − operating expenses ± other operating items
- Net Cash Movement = actual inflows − actual outflows
Accrual-based profit and cash-basis movement are never mixed in one figure.

Worked example (kept as a unit test): sales ৳1,000, discount ৳50, cost ৳500, acquisition ৳30, courier ৳80, packaging ৳20 → Net Product Sales ৳950; Gross Profit ৳420; Contribution ৳320. (Stored as paisa integers.)

## R.4 Cost snapshot
At fulfillment store unit price, unit cost, qty, discount allocation, acquisition cost, costing-method reference, recognition date.

## R.5 Ledger (single-entry now, double-entry-ready)
`financial_transactions`: tenant, id, type, date, **amount_minor (BIGINT, positive)**, currency, **direction (in/out)**, **account_id (nullable now, used later)**, category, reference type/id, payment method, status, created_by, approved_by, created_at, reversal_of/adjustment_ref. Posted rows are immutable; corrections via reversal + new entry. A future migration may add `financial_transaction_lines` for double-entry without changing existing rows' meaning.

## R.6 Categories
Sales, COGS, order-level costs, operating expenses, other items (receivables, payables, courier settlement receivables, loans, owner contributions/withdrawals, transfers, refund liabilities). Each has a documented treatment in `/docs/finance-policy.md`.

## R.7 Reporting
Daily/weekly/monthly/quarterly/yearly/custom; tenant timezone; historical reports stable (snapshot-based). Tax excluded in MVP.

## R.8 Expenses (MVP) & Recurring bills (R2)
One-time expenses: category, amount, date, description, payment status/method, reference, receipt attachment, creator, approval. Recurring bill rules generate **draft** expenses for owner approval; amount changes never alter finalized periods.

---

# PART S — PURCHASES & SUPPLIERS (RELEASE 2)

Supplier directory; PO (draft → pending approval → approved → partially received → received → cancelled); a PO does **not** increase stock. GRN records received/rejected/damaged qty, warehouse, date, attachments; only accepted qty increases stock. Acquisition cost allocation (quantity- or value-based), no double counting with opex. Supplier credit/due tracking. Supplier returns with stock deduction and credit/refund.

---

# PART T — STAFF, PAYROLL, RECEIVABLES/PAYABLES, LOANS (RELEASE 2–3)

Keep v1 functional definitions (salary types monthly/daily/hourly; configurable deduction basis; attendance; approved overtime; manual adjustments with reason; payroll workflow select→calculate→review→approve→finalize→pay; finalized payroll never silently recalculated; corrections via adjustments).
Receivables/payables: derived outstanding = original − allocated payments; partial payments; no over-allocation without advance-credit flow; due reminders and aging.
Loans: principal not revenue/expense; interest and principal handled separately.

---

# PART U — PRINTING & DOCUMENTS (MVP)

- **Invoice** (A4 + thermal/80mm), bilingual, tenant branding.
- **Packing slip.**
- **Courier label/consignment sheet** (with barcode/QR of tracking ID).
- **Barcode labels** for variants.
- **Bulk print** from the order list (select orders → single PDF).
- Generated server-side (HTML→PDF or a PDF library), stored in object storage with expiring signed URLs, async for large batches.
- Print events logged (who printed what, when).

---

# PART V — NOTIFICATIONS

Channels: in-app, email (MVP), SMS and WhatsApp (MVP for order confirmation/dispatch/delivery messages to customers; provider-adapter based).

Rules:
- **Cost model:** SMS/WhatsApp are credit-based per tenant (`message_credits` ledger); plans include a monthly credit allotment; top-up supported; messages blocked (with a clear UI warning) when credits are exhausted.
- Provider adapters (Bangladesh SMS gateways; WhatsApp Business API provider) selected after verifying current availability, sender-ID registration and template-approval requirements.
- Templates per event (order confirmed, shipped, delivered, return received, payment due) in Bangla/English with variables; opt-out/consent tracking per customer; delivery status logging; retries with backoff; rate limits.
- Internal alerts: low stock, new order, high-risk order, courier failure, failed sync, overdue dues, subscription payment issues.
- Notification preferences per user.

---

# PART W — ONBOARDING & DATA MIGRATION (MVP)

- **Setup wizard:** company info → timezone/currency → warehouse → connect store → connect courier → import products → import customers → import historical orders → invite staff.
- **CSV import templates** for products/variants (with opening stock), customers, historical orders, suppliers. Each import: mapping, validation preview, duplicate handling, dry-run mode, error report, import history, **undo for the last import batch** where practical.
- Opening stock goes through the ledger as `opening` movements.
- Historical imported orders are flagged `imported` and excluded from live reservation/stock logic unless the user opts in.
- Sample demo data option (clearly marked and deletable).

---

# PART X — SUBSCRIPTIONS, BILLING & PLAN ENFORCEMENT

## X.1 Plans & entitlements
Configurable by the platform owner: name, monthly/annual price, active flag, trial, limits (stores, monthly orders, staff, warehouses, couriers, API calls, message credits, storage) and **feature flags** (e.g., `ai_module`, `payroll`, `shopify`, `custom_api`, `advanced_analytics`). Enforcement reads the `plan_entitlements` table server-side; nothing is hard-coded in components.

## X.2 Usage tracking
Define which events count (e.g., an order counts when created/imported once; duplicate webhooks never count twice). Usage counters per billing period.

## X.3 Lifecycle
`trial, active, payment_pending, past_due, grace_period, cancelled, expired, suspended`. Transitions are driven only by **verified** billing events (admin-verified manual payment or server-verified gateway webhook). A browser redirect never marks a subscription as paid.

## X.4 Expiry & grace
Reminders → grace period → restricted mode (read-only + export allowed, creating new records blocked) → restore on verified payment. **Tenant data is never auto-deleted on expiry.** Retention after long inactivity is governed by Part Z.

## X.5 Downgrade/limit-exceeded rules (new)
When a tenant downgrades or a limit is exceeded:
- Existing data is **never deleted**.
- Over-limit resources (extra stores, staff, couriers) become **read-only/inactive** — the tenant chooses which to keep active within the new limit.
- New creation of the limited resource is blocked until usage is within limits.
- Monthly order limit exceeded: allow a configurable grace overage (e.g., +10%), then block new order creation/import with a clear banner and upgrade CTA; imported orders over the limit are queued, not dropped.
- Downgrade takes effect at the next renewal date unless the platform policy says otherwise; the UI shows exactly what will become inactive before the user confirms.
- Feature-flag-removed features (e.g., payroll) become read-only with data preserved.

## X.6 Payments & invoices
Subscription invoices (bilingual), payment records, idempotent webhook processing, refund/adjustment support, receipts. See Part O.6 for provider reality.

---

# PART Y — DATABASE ARCHITECTURE

## Y.1 Logical groups (build only what the current milestone needs)
- **Identity/Tenant:** users, tenants, tenant_memberships, roles, permissions, role_permissions, invitations, audit_logs, support_grants
- **Subscription:** subscription_plans, plan_entitlements, feature_flags, subscriptions, subscription_usage, billing_invoices, billing_payments, manual_payment_submissions, billing_webhook_events
- **Integration:** stores, store_credentials, store_product_mappings, integration_events, sync_jobs, integration_logs, courier_accounts, courier_service_configs, courier_area_mappings
- **Product/Inventory:** products, product_variants, product_bundles, bundle_items, price_lists, price_list_items, product_images, product_categories, warehouses, warehouse_stock_balances, inventory_movements, stock_reservations, stock_adjustments
- **Orders/Shipments:** customers, customer_addresses, customer_tags, customer_tag_assignments, blacklist_entries, orders, order_items, order_status_history, order_notes, order_risk_checks, shipments, shipment_items, shipment_events, courier_settlements, courier_settlement_allocations
- **Returns:** returns, return_items, return_events, refunds
- **Finance:** financial_transactions, expense_categories, expenses, payments, payment_allocations, financial_adjustments (R2: recurring_expense_rules, receivables, payables, loans; R3: payroll tables, financial_accounts/lines)
- **Notifications/Docs:** notifications, notification_preferences, message_templates, message_log, message_credits_ledger, documents (generated PDFs), report_exports
- **Infra:** outbox_events, background jobs (pg-boss schema), agg_* tables

## Y.2 Mandatory rules
- UUID primary keys; foreign keys; `tenant_id` on tenant tables; composite indexes `(tenant_id, …)`.
- Unique constraints on external identifiers (see I.4) and on `(tenant_id, order_number)`.
- **Money = BIGINT minor units + currency.** No floats/decimals in business tables.
- Timestamps `timestamptz` in UTC.
- Transactions for all multi-row inventory/financial operations.
- `CHECK` constraints for non-negative stock/amounts where applicable.
- Migrations only; no manual schema edits.
- RLS policies on every tenant table; tests per C.2.
- Partition large append-only tables (`audit_logs`, `inventory_movements`, `shipment_events`, `integration_events`) by month when volume warrants.

## Y.3 Soft delete & retention (new)
- Business records use `deleted_at` (soft delete) + `deleted_by`; hard delete is reserved for GDPR-style erasure and platform retention jobs.
- **Never soft/hard delete** financial transactions, inventory movements, order status history or audit logs — they are immutable/append-only.
- Retention defaults (configurable by platform): raw webhook payloads 90 days; integration logs 180 days; generated documents 1 year; audit logs ≥ 2 years; financial/order data retained for the life of the account plus a defined post-cancellation period (e.g., 12 months) before anonymization/export-and-delete.
- **Data export:** tenant owner can export all their data (CSV/JSON bundle) at any time, including after expiry.
- **Erasure/anonymization:** customer personal data can be anonymized on request while keeping aggregate order/financial records intact (name/phone/address replaced, totals preserved).
- Account closure workflow: export offered → confirmation → scheduled anonymization after the retention window.

---

# PART Z — API, EVENTS, JOBS, OBSERVABILITY

## Z.1 API
Versioned `/api/v1`; every protected endpoint validates: authentication → tenant membership → permission → resource ownership → input schema → business rules → rate limit. Consistent error format with request ID. Idempotency-Key header supported on create endpoints (orders, shipments, payments). OpenAPI spec generated from code.

## Z.2 Transactional outbox & events
Domain events (`order.created`, `order.status_changed`, `stock.changed`, `shipment.status_changed`, `return.received`, `payment.verified`, …) are written to `outbox_events` **in the same DB transaction** as the state change. A worker publishes/dispatches them to handlers: notifications, aggregates, store stock push, activity feed, AI module hooks. Handlers are idempotent (processed-event tracking). This is the only allowed way to trigger side effects from state changes.

## Z.3 Background jobs
Types: website sync, product import, stock push, courier status sync, webhook processing, risk checks, notifications, document generation, report exports, aggregate rebuilds, balance-drift check, subscription lifecycle ticks, recurring expenses (R2).
Each job: unique ID, tenant ID, type, payload ref, attempts, status, last error, next retry, timestamps. Exponential backoff; non-retryable validation errors are not retried; dead-letter queue + admin UI for manual replay.

## Z.4 Observability
Structured logs (with request/job/tenant IDs), error monitoring (e.g., Sentry), job failure metrics, integration health, API latency, rate-limit monitoring, alerting. Never log secrets, passwords, payment credentials or unnecessary PII.

## Z.5 Rate limiting & abuse
Per-IP and per-tenant limits; stricter on auth, invitation, webhook and export endpoints; plan-based API limits.

---

# PART AA — SECURITY & NON-FUNCTIONAL

**Security:** tenant isolation (Part C); server-side permission checks; encrypted integration secrets; HTTPS; webhook signature verification; protection against SQLi/XSS/CSRF/IDOR; secure file access (signed URLs); least privilege; audit trails (append-only); no service-role credentials in the browser; CORS restricted to the frontend origin; secrets in platform secret managers (never in repo); dependency scanning; 2FA for Owner and Platform Admin accounts.

**Reliability:** dedupe, safe retries, reconciliation, transactions, job monitoring, automated backups with **tested restore**, graceful provider-downtime handling.

**Performance targets (validate by load test):** common list/dashboard queries ≈ ≤ 2 s at agreed load; server-side pagination everywhere; async imports/exports; aggregates for reports; connection pooling configured for the separate backend (pgBouncer/Supabase pooler) with `set_config` transaction-local usage.

**Usability:** responsive (mobile-first for order entry and warehouse packing), loading/empty/error states, permission-denied states, confirmations for destructive actions, keyboard accessibility, consistent formatting.

**Data integrity (non-negotiable):** no silent financial overwrites; no uncontrolled negative stock; no duplicate external orders; no duplicate shipments from retries; no cross-tenant leakage; no historical cost changes from current product edits; no stock increase merely because a return was announced; no payment marked successful without verification.

---

# PART AB — REVISED DEVELOPMENT MILESTONES (VIBE-CODING FRIENDLY)

Each milestone = small, testable, shippable slice. Do not skip acceptance tests.

**M0 — Foundations & decisions.** Repo/monorepo, CI, environments, `DECISIONS.md`, ERD, permission matrix, order state machine, stock rules, finance policy, db wrapper `withTenant`, RLS test harness. *Accept:* RLS tests pass with two tenants.

**M1 — SaaS core.** Auth, tenants, memberships, roles/permissions, invitations, audit log, settings shell, plan/entitlement tables (seeded), platform admin skeleton, i18n shell. *Accept:* two tenants isolated; unauthorized calls denied by server.

**M2 — Products & inventory.** Products/variants/bundles, warehouse, ledger, balances, reservation, adjustments, import/export, barcodes, low-stock. *Accept:* concurrent reservation test; balance = ledger sum; price change doesn't alter history.

**M3 — Orders & CRM.** Manual/social orders, state machine, cancel/hold, timeline, customers, tags, phone normalization, duplicate detection, bulk actions, numbering. *Accept:* invalid transitions rejected; cancellation releases reservation once.

**M4 — Printing + risk engine shell.** Risk rules/status engine, own-history risk, blacklist, review decisions, check caching, invoice/packing slip/labels/bulk print. *Accept:* insufficient data/provider failure never shows low risk.

**M5 — Courier (Steadfast) + courier fraud check + tracking + COD.** Adapter, **`checkCustomerRisk` wired into the risk engine as the primary source**, shipment creation, duplicate prevention + timeout reconciliation, tracking, charges, settlement records. *Accept:* ambiguous timeout test; out-of-order tracking test; courier fraud-check result shown with source/timestamp; courier API down → `provider_unavailable`, never "low".

**M6 — WooCommerce integration.** Connect, product import/mapping, order import, webhooks, reconciliation, one-way stock push, logs. *Accept:* replayed webhook creates no duplicate; failed sync retryable; no sync loops.

**M7 — Returns + Pathao adapter.** Return workflow, inspection, restock/damage, return costs, settlement diffs. *Accept:* courier "returned" doesn't change stock; costs not double-counted.

**M8 — Notifications.** In-app/email, SMS/WhatsApp adapters with credit ledger, templates, consent. *Accept:* credit exhaustion handled; retries safe.

**M9 — Finance MVP + dashboard.** Transaction ledger, expenses, delivered-sales recognition, COGS snapshot, simple P&L, aggregates, dashboard. *Accept:* worked example matches; reports reconcile to ledger; reversal works.

**M10 — Subscription & platform admin.** Plans, entitlements enforcement, usage, manual payment verification, gateway (if verified available), lifecycle, grace/restricted mode, downgrade rules, platform monitoring. *Accept:* limits enforced server-side; duplicate payment webhook harmless; expiry deletes nothing.

**M11 — Onboarding & hardening.** Setup wizard, import tools, retention/export/anonymization jobs, security review, load test, backup/restore test, monitoring, runbook, documentation, pilot with real sellers. *Accept:* all mandatory tests pass; no open critical/high issues.

**Release 2 / Release 3 milestones** follow Part E.2/E.3, each in the same small-slice format (purchases/GRN → payables/receivables/recurring bills → Shopify → RedX → AI module → payroll → loans → cash flow → custom API → two-way sync → double-entry).

---

# PART AC — MANDATORY TEST SCENARIOS

**Orders:** website order arrives once · same webhook many times · duplicate external IDs · cancel · hold · edit before shipment · edit after shipment · unauthorized status change · bulk partial failure · duplicate-order warning · invalid state transition.
**Inventory:** purchase/opening stock · reserve · release · concurrent reservation of same stock · adjustment · sellable return · damaged return · bundle availability and deduction · ledger/balance drift check · negative stock blocked.
**Courier:** success · validation failure · timeout · retry · provider already created shipment · duplicate request · out-of-order tracking · partial COD settlement · settlement mismatch · area mapping missing.
**Finance:** discount effect · COGS method · cost change after sale · return · partial refund · courier cost reconciliation · reversal · money stored as integers (no rounding drift) · report reconciles to ledger.
**Risk:** no history · insufficient sample · threshold reached · provider down · provider error · manual override · rule-change history · blacklist hit.
**Notifications:** credit deduction · credit exhausted · retry · opt-out respected.
**Subscription:** trial · payment success (verified) · payment failure · duplicate webhook · manual payment approve/reject · limit reached · downgrade over limit · expiry · grace end · renewal · data retained in restricted mode.
**Security:** Tenant A vs B read/write/delete/export · missing tenant context returns nothing · worker without tenant rejected · unauthorized finance access · unauthorized export · credentials never exposed · ID guessing reveals nothing · platform admin blocked without support grant.

---

# PART AC-B — SECURITY & TESTING STANDARDS (BINDING)

The full rules are in **`SECURITY_AND_TESTING_RULES.md`**, which is part of this PRD. Summary of what it enforces:

- **Security:** tenant isolation with RLS on every tenant table (CI fails if a tenant table has no policy); server-side authorization order; input validation; encrypted integration secrets; webhook signature + replay protection; SSRF protection for tenant-supplied URLs; rate limits; CORS/headers; private storage with signed URLs; PII handling, masking and retention; payment verification rules; append-only ledgers; dependency and secret scanning; AI-specific rules (AI output is a draft only, untrusted chat input); a list of forbidden actions.
- **Testing:** test-first for money/stock/tenant/permissions/billing; real-Postgres integration tests; fixed folder locations for unit, RLS, integration, security, contract, worker, e2e and load tests; per-area minimum test list; coverage gates (≥ 90% for shared/finance/inventory code, ≥ 75% backend overall); CI stages that must all pass; regression test for every bug; living `/docs/test-plan.md`; manual QA checklist before every release.
- **Process:** every milestone ends with the Completion Report defined in that file.

Any change to security or testing behavior must update that file and `DECISIONS.md` in the same change.

---

# PART AD — DEFINITION OF DONE

A feature is done only when: UI handles valid/invalid input; server-side authorization exists; tenant isolation is enforced and tested; DB constraints are correct; business rules implemented; loading/error/empty states exist; audit logging present where required; integration retries are safe; automated tests cover key cases; docs updated (`DECISIONS.md`, `CHANGELOG.md`, `.env.example`, API docs, `/docs/test-plan.md`); financial and inventory changes are traceable; no unresolved critical/high security issue; all CI stages green per `SECURITY_AND_TESTING_RULES.md`; the milestone Completion Report is delivered.

---

# PART AE — FINAL DELIVERABLES

Working multi-tenant app (frontend, backend, worker deployed separately) · Tenant dashboard · Platform Super Admin panel · Auth + RBAC · Schema, ERD, migrations · WooCommerce connector · Steadfast (+ Pathao) adapters · Inventory ledger · Orders + state machine · CRM + risk checker · Returns + COD settlement · Printing · Notifications (with credit system) · Finance MVP (ledger, expenses, P&L) · Onboarding/import tools · Subscription + plan enforcement · Automated tests (unit, integration, e2e, tenant isolation) · Deployment configs + env docs · API docs (OpenAPI) · Backup/restore procedure · Security review report · Known limitations + operational runbook.

## Final instruction to the developer / AI coding tool
Before coding, produce and get approval for: module breakdown for the current milestone, ERD for the tables involved, state-transition diagram (if orders/shipments), inventory movement rules, financial formula spec (if finance), permission matrix, integration plan (if integrations), and the milestone test list. Then implement incrementally with migrations, tests and small verifiable steps. Never skip stock integrity, financial correctness, tenant isolation or duplicate-prevention logic to make the UI look finished sooner. The product must be reliable, auditable and extensible — not a collection of dashboard pages.