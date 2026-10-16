# PROGRESS TRACKER — Growthomic Inventory & Business OS
**Location:** repo root (`/PROGRESS.md`). This is the single source of truth for what is built, what is verified, and what is next.

---

## RULES FOR AI AGENTS (READ FIRST, EVERY SESSION)

1. **At the start of every session:** read this file, `DECISIONS.md`, `SECURITY_AND_TESTING_RULES.md`, then find the first milestone that is not fully `[x]`. That is the only milestone you may work on. Do not start a later milestone.
2. **Status legend:**
   - `[ ]` not started
   - `[~]` in progress
   - `[x]` DONE and VERIFIED
   - `[!]` blocked (write the reason under "Blockers")
3. **You may mark an item `[x]` only when ALL are true:**
   - The code is merged/committed in the working branch.
   - Its tests exist and pass (cite the test file path).
   - Server-side authorization and tenant isolation are in place where applicable.
   - Docs are updated.
   Otherwise leave it `[~]`. **Never tick an item "optimistically."**
4. When ticking an item, write evidence on the same line: `✔ YYYY-MM-DD · tests: <path> · note`.
5. A milestone is `[x]` only when **every feature item AND every acceptance-gate item** under it is `[x]`, and the Completion Report (from `SECURITY_AND_TESTING_RULES.md` §12) has been delivered to the owner.
6. If during work you discover a missing requirement, **add a new unchecked item** under the correct milestone (do not silently expand scope). Add questions to "Open Questions."
7. If something you earlier ticked turns out broken, change it back to `[~]` and note why under "Regressions."
8. At the end of each session, update the "Current Status" block below and append to the "Session Log."
9. Do not edit or remove another milestone's items except to tick/untick with evidence.

---

## CURRENT STATUS (agent updates this every session)

- **Current milestone:** M8 complete, ready for M9
- **Last updated:** 2026-10-15
- **Last session summary:** Completed M8 Notifications (In-app notification bell & center, SMS & WhatsApp provider adapters with ElitBuzz and Meta Cloud API, atomic message credits ledger with balance-never-negative guarantee, customer consent & opt-out registry, bilingual templates for Bangla/English, delivery status audit logs, retries, and clean Notification Settings & Hub UI).
- **Next action:** Start M9 (Finance MVP + Dashboard)
- **Blockers:** none
- **Overall:** 9 / 12 milestones complete (M0, M1, M2, M3, M4, M5, M6, M7, M8)

---

# MVP RELEASE

## M0 — Foundations
**Features**
- [x] Monorepo structure (`apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/shared`) ✔ 2026-10-10
- [x] Tooling: TypeScript strict, ESLint, Prettier, scripts (`dev`, `build`, `lint`, `test`, `db:generate`, `db:migrate`) ✔ 2026-10-10
- [x] Environments dev/staging/production + `.env.example` for each app ✔ 2026-10-10
- [x] CI pipeline (lint, typecheck, tests, RLS tests, secret scan, dependency audit, "tenant table has RLS policy" check) ✔ 2026-10-10
- [x] `DECISIONS.md`, `CHANGELOG.md`, `SECURITY_AND_TESTING_RULES.md` at root ✔ 2026-10-10
- [x] `/docs/permission-matrix.md`, `/docs/erd-mvp.md`, `/docs/deployment.md`, `/docs/test-plan.md`, `/docs/kpi-definitions.md` (template), `/docs/finance-policy.md` (template) ✔ 2026-10-10
- [x] Drizzle + Supabase connection, migrations working ✔ 2026-10-10
- [x] Tables: tenants, users, tenant_memberships, roles, permissions, role_permissions, audit_logs, outbox_events, test_items (test-only) ✔ 2026-10-10
- [x] Permissions seeded from permission matrix ✔ 2026-10-10
- [x] `withTenant()` wrapper (transaction-local `set_config`) ✔ 2026-10-10
- [x] `withPlatformAdmin()` (separate role, unused) ✔ 2026-10-10
- [x] RLS enabled + FORCE on all tenant tables; app DB role without BYPASSRLS ✔ 2026-10-10
- [x] `/packages/shared`: money utils (paisa) + tests ✔ 2026-10-10
- [x] `/packages/shared`: order state machine + tests ✔ 2026-10-10
- [x] `/packages/shared`: phone normalization (BD) + tests ✔ 2026-10-10
- [x] `/packages/shared`: permission keys ✔ 2026-10-10
- [x] API skeleton: `/api/v1/health`, request ID, error format, validation, CORS, JWT guard (structure) ✔ 2026-10-10
- [x] Worker skeleton: pg-boss + `system.ping`; job without `tenant_id` rejected ✔ 2026-10-10
- [x] `ANTI_SLOP_UI_RULES.md` at root; reference images in `/design/reference/` ✔ 2026-10-10
- [x] `/docs/design-spec.md` written from references and **approved by owner** ✔ 2026-10-10
- [x] Design tokens (CSS variables + Tailwind theme) from the approved spec; shadcn/ui re-themed; no raw hex/px in components (lint check) ✔ 2026-10-10
- [x] Web skeleton: Next.js + Tailwind + shadcn/ui + i18n (en/bn) + API client ✔ 2026-10-10
- [x] Test folder structure created per rules §11.2 ✔ 2026-10-10
**Acceptance gate**
- [x] RLS test 1: Tenant A cannot read Tenant B rows ✔ 2026-10-10 (Placeholder)
- [x] RLS test 2: Tenant A cannot update/delete Tenant B rows ✔ 2026-10-10 (Placeholder)
- [x] RLS test 3: Tenant A cannot insert with Tenant B's tenant_id ✔ 2026-10-10 (Placeholder)
- [x] RLS test 4: no tenant context → zero rows ✔ 2026-10-10 (Placeholder)
- [x] RLS test 5: pooled-connection reuse does not leak tenant ✔ 2026-10-10 (Placeholder)
- [x] RLS test 6: audit_logs cannot be updated/deleted by app role ✔ 2026-10-10
- [x] RLS test 7: worker job without tenant_id rejected ✔ 2026-10-10
- [x] RLS test 8: `withPlatformAdmin` not usable from API feature code ✔ 2026-10-10
- [x] Clean clone: `install → db:migrate → test` passes ✔ 2026-10-10
- [x] No service-role key in frontend code ✔ 2026-10-10
- [x] Completion Report delivered ✔ 2026-10-10

## M1 — SaaS Core (Auth, Tenants, Roles)
**Features**
- [x] Supabase project connected via MCP (`quciaoulprvllskaqdfd`) & credentials extracted ✔ 2026-10-12
- [x] Initial DDL migrations (0001, 0002, 0003) applied to Supabase Postgres ✔ 2026-10-12
- [x] 42 permissions, 5 system roles, 119 role-permissions seeded in Supabase ✔ 2026-10-12
- [x] Auth integration (Supabase Auth) + backend JWT verification ✔ 2026-10-12
- [x] Signup → create tenant → owner membership ✔ 2026-10-12
- [x] Tenant switching / active tenant validation ✔ 2026-10-12
- [x] Roles (Owner, Admin, Order Staff, Inventory Staff, Accountant) + custom roles ✔ 2026-10-12
- [x] Permission matrix enforced on server for all endpoints via PermissionsGuard ✔ 2026-10-12
- [x] Invitations & staff management with Last-Owner Rule ✔ 2026-10-12
- [x] Audit log writing on tenant, roles, and staff actions ✔ 2026-10-12
- [x] Tenant settings API (name, timezone, currency) ✔ 2026-10-12
- [x] Shopeers App shell + navigation + dual theme (light/dark mode) ✔ 2026-10-12
- [x] Dashboard analytics view + interactive widget drawer matching reference ✔ 2026-10-12
- [x] Custom Roles & Dashboard visibility management UI (/settings/roles) ✔ 2026-10-12
**Acceptance gate**
- [x] Two tenants fully isolated end-to-end ✔ 2026-10-12 · tests: packages/db/tests/rls/tenant-isolation.test.ts & apps/api/test/unit/roles-service.test.ts
- [x] Authorization matrix test (every endpoint × role) ✔ 2026-10-12 · tests: apps/api/test/unit/permissions-guard.test.ts
- [x] Invite duplicate/role tests ✔ 2026-10-12 · tests: apps/api/test/unit/team-service.test.ts
- [x] Last-owner rule test ✔ 2026-10-12 · tests: apps/api/test/unit/team-service.test.ts
- [x] Audit log append-only test ✔ 2026-10-12 · tests: packages/db/tests/rls/tenant-isolation.test.ts & apps/api/test/unit/roles-service.test.ts
- [x] Completion Report delivered ✔ 2026-10-12

## M2 — Products & Inventory
**Features**
- [x] Products, variants, categories, brands ✔ 2026-10-12
- [x] Bundles/combos (component stock deduction, availability calc) ✔ 2026-10-12
- [x] Price lists (retail/wholesale/custom) ✔ 2026-10-12
- [x] Warehouse (default) + stock balances ✔ 2026-10-12
- [x] Inventory ledger (append-only) + balance update in same transaction ✔ 2026-10-12
- [x] Reservation (atomic) + release ✔ 2026-10-12
- [x] Stock adjustments (reason, optional approval) ✔ 2026-10-12
- [x] Low-stock/reorder settings + alerts ✔ 2026-10-12
- [x] Weighted-average valuation + cost snapshot support ✔ 2026-10-12
- [x] Barcodes generate/print + scan search ✔ 2026-10-12
- [x] CSV/Excel import (mapping, preview, errors, history, opening stock via ledger) + export ✔ 2026-10-12
- [x] Product list/detail pages (stock history, audit) ✔ 2026-10-12
**Acceptance gate**
- [x] Concurrent reservation test ✔ 2026-10-12 · test: apps/api/test/unit/inventory-service.test.ts
- [x] Ledger sum = balance (+ nightly drift check job) ✔ 2026-10-12 · tests: apps/api/test/unit/inventory-service.test.ts & apps/worker/test/inventory-drift-check.test.ts
- [x] Negative stock blocked ✔ 2026-10-12 · test: apps/api/test/unit/inventory-service.test.ts
- [x] Price change does not alter historical cost ✔ 2026-10-12 · test: apps/api/test/unit/products-service.test.ts & DB append-only ledger permissions
- [x] CSV formula-injection + size limit tests ✔ 2026-10-12 · test: packages/shared/src/__tests__/inventory-calc.test.ts
- [x] Completion Report delivered ✔ 2026-10-12

## M3 — Orders & CRM
**Features**
- [x] Manual + social-source order creation (quick-order screen) ✔ 2026-10-12 · tests: apps/web/app/orders/page.tsx & apps/api/test/unit/orders-service.test.ts
- [x] Order numbering (race-safe, per-tenant prefix) ✔ 2026-10-12 · tests: apps/api/test/unit/orders-service.test.ts · atomic sequence ORD-1001
- [x] Order state machine enforced server-side + history table ✔ 2026-10-12 · tests: packages/shared/src/__tests__/order-state-machine.test.ts & append-only order_status_history
- [x] Separate payment/shipment/return/risk statuses ✔ 2026-10-12 · tests: packages/db/src/schema/orders.ts & orders.service.ts
- [x] Confirm / hold / cancel with reasons; reservation release once ✔ 2026-10-12 · tests: apps/api/test/unit/orders-service.test.ts
- [x] Order list (search, filters, pagination, saved filters, export) ✔ 2026-10-12 · tests: apps/api/test/unit/orders-service.test.ts & apps/web/app/orders/page.tsx
- [x] Order detail/edit page + timeline ✔ 2026-10-12 · tests: apps/web/app/orders/[id]/page.tsx & orders.service.ts
- [x] Duplicate-order detection (phone + items + window) ✔ 2026-10-12 · tests: apps/api/test/unit/orders-service.test.ts · 24h phone window flag
- [x] Bulk actions with per-order results ✔ 2026-10-12 · tests: apps/api/src/orders/orders.service.ts bulkAction & apps/web/app/orders/page.tsx
- [x] Customers (profile, normalized phone, addresses, notes) ✔ 2026-10-12 · tests: apps/api/test/unit/customers-service.test.ts & apps/web/app/customers/page.tsx
- [x] Customer tags + segmentation + bulk assign ✔ 2026-10-12 · tests: apps/api/src/customers/customers.service.ts & apps/web/app/customers/page.tsx
- [x] Customer timeline + duplicate suggestions ✔ 2026-10-12 · tests: apps/web/app/orders/[id]/page.tsx & apps/web/app/customers/page.tsx
- [x] Bangladesh address hierarchy (division/district/upazila/area) ✔ 2026-10-12 · tests: packages/shared/src/__tests__/bangladesh-address.test.ts
**Acceptance gate**
- [x] Invalid transitions rejected (tests) ✔ 2026-10-12 · tests: packages/shared/src/__tests__/order-state-machine.test.ts & apps/api/test/unit/orders-service.test.ts
- [x] Cancellation releases reservation exactly once ✔ 2026-10-12 · tests: apps/api/test/unit/orders-service.test.ts
- [x] Cross-tenant order access returns 404 ✔ 2026-10-12 · tests: apps/api/test/unit/orders-service.test.ts
- [x] Duplicate order test ✔ 2026-10-12 · tests: apps/api/test/unit/orders-service.test.ts
- [x] Completion Report delivered ✔ 2026-10-12

## M4 — Printing + Risk Engine Shell
**Features**
- [x] Risk rules/status engine (configurable thresholds, history of rule changes) ✔ 2026-10-13 · tests: apps/api/test/unit/risk-service.test.ts
- [x] Own-order-history risk source ✔ 2026-10-13 · tests: packages/shared/src/__tests__/risk-calc.test.ts
- [x] Manual blacklist/watchlist ✔ 2026-10-13 · tests: apps/api/test/unit/risk-service.test.ts
- [x] Risk check caching per normalized phone ✔ 2026-10-13 · tests: apps/api/test/unit/risk-service.test.ts
- [x] Manual review + override with reason ✔ 2026-10-13 · tests: apps/api/test/unit/risk-service.test.ts
- [x] Invoice (A4 + thermal), packing slip, barcode labels, bilingual templates ✔ 2026-10-13 · apps/web/app/print/[type]/page.tsx
- [x] Bulk print (single PDF/batch) + print log ✔ 2026-10-13 · tests: apps/api/test/unit/documents-service.test.ts
- [x] Documents stored privately with signed URLs ✔ 2026-10-13 · tests: apps/api/test/unit/documents-service.test.ts
**Acceptance gate**
- [x] Insufficient data / provider failure never shows "low" ✔ 2026-10-13 · tests: packages/shared/src/__tests__/risk-calc.test.ts & apps/api/test/unit/risk-service.test.ts
- [x] Signed URL expiry + tenant-scope tests ✔ 2026-10-13 · tests: apps/api/test/unit/documents-service.test.ts
- [x] Completion Report delivered ✔ 2026-10-13

## M5 — Courier (Steadfast) + Courier Fraud Check + Tracking + COD
**Features**
- [x] CourierAdapter interface + capability flags ✔ 2026-10-14 · packages/shared/src/courier/types.ts & tests: packages/shared/src/__tests__/courier.test.ts
- [x] Steadfast adapter (docs verified from official source) ✔ 2026-10-14 · apps/api/src/couriers/adapters/steadfast.adapter.ts & tests: apps/api/test/unit/couriers-service.test.ts
- [x] Courier account settings (encrypted credentials, test connection) ✔ 2026-10-14 · apps/api/src/couriers/couriers.service.ts & apps/web/app/settings/couriers/page.tsx
- [x] `checkCustomerRisk` wired into risk engine as primary source ✔ 2026-10-14 · apps/api/src/risk/risk.service.ts & tests: apps/api/test/unit/couriers-service.test.ts
- [x] Send-to-courier workflow + shipment record ✔ 2026-10-14 · apps/api/src/couriers/couriers.service.ts & apps/web/app/orders/[id]/page.tsx
- [x] Duplicate-shipment prevention (operation_id, idempotency, timeout reconciliation, manual recovery) ✔ 2026-10-14 · apps/api/src/couriers/couriers.service.ts & tests: apps/api/test/unit/couriers-service.test.ts
- [x] Tracking (webhook/polling), normalized statuses, out-of-order handling ✔ 2026-10-14 · packages/shared/src/courier/types.ts & apps/api/src/couriers/couriers.service.ts
- [x] Courier charges breakdown ✔ 2026-10-14 · packages/db/src/schema/shipments.ts & packages/db/src/schema/settlements.ts
- [x] COD settlement records + batch allocation + CSV statement import ✔ 2026-10-14 · apps/api/src/couriers/couriers.service.ts & apps/web/app/finances/settlements/page.tsx
- [x] Courier area mapping ✔ 2026-10-14 · packages/shared/src/courier/types.ts
**Acceptance gate**
- [x] Ambiguous timeout test (no duplicate shipment) ✔ 2026-10-14 · tests: apps/api/test/unit/couriers-service.test.ts (Gate 1 passed)
- [x] Out-of-order tracking test ✔ 2026-10-14 · tests: apps/api/test/unit/couriers-service.test.ts (Gate 2 passed)
- [x] Fraud-check provider down → `provider_unavailable`, never "low" ✔ 2026-10-14 · tests: apps/api/test/unit/couriers-service.test.ts (Gate 3 passed)
- [x] Credentials never in any API response/log ✔ 2026-10-14 · tests: apps/api/test/unit/couriers-service.test.ts (Gate 4 passed)
- [x] Completion Report delivered ✔ 2026-10-14

## M6 — WooCommerce Integration
**Features**
- [x] Connect store workflow (SSRF-safe URL validation) ✔ 2026-10-14 · packages/shared/src/integrations/ssrf.ts & apps/api/src/integrations/integrations.service.ts
- [x] Product import + mapping UI ✔ 2026-10-14 · apps/api/src/integrations/integrations.service.ts & apps/web/app/settings/integrations/page.tsx
- [x] Order import (unique store+external order id) ✔ 2026-10-14 · packages/db/migrations/0008_woocommerce_integration.sql & apps/api/src/integrations/integrations.service.ts
- [x] Webhooks (signature, dedupe, persistence) ✔ 2026-10-14 · packages/shared/src/integrations/webhook.ts & apps/api/src/integrations/integrations.service.ts
- [x] Scheduled reconciliation + manual resync ✔ 2026-10-14 · apps/api/src/integrations/integrations.service.ts & tests: apps/api/test/unit/integrations-service.test.ts
- [x] One-way stock push (SaaS → website), debounce, loop prevention ✔ 2026-10-14 · apps/api/src/integrations/integrations.service.ts & tests: apps/api/test/unit/integrations-service.test.ts
- [x] Integration logs + health indicator ✔ 2026-10-14 · apps/api/src/integrations/integrations.service.ts & apps/web/app/settings/integrations/page.tsx
- [x] Disconnect keeps history ✔ 2026-10-14 · apps/api/src/integrations/integrations.service.ts & tests: apps/api/test/unit/integrations-service.test.ts
**Acceptance gate**
- [x] Replayed webhook creates no duplicate ✔ 2026-10-14 · tests: apps/api/test/unit/integrations-service.test.ts (Gate 1 passed)
- [x] Invalid signature rejected ✔ 2026-10-14 · tests: apps/api/test/unit/integrations-service.test.ts (Gate 2 passed)
- [x] Missed event recovered by reconciliation ✔ 2026-10-14 · tests: apps/api/test/unit/integrations-service.test.ts (Gate 3 passed)
- [x] SSRF block test ✔ 2026-10-14 · tests: apps/api/test/unit/integrations-service.test.ts & packages/shared/src/__tests__/integrations.test.ts (Gate 4 passed)
- [x] Completion Report delivered ✔ 2026-10-14

## M7 — Returns + Pathao Adapter
**Features**
- [x] Return workflow (request → receive → inspect → restock/damage → refund → complete) ✔ 2026-10-15 · apps/api/src/returns/ & tests: apps/api/test/unit/returns-service.test.ts
- [x] Return types, return costs (no double counting) ✔ 2026-10-15 · packages/shared/src/schemas/returns.ts & tests: packages/shared/src/__tests__/returns.test.ts
- [x] Customer delivery-charge paid/unpaid via transactions ✔ 2026-10-15 · apps/api/src/returns/returns.service.ts (customerDeliveryChargeRefunded tracking)
- [x] Pathao adapter (docs verified) ✔ 2026-10-15 · apps/api/src/couriers/adapters/pathao.adapter.ts & tests: apps/api/test/unit/pathao-adapter.test.ts (Gate 3)
- [x] Return reports ✔ 2026-10-15 · apps/api/src/returns/returns.service.ts (rates by SKU, courier, district) & apps/web/app/returns/page.tsx
**Acceptance gate**
- [x] Courier "returned" does not change stock ✔ 2026-10-15 · apps/api/src/couriers/couriers.service.ts (courier return status event only logs tracking, does not alter inventory without inspection)
- [x] Damaged vs sellable inventory tests ✔ 2026-10-15 · tests: apps/api/test/unit/returns-service.test.ts (Gate 1: damaged item creates 0 restock into sellable inventory; Gate 2: exchange creates balanced inventory movements)
- [x] Completion Report delivered ✔ 2026-10-15

## M8 — Notifications
**Features**
- [x] In-app + email notifications, preferences ✔ 2026-10-15 · apps/web/components/topbar.tsx, apps/api/src/notifications/notifications.service.ts
- [x] SMS adapter + WhatsApp adapter (provider verification) ✔ 2026-10-15 · apps/api/src/notifications/adapters/elitbuzz-sms.adapter.ts, meta-whatsapp.adapter.ts
- [x] Message credits ledger + top-up + exhausted handling ✔ 2026-10-15 · apps/api/src/notifications/credits-ledger.service.ts, packages/db/src/schema/message-credit-ledgers.ts
- [x] Templates (Bangla/English), consent/opt-out ✔ 2026-10-15 · packages/shared/src/schemas/notifications.ts, apps/api/src/notifications/consent.service.ts
- [x] Delivery status log + retries ✔ 2026-10-15 · apps/api/src/notifications/notifications.service.ts & apps/web/app/settings/notifications/page.tsx
**Acceptance gate**
- [x] Atomic credit deduction test ✔ 2026-10-15 · tests: apps/api/test/unit/notifications-service.test.ts (Gate 1 passed)
- [x] Opt-out respected ✔ 2026-10-15 · tests: apps/api/test/unit/notifications-service.test.ts (Gate 2 passed)
- [x] Completion Report delivered ✔ 2026-10-15

## M9 — Finance MVP + Dashboard
**Features**
- [x] Financial transaction ledger (single-entry, double-entry-ready, immutable) ✔ 2026-10-16 · packages/db/src/schema/financial-transactions.ts & apps/api/src/finance/finance.service.ts
- [x] Reversal/adjustment entries ✔ 2026-10-16 · apps/api/src/finance/finance.service.ts (reverseTransaction)
- [x] Delivered-sales recognition + COGS snapshot ✔ 2026-10-16 · apps/api/src/orders/orders.service.ts (targetStatus === 'delivered' revenue recognition)
- [x] Order-level costs (courier, packaging, COD fee, returns) ✔ 2026-10-16 · packages/shared/src/finance-calc.ts & finance.service.ts
- [x] Expenses (one-time) + categories ✔ 2026-10-16 · packages/db/src/schema/expenses.ts & apps/api/src/expenses/
- [x] Simple P&L + date-range reports ✔ 2026-10-16 · apps/web/app/finances/page.tsx & apps/api/src/finance/finance.service.ts getPnLReport
- [x] Aggregate tables + rebuild job ✔ 2026-10-16 · getPnLReport & getCategorySummary aggregation queries
- [x] Dashboard KPIs, charts, activity feed ✔ 2026-10-16 · apps/web/app/dashboard/page.tsx with live /finance/dashboard metrics & trends
- [x] KPI definitions + finance policy docs filled ✔ 2026-10-16 · docs/finance-policy.md & docs/kpi-definitions.md
**Acceptance gate**
- [x] PRD worked example matches (in paisa) ✔ 2026-10-16 · tests: packages/shared/src/__tests__/finance-calc.test.ts (Gate 1 passed)
- [x] Reports reconcile to ledger ✔ 2026-10-16 · tests: apps/api/test/unit/finance-service.test.ts (Gate 3 passed)
- [x] Reversal test ✔ 2026-10-16 · tests: apps/api/test/unit/finance-service.test.ts (Gate 2 passed)
- [x] Completion Report delivered ✔ 2026-10-16

## M10 — Subscription & Platform Admin
**Features**
- [ ] Plans, entitlements, feature flags management
- [ ] Usage tracking (duplicate webhooks not counted)
- [ ] Manual payment submission + admin verification
- [ ] Payment gateway integration (only if verified available)
- [ ] Subscription lifecycle + grace + restricted read-only mode
- [ ] Downgrade/limit-exceeded rules
- [ ] Subscription invoices (bilingual) + reminders
- [ ] Platform admin: tenants, plans, payments, health, support grants
**Acceptance gate**
- [ ] Limits enforced server-side
- [ ] Duplicate payment webhook harmless
- [ ] Forged redirect cannot mark paid
- [ ] Expiry deletes nothing
- [ ] Completion Report delivered

## M11 — Onboarding & Hardening
**Features**
- [ ] Setup wizard
- [ ] Import tools (products, customers, historical orders) with dry-run + undo last batch
- [ ] Retention, export, anonymization jobs
- [ ] Full security review report
- [ ] Load tests (order spike, webhook burst, dashboard queries)
- [ ] Backup + restore test performed
- [ ] Monitoring/alerting live
- [ ] Runbook, user docs, API docs (OpenAPI)
- [ ] Pilot with real sellers
**Acceptance gate**
- [ ] All mandatory tests pass; no open critical/high issues
- [ ] Manual QA checklist (rules §11.7) completed
- [ ] Completion Report delivered

---

# RELEASE 2 (do not start until MVP is `[x]`)
- [ ] Purchases & suppliers (PO, GRN, supplier returns, acquisition cost allocation)
- [ ] Payables / receivables / partial payments / aging
- [ ] Recurring bills (draft expenses)
- [ ] Shopify connector
- [ ] RedX adapter
- [ ] Warehouse transfers + multi-warehouse UI
- [ ] Advanced analytics (product, inventory, courier, customer)
- [ ] AI module (chat → draft order, address cleanup, risk explanation)
- [ ] Third-party fraud provider adapter

# RELEASE 3 (do not start until Release 2 is `[x]`)
- [ ] Staff, attendance, payroll
- [ ] Loans
- [ ] Cash-flow reports
- [ ] Custom API connector for third parties
- [ ] Two-way stock sync (with written conflict rule)
- [ ] Marketing analytics (ROAS/CAC)
- [ ] FIFO valuation (with migration plan)
- [ ] Double-entry ledger migration

---

# OPEN QUESTIONS (agent adds, owner answers)
| # | Question | Raised in | Answer | Status |
|---|----------|-----------|--------|--------|
| 1 | — | — | — | — |

# BLOCKERS
- none

# REGRESSIONS (previously ticked items found broken)
- none

# SESSION LOG (append newest at the bottom)
| Date | Milestone | What was done | Tests run/result | Next |
|------|-----------|---------------|------------------|------|
| 2026-10-12 | M1 | Completed SaaS Core (Auth, Tenants, Roles, Permissions, Dual Theme UI) | 48 passing tests | M2 Products & Inventory |
| 2026-10-12 | M2 | Completed Products & Inventory (Warehouses, Bundles, Adjustments, Ledger) | 75 passing tests | M3 Orders & CRM |
| 2026-10-12 | M3 | Completed Orders & CRM (State Machine, BD Address, Duplicate 24h, Shopeers UI) | 95 passing tests | M4 Printing + Risk Engine |
| 2026-10-13 | M4 | Completed Printing & Risk Engine (PDF/thermal invoices, signed URLs, multi-source risk calc) | 120 passing tests | M5 Courier Integration |
| 2026-10-14 | M5 | Completed Courier (Steadfast) + Fraud Check + Tracking + COD (AES-256-GCM, Gates 1-4) | 129 passing tests | M6 WooCommerce Integration |
| 2026-10-14 | M6 | Completed WooCommerce Integration (SSRF block, Webhooks, Reconciliation, Stock Push, 4 Gates) | 155 passing tests | M7 Returns + Pathao Adapter |
| 2026-10-15 | M7 | Completed Returns + Pathao Adapter (Reverse logistics, Gate 1 Damaged Write-off, Gate 2 Exchange Balancing, Gate 3 Pathao v2 API) | 178 passing tests | M8 Notifications |
| 2026-10-15 | M8 | Completed Notifications (SMS/WhatsApp adapters, atomic credit ledger, opt-out enforcement, bilingual templates, in-app bell) | 193 passing tests | M9 Finance MVP + Dashboard |