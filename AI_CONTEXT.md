# AI MODEL CONTEXT & CONTINUITY GUIDE (AI_CONTEXT.md)
> **Notice to any AI Model (Claude, GPT, Gemini, DeepSeek, etc.):**
> Read this file **first** before writing or modifying any code. It contains the complete architectural ground truth, current completion state, locked rules, and exact instructions on where to continue.

---

## 1. PROJECT OVERVIEW
- **Project Name:** Growthomic Inventory & Business OS (inventoryOS)
- **Target Market:** Bangladesh E-commerce (Facebook/Instagram/WhatsApp f-commerce sellers, WooCommerce/Shopify/custom sites)
- **System Type:** Multi-tenant B2B SaaS (E-commerce ERP, Inventory, Order State Machine, Courier automation, Invoicing, Analytics)
- **Repo Architecture:** pnpm Monorepo with TypeScript Strict mode:
  - `apps/web`: Next.js (App Router) + Tailwind CSS + shadcn/ui (Port 3000)
  - `apps/api`: NestJS REST API (`/api/v1`) (Port 3001)
  - `apps/worker`: pg-boss background processor / queue runner
  - `packages/db`: Drizzle ORM + PostgreSQL schema + migrations + RLS helpers
  - `packages/shared`: Shared types, Zod schemas, Money utility (`BigInt` paisa), BD phone normalizer, Order State Machine

---

## 2. STRICT BINDING ARCHITECTURE RULES (DO NOT DEVIATE)
Refer to: `DECISIONS.md`, `SECURITY_AND_TESTING_RULES.md`, and `ANTI_SLOP_UI_RULES.md`.

1. **Deployment & Separation (B1-B4):**
   - Web frontend calls **only** the Backend API (`apps/api`). **Zero direct DB / PostgREST queries from frontend.**
   - All client data communication goes through `/api/v1` via typed Bearer token & `x-tenant-id` header.
2. **Database & Tenant Isolation (B5, B10, Security Rules §1):**
   - Managed PostgreSQL on **Supabase** (Ref: `quciaoulprvllskaqdfd`).
   - Tenant tables have `tenant_id UUID NOT NULL` with `FORCE ROW LEVEL SECURITY`.
   - Feature queries use `withTenant(tenantId, async (tx) => { ... })` setting transaction-local `app.tenant_id`.
   - Direct connection pool in feature code is strictly forbidden.
3. **Money Handling (B8):**
   - **Integer minor units (paisa) as `BigInt` / BIGINT column.** Zero floats for money in DB or backend calculations.
   - Always use `BigInt(val)` constructors (never `100n` literals) to prevent TS compilation down-leveling issues across targets.
4. **Auth & RBAC (B6, Security Rules §2):**
   - Supabase Auth handles identity/JWTs.
   - Organization memberships, roles, and permissions live in our PostgreSQL schema (`tenant_memberships`, `roles`, `permissions`, `role_permissions`).
   - Server-side verification on **every request** via `AuthGuard` & `PermissionsGuard`. Never trust frontend role assertions.
   - **Last-Owner Rule:** A tenant cannot demote or remove its last active Owner.
5. **UI & Anti-Slop Design Standards (ANTI_SLOP_UI_RULES.md):**
   - Approved Reference: [Shopeers AI-Powered B2B eCommerce Analytics Dashboard](https://dribbble.com/shots/26628350-Shopeers-AI-Powered-B2B-eCommerce-Analytics-Dashboard) (`design/reference/shopeers_dashboard_reference.png`).
   - **Dual Theme Support:**
     - Light Mode: Canvas `#F4F6F9`, Cards `#FFFFFF`, Borders `#E2E8F0`, Text `#0F172A`.
     - Dark Mode: Canvas `#0B0F17`, Cards `#121826`, Borders `#1E293B`, Text `#F8FAFC`.
     - Accent: Electric / Royal Blue (`#2563EB`, `hsl(221.2 83.2% 53.3%)`).
   - **No Slop:** No generic AI purple gradients, no fuzzy glassmorphism blur, no emojis as UI icons (use Lucide SVG icons).
6. **Living Feature & Problem Guide (`FEATURES_GUIDE.html`):**
   - The file `FEATURES_GUIDE.html` in the project root is the user-facing interactive visual manual.
   - **MANDATORY RULE:** Whenever any new milestone (e.g., M5 Steadfast, M6 WooCommerce, M7 Returns, M8 Notifications) or feature is implemented, updated, or modified, `FEATURES_GUIDE.html` MUST be updated with the new pages, features, buttons, and real-world problems solved.

---

## 3. SUPABASE INFRASTRUCTURE & MCP
- **Supabase Project Ref:** `quciaoulprvllskaqdfd`
- **Region:** `ap-southeast-2`
- **URL:** `https://quciaoulprvllskaqdfd.supabase.co`
- **Database Status:**
  - Migrations applied: `0001_initial_schema.sql`, `0002_rls_policies.sql`, `0003_roles_unique_indexes.sql`.
  - Core tables: `tenants`, `users`, `tenant_memberships`, `roles`, `permissions`, `role_permissions`, `audit_logs`, `outbox_events`, `test_items`.
  - Seeded: 42 permissions, 5 system roles (`Owner`, `Admin`, `Order Staff`, `Inventory Staff`, `Accountant`), 119 role permissions.

---

## 4. CURRENT MILESTONE COMPLETION STATE

### Completed: M0 — Foundations (100% Done & Verified)
- Monorepo, TS strict, ESLint, Vitest, CI setup.
- Drizzle ORM, RLS policies, `withTenant` wrapper, Money utilities, Order State Machine.

### Completed: M1 — SaaS Core (Auth, Tenants, Roles, Shopeers UI - 100% Done & Verified)
- [x] Supabase Auth + NestJS `AuthService` (`verifySupabaseToken`, `signup`, `getMe`, `switchTenant`).
- [x] Roles & Permissions Management (`roles.service.ts`, `roles.controller.ts`) supporting custom tenant roles and permission matrix.
- [x] Staff & Invitation Management (`team.service.ts`, `team.controller.ts`) with **Last-Owner Protection**.
- [x] Tenant Settings API (`tenants.service.ts`).
- [x] Shopeers Frontend Screens in `apps/web`: `/login`, `/register`, `/` & `/dashboard`, `/settings/roles`.
- [x] Full tenant isolation & last-owner demotion/removal protection tests.

### Completed: M2 — Products & Inventory Core (100% Done & Verified)
- [x] Database Schema & RLS: `warehouses`, `categories`, `brands`, `products`, `product_variants`, `product_bundles`, `inventory_movements`, `warehouse_stock_balances`, `stock_adjustments` (all 9 tables with `FORCE ROW LEVEL SECURITY`).
- [x] Append-only ledger enforcement (`REVOKE UPDATE, DELETE ON inventory_movements`).
- [x] Shared logic: `calculateBundleAvailability`, `calculateWeightedAverageCost`, `sanitizeCsvCell`, `csvImportBatchSchema`.
- [x] NestJS API: `/api/v1/products` (catalog, matrix, bundles) and `/api/v1/inventory` (balances, adjustments, atomic reservations, drift reconciliation).
- [x] Worker: `inventory.drift-check` job for nightly ledger drift detection.
- [x] Shopeers UI: `/products` (KPIs, table, variant drawer, printable barcodes) & `/inventory` (balances, immutable ledger feed, drift check, adjustment drawer).
- [x] Acceptance gate verified: concurrent reservation race safety, negative stock blocked, historical cost preserved, CSV formula injection defense, 75 passing tests.

### Completed: M3 — Orders & Customer Management CRM (100% Done & Verified)
- [x] Database Schema & RLS: `customers`, `customer_addresses`, `customer_tags`, `customer_tag_assignments`, `orders`, `order_sequences`, `order_items`, `order_status_history` (all 8 tables with `FORCE ROW LEVEL SECURITY`).
- [x] Append-only audit history enforcement (`REVOKE UPDATE, DELETE ON order_status_history`).
- [x] Shared logic: Bangladesh address hierarchy (8 divisions, 64 districts), `normalizeBdPhone`, order state machine, Zod schemas.
- [x] NestJS API: `/api/v1/orders` (atomic sequence `ORD-1001`, duplicate detection, reservations, status transitions, bulk operations), `/api/v1/customers` (profiles, tags, lookup), and `/api/v1/geo` (BD divisions/districts).
- [x] Shopeers UI: `/orders` (KPIs, filters, table, duplicate alerts, Quick Order Intake drawer with phone lookup & cascading address), `/orders/[id]` (order details, action controls, hold/cancel reason modals, timeline), and `/customers` (CRM table, tags, delivered rates).
- [x] Acceptance gate verified: invalid transitions rejected, cancellation releases reservation exactly once, cross-tenant isolation (404), duplicate order detection, 95 passing tests.

### Completed: M4 — Printing + Risk Engine Shell (100% Done & Verified)
- [x] Database Schema & RLS: `risk_rules`, `risk_rule_history`, `blacklist_entries`, `customer_risk_checks`, `documents`, `print_logs` (all 6 tables with `FORCE ROW LEVEL SECURITY`, append-only for `risk_rule_history` and `print_logs`).
- [x] Shared logic: `evaluateCustomerRisk` deterministic engine, Gate 1 strict fail-safe rules, permissions (`DOCUMENTS_VIEW`, `DOCUMENTS_PRINT`, `RISK_VIEW`, `RISK_MANAGE`, `RISK_OVERRIDE`), Zod schemas.
- [x] NestJS API: `/api/v1/risk` (settings, history, blacklist CRUD, risk check with caching, order review/override, review queue) and `/api/v1/documents` (HMAC signed URLs, token verification, print logging).
- [x] Shopeers UI: `/print/[type]` (A4 & 80mm thermal bilingual invoices & packing slips, `@media print`), `/settings/risk` (thresholds, blacklist/watchlist drawer, rule audit trail), `/orders` (risk badge, print icon, bulk print), `/orders/[id]` (print actions, risk shield card, review modal).
- [x] Acceptance gates verified: Gate 1 (insufficient data / courier down never returns low), Gate 2 (HMAC signed URL expiry & cross-tenant isolation), 114 passing tests.

### Completed: M5 — Courier (Steadfast) + Courier Fraud Check + Tracking + COD (100% Done & Verified)
- [x] Database Schema & RLS: `courier_accounts`, `shipments`, `shipment_events`, `cod_statements`, `cod_statement_allocations` (all 5 tables with `FORCE ROW LEVEL SECURITY`, append-only for `shipment_events`).
- [x] Shared logic: `CourierAdapter` interface, capabilities, AES-256-GCM authenticated credential encryption, credential masking (`******`), terminal status protection (`canTransitionShipmentStatus`), permissions (`SETTLEMENTS_VIEW`, `SETTLEMENTS_MANAGE`), Zod schemas.
- [x] NestJS API: `SteadfastAdapter` (create order, track cid/tracking code, balance, fraud check), `CouriersModule` (account management, dispatch with unique `operation_id`, Gate 1 timeout detection with `unknown_pending_reconciliation`, manual recovery, Gate 2 terminal status immutability, Gate 3 fraud check failsafe, Gate 4 masked secrets, COD settlements).
- [x] Shopeers UI: `/settings/couriers` (Courier Gateway, account connection modal, balance display, test connection), `/finances/settlements` (COD settlement statements, KPI cards, statement import modal), `/orders/[id]` (dispatch card, live track sync, timeout reconciliation banner & modal, terminal badge).
- [x] Acceptance gates verified: Gate 1 (ambiguous timeout sets unknown status, locks duplicate dispatch), Gate 2 (out-of-order tracking events cannot regress delivered terminal state), Gate 3 (courier fraud failure returns provider_unavailable, never low), Gate 4 (credentials never in any API response/log), 129 passing tests across repo.

### Completed: M6 — WooCommerce Integration (100% Done & Verified)
- [x] Database Schema & RLS: `integration_stores`, `product_mappings`, `integration_events` (all 3 tables with `FORCE ROW LEVEL SECURITY`, unique store external order constraint on `orders`).
- [x] Shared logic: SSRF URL firewall (`validateSsrfSafeUrl`), HMAC-SHA256 webhook signature verification (`verifyWooCommerceWebhookSignature`), deduplication key generator, AES-256-GCM credential encryption & masking (`maskStoreCredentials`), permissions (`INTEGRATIONS_VIEW`, `INTEGRATIONS_MANAGE`), Zod schemas.
- [x] NestJS API: `WooCommerceClient` (REST v3 API), `IntegrationsModule` (store connection, product catalog sync, manual variant mapping, webhook handler, order ingestion with atomic sequence, scheduled/manual reconciliation, one-way stock push with loop prevention, store disconnection).
- [x] Shopeers UI: `/settings/integrations` (WooCommerce Store Gateway, Connect Store modal, live connection test, product catalog sync, order reconciliation modal, product & variant mapping tab with live search/filters, disconnect modal).
- [x] Acceptance gates verified: Gate 1 (replayed webhook creates no duplicate), Gate 2 (invalid signature rejected with 401), Gate 3 (missed events recovered by reconciliation), Gate 4 (SSRF firewall blocks private/loopback/metadata endpoints), 155 passing tests across repo.

### Next Upcoming Milestones:
- **M7 — Returns + Pathao Adapter:** Return workflow, non-restockable damage inspection, Pathao courier adapter.
- **M8 — Notifications:** In-app & email, SMS/WhatsApp adapters, credit ledger.


---

## 5. REPO FILE & MODULE MAP
```
inventoryOS/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── auth/          # AuthService, AuthController, AuthGuard, PermissionsGuard
│   │   │   ├── roles/         # RolesService, RolesController (system + custom tenant roles)
│   │   │   ├── team/          # TeamService, TeamController (staff list, invites, Last-Owner rule)
│   │   │   ├── tenants/       # TenantsService, TenantsController (settings)
│   │   │   └── app.module.ts
│   │   └── test/              # Unit & Integration tests
│   ├── web/
│   │   ├── app/
│   │   │   ├── dashboard/     # Shopeers Analytics Dashboard
│   │   │   ├── login/         # Authentication Screen
│   │   │   ├── register/      # Tenant Onboarding Screen
│   │   │   └── settings/roles # Custom Roles & Permissions Matrix Management
│   │   ├── components/        # Shopeers UI Components (KPIs, Charts, WidgetDrawer, etc.)
│   │   └── lib/               # api.ts (typed HTTP client), supabase.ts (client-side auth)
│   └── worker/
│       └── src/               # pg-boss jobs (system.ping, outbox processor)
├── packages/
│   ├── db/
│   │   ├── src/schema/        # Drizzle schema (tenants, users, roles, memberships, audit_logs)
│   │   └── drizzle/           # SQL migration files
│   └── shared/
│       └── src/               # Zod schemas, Money utility, Permission keys, Order states
├── AI_CONTEXT.md              # <-- THIS FILE (Read first by any AI)
├── PROGRESS.md                # Progress tracker & acceptance checklist
├── DECISIONS.md               # Locked architectural decisions
├── SECURITY_AND_TESTING_RULES.md # Binding security & testing rules
└── ANTI_SLOP_UI_RULES.md      # UI quality, anti-slop guidelines & design tokens
```

---

## 6. COMMAND CHEATSHEET FOR AI AGENTS
- **Run all unit & integration tests:**
  ```powershell
  pnpm test
  ```
- **Run TypeScript compilation check across all projects:**
  ```powershell
  pnpm typecheck
  ```
- **Build Web Frontend:**
  ```powershell
  pnpm --filter @growthomic/web build
  ```
- **Run Development Servers:**
  - Web: `pnpm --filter @growthomic/web dev` (Port 3000)
  - API: `pnpm --filter @growthomic/api start:dev` (Port 3001)

---

## 7. PROTOCOL FOR RESUMING WORK
When switching to this task:
1. Check `PROGRESS.md` for the current milestone status and pending items.
2. Run `pnpm test` and `pnpm typecheck` to verify codebase health.
3. Keep code strictly adherent to `SECURITY_AND_TESTING_RULES.md` and `ANTI_SLOP_UI_RULES.md`.
4. Update `PROGRESS.md` with timestamps and evidence when completing tasks.
