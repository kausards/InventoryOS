# SECURITY & TESTING RULES — Growthomic Inventory & Business OS
**Audience:** every AI coding agent and developer working on this repo.
**Status:** BINDING. Place this file at the repo root. It overrides convenience. If a rule here conflicts with a feature request, stop and ask the owner.
**Companion docs:** `Growthomic_Inventory_OS_PRD_v2.md`, `DECISIONS.md`.

---

# 0. HOW AGENTS MUST USE THIS FILE

1. Read this file fully before starting **every** milestone.
2. In your pre-coding plan, list which sections of this file apply to the milestone.
3. At the end of every milestone, fill in the **Completion Report** (Section 12). A milestone without it is not done.
4. **Never disable, skip, weaken or delete a security control or a test to make something pass.** If a test fails, fix the code or ask the owner.
5. If you are unsure whether something is safe, treat it as unsafe and ask.

---

# 1. TENANT ISOLATION (HIGHEST PRIORITY)

1. Every tenant-owned table has `tenant_id UUID NOT NULL`, RLS enabled and **FORCE ROW LEVEL SECURITY**, policy `USING` and `WITH CHECK` on `tenant_id = current_setting('app.tenant_id', true)::uuid`.
2. The API and worker connect with an app DB role that has **no superuser and no BYPASSRLS**.
3. All DB access goes through `withTenant(...)` from `/packages/db`. Direct pool/client use in feature code is forbidden.
4. Every request/job sets tenant context with transaction-local `set_config(..., true)`.
5. `tenant_id` is resolved from the authenticated user's membership. **Never trust a tenant_id from request body, query or URL.**
6. Every new tenant table in a migration must include RLS policies in the same migration. A tenant table without RLS must fail CI (add a CI check that lists tables with `tenant_id` and no policy).
7. Every ID in a URL/body (order, customer, product…) must be verified to belong to the current tenant (RLS + explicit check). Wrong-tenant IDs return **404**, not 403 (do not reveal existence).
8. Background jobs, exports, report generation, cache keys and file storage paths must all include tenant scope. Cache keys: `tenant:{id}:…`. Storage paths: `/{tenant_id}/…`.
9. Platform admin access uses a separate DB role and `/api/v1/platform/*`; access to tenant business data requires a time-limited, reason-recorded support grant and is audit-logged.
10. Supabase specifics: RLS enabled on **all** tables in exposed schemas; the `anon` key must have no table access; the frontend never uses the Supabase client for data (only for auth if chosen); `service_role` key exists only in backend/worker secrets, never in the frontend or logs.

---

# 2. AUTHENTICATION & AUTHORIZATION

1. Backend verifies the JWT (signature, expiry, issuer, audience) on every request. No endpoint is public unless explicitly listed in `/docs/public-endpoints.md` (health, webhook receivers, auth callbacks).
2. Authorization order on every protected endpoint: **authenticate → tenant membership → permission (`resource.action`) → resource ownership → input validation → business rules → rate limit**.
3. Permissions are enforced on the server. Hiding a button in the UI is never security.
4. Roles/permissions are checked per request (not trusted from the JWT alone). Removing a staff member or changing a role takes effect immediately; revoke sessions on removal.
5. Owner and Platform Admin accounts require 2FA (enforce before production).
6. Invitations: single-use, expiring token, bound to an email, stored hashed.
7. Login, password reset, invite and OTP endpoints are rate limited with lockout/backoff; responses must not reveal whether an account exists.
8. Sensitive actions (export data, change role, delete/anonymize, change integration credentials, finalize payroll, approve manual payment) require the specific permission and create an audit log entry. Consider re-authentication for the most sensitive ones.
9. Every tenant has at least one Owner; this must be enforced in code and tested.

---

# 3. INPUT VALIDATION & OUTPUT HANDLING

1. Validate **all** input on the server with Zod (or equivalent) — body, query, params, headers, webhook payloads, CSV rows. Reject unknown fields.
2. Use parameterized queries via Drizzle. **No string-concatenated SQL.** Raw SQL only in migrations and reviewed helpers, always parameterized.
3. Output: never return internal fields (password hashes, encrypted secrets, internal notes, other tenants' info). Use explicit response DTOs/serializers; do not return raw DB rows.
4. Frontend: no `dangerouslySetInnerHTML` with user/provider content. Escape everything by default. Sanitize any rich text.
5. CSV/Excel import and export: protect against **formula injection** (prefix cells beginning with `= + - @` when exporting), limit file size and row count, validate encoding, process async.
6. Pagination limits enforced server-side (max page size). No unbounded queries.
7. Money inputs: integers (paisa) only, validated for range and sign.

---

# 4. SECRETS, CREDENTIALS & ENCRYPTION

1. Secrets live only in platform secret managers / env vars. **Never commit secrets.** `.env.example` has placeholders only. Add secret scanning in CI (e.g., gitleaks).
2. Integration credentials (courier keys, WooCommerce keys, SMS/WhatsApp keys, payment gateway keys) are **encrypted at rest** (AES-256-GCM with a master key from env/KMS; store key version; support rotation). Never returned by any API; show only masked last 4 characters.
3. Never log secrets, tokens, passwords, full phone numbers where avoidable, full addresses, payment details or provider raw responses containing credentials. Use a logging redaction list.
4. Error messages returned to clients must not contain stack traces, SQL, secrets or provider internals. Log details server-side with a request ID.
5. HTTPS everywhere; HSTS on the frontend and API; secure, HttpOnly, SameSite cookies if cookies are used.
6. Passwords are never stored by us if using Supabase Auth. Any API keys we issue to tenants are shown once and stored hashed.
7. Key rotation procedure documented in `/docs/runbook.md`.

---

# 5. WEBHOOKS & EXTERNAL INTEGRATIONS

1. Verify the provider's signature on every webhook (HMAC with constant-time compare). Reject invalid signatures with no detail.
2. Replay protection: check timestamp tolerance where the provider supplies it, and dedupe by provider event ID (`integration_events` unique key).
3. Webhook endpoints persist the event, enqueue a job and respond quickly. Heavy work happens in the worker.
4. Outbound calls: timeouts, retries with backoff, circuit-breaker behavior, and **SSRF protection** — when a tenant supplies a website URL, validate scheme (https), block private/loopback/link-local IP ranges and internal hostnames, restrict redirects.
5. Idempotency keys on every create-type external call (shipments, payments). On ambiguous outcomes, reconcile before retry.
6. Provider responses are untrusted input: validate with schemas before use.
7. Courier fraud-check calls: rate limited, cached per normalized phone, logged with source/timestamp; provider failure never yields "Low Risk".
8. Webhook secrets/tokens per store/provider are unique, random and rotatable.

---

# 6. API SECURITY

1. CORS: allow only the configured frontend origin(s). No wildcard with credentials.
2. Security headers on frontend and API (CSP, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy).
3. CSRF protection if cookie-based sessions are used; if Bearer tokens only, document it.
4. Rate limits: per IP and per tenant; stricter on auth, invites, webhooks, exports, courier fraud-check and message sending. Plan-based limits for API usage.
5. Request size limits; reject oversized bodies.
6. Mass-assignment protection: DTOs allow-list fields (a client must never set `tenant_id`, `status`, `created_by`, price snapshots, etc. unless the endpoint is specifically for that).
7. IDOR protection: ownership checks on every resource access (Section 1.7).
8. State-changing endpoints for orders/shipments/payments accept an `Idempotency-Key`.
9. All errors use the consistent error format with request ID.

---

# 6B. FRONTEND SECURITY

1. No secrets, service keys or provider credentials in the frontend bundle or `NEXT_PUBLIC_*` variables (only the public API URL and public auth keys).
2. Do not store tokens in localStorage if avoidable; prefer secure cookie/session handling per the auth provider's recommendation.
3. Permission-aware UI is a convenience only; the server decides.
4. Third-party scripts: avoid; if needed, pin versions and use CSP.

---

# 7. FILES & STORAGE

1. Private buckets only. Access through short-lived signed URLs, scoped to tenant paths.
2. Validate upload type by content (magic bytes), not just extension; enforce max size; generate our own file names; never serve user uploads from the app origin as executable content.
3. Generated documents (invoices, labels, exports) stored under `/{tenant_id}/…` with expiring URLs and logged access for exports.

---

# 8. PERSONAL DATA, PRIVACY & RETENTION

1. Treat phone, address, email and order history as personal data. Collect/store only what is needed.
2. Mask phone numbers in lists/logs by default for roles without the permission to view full numbers (optional per-tenant setting).
3. Export of customer data requires `*.export` permission, is audit-logged, and is rate limited.
4. Implement retention, export and anonymization per PRD Part Y.3. Anonymization keeps financial totals but removes personal identifiers.
5. SMS/WhatsApp messaging requires customer consent tracking and opt-out handling.

---

# 9. BILLING & FINANCIAL INTEGRITY (SECURITY VIEW)

1. A subscription is marked paid **only** from a server-verified gateway callback/webhook or an admin-verified manual payment. Never from a browser redirect.
2. Payment webhooks are idempotent; duplicates never create double entitlements or double credits.
3. Posted financial records, inventory movements, order status history and audit logs are append-only: no UPDATE/DELETE for the app role; corrections via reversal entries.
4. Plan limits and feature flags are enforced server-side from `plan_entitlements`.
5. Money is integer paisa; no floats; rounding rules documented and tested.
6. Message credits (SMS/WhatsApp) are a ledger; balance cannot go negative; deductions are atomic.

---

# 10. DEPENDENCIES, BUILD & INFRASTRUCTURE

1. Lockfile committed. Pin exact versions for critical packages. Prefer package versions at least 14 days old. Add only necessary dependencies; justify each new one in the PR/report.
2. CI runs dependency audit (`pnpm audit` or equivalent) and secret scanning; high/critical findings block release.
3. Separate dev/staging/production databases, secrets and queues. Production data is never used in dev.
4. DB roles: migration role (schema changes), app role (RLS enforced, minimal grants), platform-admin role (separate). No role has more than it needs.
5. Backups: automated, with a **tested restore** before launch and on a schedule.
6. Error monitoring and alerting configured (Sentry or equivalent); alert on auth failures spikes, webhook signature failures, job dead-letters, RLS/permission errors.
7. Production deploys come from the main branch via CI only.

---

# 10B. AI-SPECIFIC SECURITY (AGENT MODULE & CODING AGENTS)

1. Chat content from customers (Facebook/WhatsApp) is **untrusted input**. It may contain prompt-injection. AI features may only produce *drafts/suggestions* that a human confirms; AI output never directly changes stock, money, order status beyond `pending`, or permissions.
2. AI module uses a scoped, per-tenant API key with least privilege and rate limits.
3. AI-created records are marked `created_by = ai` and require human confirmation before reservation/shipment.
4. Do not send secrets or unnecessary personal data to AI providers; redact where possible.
5. **Coding agents:** never add backdoors, debug bypasses, hard-coded credentials, test accounts with real permissions in production code, or "temporary" disabled auth. Never run destructive DB commands against staging/production without owner approval.

---

# 11. TESTING STANDARDS

## 11.1 Principles
1. **Test-first** for anything touching money, stock, tenant isolation, permissions, state transitions, billing.
2. Integration tests use a **real Postgres** (CI service container), not DB mocks. RLS can only be tested against a real database with the app role.
3. Every bug fixed gets a **regression test** first.
4. Tests must be deterministic (no real network, fixed clocks, seeded IDs). External providers are faked via adapters/contract fixtures.
5. Never delete or loosen a test to make CI pass. A failing test is a finding.
6. Changing behavior = update tests, docs, and the PRD/DECISIONS in the same change.

## 11.2 Test locations (repo structure)
```
/packages/shared/src/**/__tests__        unit tests (money, state machine, phone, permissions)
/packages/db/tests/rls                   RLS & tenant-isolation tests (two tenants, app role)
/packages/db/tests/migrations            migration up/down and policy-presence checks
/apps/api/test/unit                      service/domain unit tests
/apps/api/test/integration               API + real DB (authz matrix, business rules)
/apps/api/test/security                  security tests (IDOR, mass-assignment, rate limit, headers, injection)
/apps/api/test/contracts                 provider contract tests with recorded fixtures (WooCommerce, couriers, gateways)
/apps/worker/test                        job tests (tenant context, retries, dead-letter, idempotency)
/apps/web/__tests__                      component tests
/e2e                                     Playwright end-to-end flows
/load                                    load/perf scripts (k6 or similar)
/docs/test-plan.md                       living test plan (what is covered, what is not)
```

## 11.3 Required test types per area
| Area | Required tests (minimum) | Where |
|------|--------------------------|-------|
| Tenant isolation | Cross-tenant read/update/delete/insert denied; no-context returns nothing; pooled connection leak; worker without tenant rejected; platform admin blocked without grant | `/packages/db/tests/rls`, `/apps/api/test/security` |
| Authorization | Permission matrix test: every endpoint × every role → expected allow/deny; 404 for wrong-tenant IDs | `/apps/api/test/integration` |
| Orders | State machine (allowed/rejected transitions), duplicate external order, duplicate webhook, cancel releases reservation once, edit before/after shipment, bulk partial failure | shared unit + api integration |
| Inventory | Concurrent reservation (parallel transactions), ledger = balance, no negative stock, adjustments, bundles, return sellable/damaged | api integration + db |
| Courier | Success, validation fail, timeout → reconcile, duplicate shipment prevention, out-of-order tracking, settlement partial/mismatch, fraud-check provider down → not "low" | contracts + integration |
| Integrations | Webhook signature valid/invalid, replay, dedupe, SSRF block, reconciliation recovers missed event, no sync loop | integration + contracts |
| Finance | Worked example in paisa, discount, COGS snapshot, cost change after sale, return, partial refund, reversal, report reconciles to ledger | shared unit + integration |
| Billing | Verified payment only, duplicate webhook idempotent, limits enforced, downgrade rules, expiry keeps data | integration |
| Notifications | Credit deduction atomic, exhausted credits, consent/opt-out, retry safe | integration + worker |
| Security | IDOR, mass assignment, injection attempts, CSV formula injection, oversized body, rate-limit, headers, secrets not in responses/logs | `/apps/api/test/security` |
| E2E | Signup → create tenant → add product → create order → confirm → create shipment (fake courier) → deliver → see profit; staff with limited role is denied finance | `/e2e` |
| Load | Order spike scenario (Eid-like), webhook burst, dashboard query latency with seeded large data | `/load` |

## 11.4 Coverage & CI gates
- Coverage thresholds: **≥ 90%** for `/packages/shared` (money, state machine, finance formulas, phone) and finance/inventory domain code; **≥ 75%** overall for backend. Thresholds enforced in CI.
- CI stages (all must pass to merge): install → lint → typecheck → unit → **RLS tests** → integration → security tests → contract tests → build → secret scan → dependency audit. E2E runs on staging/pre-release; load tests before major releases.
- No merge with failing, skipped (`.skip`/`.only`) or quarantined tests without owner-approved written reason.
- Flaky tests: fix within the same milestone; do not retry-loop to hide them.

## 11.5 Test data & helpers
- Provide factories/fixtures: `createTenant`, `createUser`, `createMembership`, `createProduct`, `createOrder`, etc., always creating **two tenants** by default in isolation suites.
- Test DB is reset per suite (migrations applied from scratch) so migration problems surface.
- Provider fixtures live in `/apps/api/test/contracts/fixtures` and are refreshed when providers change docs.

## 11.6 Test maintenance
- `/docs/test-plan.md` is updated each milestone: features covered, test files, known gaps.
- Each PR/milestone that adds an endpoint adds it to the **authorization matrix test** and the **security test list**.
- Each new tenant table adds RLS tests (or is covered by the generic "all tenant tables" RLS test that iterates over the catalog).
- Quarterly (or before major release): re-run full security checklist, restore backup test, dependency audit review.

## 11.7 Manual QA before each release
- Log in as each role and confirm denied pages/actions are denied by the **server** (call APIs directly, not just UI).
- Try cross-tenant ID guessing with two real accounts.
- Place duplicate orders / replay a webhook in staging.
- Force a courier timeout in staging and confirm no duplicate shipment.
- Check logs for secrets/PII.
- Confirm expired subscription → read-only, data intact.

---

# 12. COMPLETION REPORT (agent must output this at the end of every milestone)

```
MILESTONE: Mx — <name>
SECURITY SECTIONS APPLIED: <list of section numbers>
NEW TABLES: <list>  → RLS policy present? yes/no each
NEW ENDPOINTS: <list> → permission + ownership check + validation + rate limit? yes/no each
NEW JOBS: <list> → tenant_id enforced? idempotent? yes/no
NEW SECRETS/ENV VARS: <list> → in .env.example? encrypted at rest? yes/no
NEW DEPENDENCIES: <list + reason>
TESTS ADDED: <file paths>   COVERAGE: <numbers>
CI RESULT: all stages green? yes/no
KNOWN RISKS / SHORTCUTS: <honest list>
DOCS UPDATED: DECISIONS.md / CHANGELOG.md / test-plan.md / permission-matrix.md / .env.example
OPEN QUESTIONS FOR OWNER: <list>
```

---

# 13. FORBIDDEN ACTIONS (NEVER, EVEN IF ASKED TO "MAKE IT WORK")

- Using service-role/superuser DB credentials for normal API or worker traffic.
- Creating a tenant table without RLS.
- Trusting client-supplied `tenant_id`, role, price, cost or status.
- Skipping server-side permission checks because "the UI hides it".
- Logging or returning secrets, tokens, or full credentials.
- Disabling RLS, auth, CORS restrictions, rate limits or tests to get unblocked.
- Updating/deleting ledger, inventory movement, status history or audit log rows.
- Marking a payment/subscription paid from a client-side signal.
- Fetching arbitrary tenant-supplied URLs without SSRF protection.
- Using floats for money.
- Committing `.env` files, keys or production data.
- Adding unreviewed dependencies or running unknown install scripts.
- Letting AI output directly change stock, money or order state beyond draft creation.

---

# 14. PER-MILESTONE SECURITY & TEST FOCUS (QUICK GUIDE)

| Milestone | Security focus | Must-have tests |
|-----------|---------------|-----------------|
| M0 | RLS foundation, withTenant, app role, secret hygiene, CI gates | 8 RLS tests, money/state/phone unit tests, CI secret scan |
| M1 | JWT verification, memberships, roles, invitations, audit log, 2FA plan | Authorization matrix, invite expiry/reuse, last-owner rule, audit append-only |
| M2 | Ledger immutability, concurrency, file/CSV safety | Concurrent reservation, ledger=balance, negative stock blocked, CSV injection/size |
| M3 | State machine, IDOR on orders/customers, duplicate prevention | Transition tests, cross-tenant order access 404, duplicate order |
| M4 | PDF/doc access, risk engine fail-safe | Signed URL expiry/tenant scope, "unknown ≠ low" |
| M5 | Credential encryption, idempotency, timeout reconciliation, fraud-check handling | Timeout/duplicate shipment, credentials never in responses, rate-limited fraud checks |
| M6 | Webhook signature/replay, SSRF, sync loops | Signature invalid/valid, replay, SSRF block, reconciliation |
| M7 | Return/stock integrity | Courier "returned" ≠ stock in |
| M8 | Message credit ledger, consent | Atomic credit deduction, opt-out |
| M9 | Finance immutability, report reconciliation | Worked example, reversal, report = ledger |
| M10 | Payment verification, entitlement enforcement | Duplicate webhook, forged redirect, downgrade rules |
| M11 | Full security review, load, backup/restore, retention/anonymization | Full manual QA list, restore test, penetration-style checklist |