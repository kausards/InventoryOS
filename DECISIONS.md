# DECISIONS.md — Growthomic Inventory & Business OS

All architecture decisions below are **LOCKED**. To change any decision: open a PR with a new
entry below the existing one (do NOT overwrite), explain the reason for the change, and update
the code in the same PR. Never silently deviate from these decisions.

---

## Architecture Decisions

| # | Decision | Choice | Date | Reason |
|---|----------|--------|------|--------|
| B1 | Deployment layout | Three separately deployed units: Frontend (Vercel), Backend API (Railway/Render/Fly), Worker (Railway/Render/Fly) | 2026-10-10 | Clear separation of concerns; independent scaling; worker can be taken down without affecting API |
| B2 | Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, deployed on Vercel. Calls **only** the Backend API. No direct DB queries from the frontend. | 2026-10-10 | App Router is the current Next.js standard; Vercel is the native deployment target; shadcn/ui provides accessible unstyled base |
| B3 | Backend API | NestJS + TypeScript, deployed on Railway/Render/Fly as a long-running service. REST, versioned `/api/v1`. Zod for all input validation. | 2026-10-10 | NestJS enforces module structure; class-validator/Zod gives type-safe validation; versioning future-proofs API |
| B4 | Worker | Same codebase packages as backend (shared packages), separate process/service. Runs queues, scheduled jobs, webhook processing, sync, exports. | 2026-10-10 | Separate process for independent scaling and failure isolation; shared packages avoid duplication |
| B5 | Database | Managed PostgreSQL on **Supabase** (Singapore region). Accessed through **Drizzle ORM** with **Drizzle Kit** migrations (LOCKED). RLS policies and raw SQL inside Drizzle migration files. No schema changes outside migrations. | 2026-10-10 | Supabase provides managed Postgres with RLS support; Drizzle is type-safe and migration-first; Singapore for Bangladesh latency |
| B6 | Auth | Supabase Auth. Backend verifies JWT on every request. Tenant membership/roles are in our own tables, not in JWT claims. | 2026-10-10 | Supabase Auth is production-ready; keeping roles in our DB keeps auth provider swap-able |
| B7 | Queue | **pg-boss** (Postgres-backed, no extra infra). Move to Redis/BullMQ only if load requires it. | 2026-10-10 | No extra infrastructure for MVP; pg-boss is battle-tested; shares the existing Postgres connection |
| B8 | Money | **Integer minor units (paisa) stored as BIGINT.** Currency column on every money row. No floats anywhere in business logic or DB. | 2026-10-10 | Floating-point arithmetic is unsuitable for money; paisa integers are exact; consistent with Bangladesh currency (BDT) |
| B9 | Ledger | **Simple single-entry transaction ledger for MVP**, schema designed so double-entry can be added later without altering existing rows. | 2026-10-10 | MVP needs simplicity; `account_id` nullable column is the hook for future double-entry migration |
| B10 | Tenant isolation | PostgreSQL RLS **plus** server-side checks (defense in depth). See PRD Part C and SECURITY_AND_TESTING_RULES.md §1. | 2026-10-10 | RLS ensures DB-level isolation even if application code has bugs; server-side checks provide additional defense |
| B11 | Source of truth for stock | SaaS inventory ledger. Website sync is **one-way (SaaS → website)** in MVP. Two-way sync is Release 3 and needs a written conflict-resolution rule first. | 2026-10-10 | Avoids conflict-resolution complexity in MVP |
| B12 | Events | Transactional outbox pattern. Domain events written to `outbox_events` in the **same DB transaction** as the state change. | 2026-10-10 | Guarantees event delivery even if the worker crashes; atomic with the state change; no two-phase commit needed |
| B13 | Plan limits | Feature flags + entitlements table; enforced server-side only; never hard-coded in the frontend. | 2026-10-10 | Server-side enforcement is mandatory; entitlements table allows plan changes without code deployments |
| B14 | Languages | UI: English + Bangla (i18n from day one). i18n keys only; no hard-coded UI strings. | 2026-10-10 | Bangladesh market requirement; retrofitting i18n is expensive; `next-intl` is the chosen library |
| B15 | Timezone | Tenant timezone default `Asia/Dhaka`; all timestamps stored UTC. | 2026-10-10 | UTC storage is the global standard; tenant-local display is a formatting concern |
| B16 | Tax | Tax-exclusive in MVP; schema keeps `tax_amount` columns (default 0) for future. | 2026-10-10 | Bangladesh e-commerce does not typically surface VAT to end customers in MVP; extensible later |

---

## Tooling Decisions

| # | Decision | Choice | Date | Reason |
|---|----------|--------|------|--------|
| T1 | Monorepo | pnpm workspaces | 2026-10-10 | Fast installs, native workspace support, strict by default |
| T2 | TypeScript | Strict mode (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | 2026-10-10 | Catches bugs at compile time; no `any` escapes |
| T3 | Testing | Vitest for unit/integration; real Postgres in CI (service container). No DB mocks. | 2026-10-10 | RLS can only be tested against real Postgres; Vitest is fast and ESM-native |
| T4 | Secret scanning | Gitleaks in CI | 2026-10-10 | Mandatory per SECURITY_AND_TESTING_RULES.md §4 |
| T5 | Dependency audit | `pnpm audit` in CI; high/critical block release | 2026-10-10 | Mandatory per SECURITY_AND_TESTING_RULES.md §10 |

---

_Last updated: 2026-10-10 (M0 initial)_
