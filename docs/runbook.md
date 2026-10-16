# Shopeers Production Operations & Incident Response Runbook

**Version:** 1.0.0  
**Scope:** Production Ops, Site Reliability Engineering (SRE), On-Call Runbook  
**Last Review:** October 2026

---

## 1. Service Health & Monitoring Telemetry

### 1.1 Health Check Endpoints

| Endpoint | Target | Expected Status |
|---|---|---|
| `GET /api/v1/health` | API Liveness & DB connectivity | `200 OK` `{ "status": "ok", "db": "connected" }` |
| `GET /api/v1/health/ready` | Queue worker & Cache readiness | `200 OK` `{ "queue": "ready" }` |

### 1.2 Alert Thresholds Matrix

| Metric | Warning Threshold | Critical Incident Threshold | Immediate Action |
|---|---|---|---|
| **API Latency (p95)** | > 350 ms for 3 min | > 800 ms for 1 min | Check slow query logs, database connection pool |
| **HTTP 5xx Error Rate** | > 0.5% | > 2.0% | Inspect NestJS logger logs, trigger rollback if post-deploy |
| **PostgreSQL Pool Usage** | > 75% pool active | > 90% pool active | Inspect hanging transactions, kill idle-in-transaction |
| **Redis / Queue Delay** | > 15 seconds | > 60 seconds | Scale background worker instances |
| **Courier Error Rate** | > 10% failed bookings | > 30% failed bookings | Check courier gateway status (Steadfast/Pathao) |

---

## 2. Standard Incident Runbooks

### Runbook 1: Courier Gateway Outage (Steadfast or Pathao Down)

**Symptoms:**
- Orders fail to transition from `confirmed` to `shipped`.
- Shipments report `provider_unavailable` or HTTP 502/504 errors from Steadfast API (`https://portal.steadfast.com.bd/api/v1/...`).

**Mitigation Protocol:**
1. Check courier status page or ping adapter health.
2. Ensure orders remain in `confirmed` status without failing the customer checkout.
3. Outbox background dispatcher (`shipment-dispatch-worker`) will automatically retry booking with exponential backoff (1m, 5m, 15m, 1h).
4. If outage exceeds 2 hours, instruct logistics team to switch default courier in `/settings/couriers` to secondary provider (e.g. switch from Steadfast to Pathao).

---

### Runbook 2: Webhook Storm & Deduplication

**Symptoms:**
- Massive spike in `POST /api/v1/integrations/stores/:id/webhooks`.
- External store (WooCommerce / Shopify) repeatedly sends identical event payloads due to network timeouts.

**Mitigation Protocol:**
1. Verify idempotency filter:
   - Shopeers uses deterministic idempotency keying: `storeId:topic:resourceId:date`.
   - Existing events are immediately logged as `ignored_duplicate` with HTTP 200 OK response (preventing external retry storms).
2. If memory spikes, temporarily increase rate limiting on `/integrations/stores/:id/webhooks` to 100 req/min per IP.

---

### Runbook 3: Database Lock Contention During Flash Sales

**Symptoms:**
- High transaction latency on `orders` or `warehouse_stock_balances` table.
- PostgreSQL alert: `canceling statement due to lock timeout`.

**Mitigation Protocol:**
1. Identify blocking queries:
   ```sql
   SELECT pid, age(clock_timestamp(), query_start), usename, query 
   FROM pg_stat_activity 
   WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%' 
   ORDER BY query_start ASC;
   ```
2. Terminate long-running lock holder:
   ```sql
   SELECT pg_terminate_backend(<pid>);
   ```
3. Verify that stock reservation uses atomic conditional decrement (`UPDATE warehouse_stock_balances SET available = available - qty WHERE available >= qty`) instead of full table locks.

---

### Runbook 4: Emergency Rollback of Faulty CSV Import Batch

**Symptoms:**
- Tenant accidentally imported a CSV file with corrupted prices, incorrect categories, or duplicate customer records.

**Mitigation Protocol:**
1. Go to `/settings/import` in Shopeers Web UI.
2. Locate the batch under **Import History & Undo Last Batch**.
3. Click **Undo Batch**.
4. The system will execute an atomic rollback transaction:
   - For `products`: deletes associated stock balances, inventory movements, variants, and product records.
   - For `customers`: deletes associated address records and customer profiles.
   - For `orders`: deletes status history, order items, and order records.
   - The batch status transitions to `reverted` and an immutable audit event (`IMPORT_REVERTED`) is logged.
5. Alternatively, invoke the API directly:
   ```bash
   curl -X POST "https://api.shopeers.com/api/v1/imports/batches/<BATCH_ID>/undo" \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "x-tenant-id: <TENANT_ID>"
   ```

---

### Runbook 5: Customer Privacy & Data Anonymization Request

**Symptoms:**
- Customer requests data erasure under privacy policy or Bangladesh Cyber Security Act regulations.

**Mitigation Protocol:**
1. Navigate to Customers CRM in Shopeers UI or call API:
   ```bash
   curl -X POST "https://api.shopeers.com/api/v1/customers/<CUSTOMER_ID>/anonymize" \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "x-tenant-id: <TENANT_ID>"
   ```
2. Confirm PII redaction:
   - Name replaced by `'Anonymized Customer'`.
   - Phone replaced by `'00000000000-xxxx'`.
   - Addresses replaced by `'[REDACTED]'`.
   - Order history counts, invoice totals, and accounting aggregates are safely retained for compliance.
