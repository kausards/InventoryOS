# Shopeers Database Backup & Disaster Recovery Runbook

**Version:** 1.0.0  
**Target RPO (Recovery Point Objective):** < 1 Hour  
**Target RTO (Recovery Time Objective):** < 4 Hours  
**Database:** PostgreSQL 16+ (Supabase / Self-Hosted Managed PG)

---

## 1. Backup Architecture & Schedule

Shopeers employs a 3-tier backup strategy to guarantee zero data loss and business continuity:

```
[ Primary Database ]
        │
        ├── 1. Continuous Write-Ahead Logging (WAL-G / Archiving) ──► S3 / Cloud Storage (RPO < 5 min)
        │
        ├── 2. Daily Full Logical Dumps (pg_dump) ──────────────────► Offsite Cold Storage (Encrypted AES-256)
        │
        └── 3. Pre-Migration Snapshots ─────────────────────────────► Stored before every drizzle-kit migration
```

### 1.1 Automated Schedule

| Backup Type | Frequency | Retention | Storage Target |
|---|---|---|---|
| **Continuous WAL** | Real-time streaming | 14 Days | S3 Glacier Instant Retrieval / Cloudflare R2 |
| **Daily Full Dump** | Daily at 03:00 BST (UTC+6) | 30 Days | Encrypted Geo-Replicated Bucket |
| **Weekly Archive** | Sunday at 04:00 BST | 1 Year | Cold Archive (Compliance & Audits) |
| **Pre-Deploy Snapshot** | Before schema migrations | 7 Days | Hot Storage |

---

## 2. Standard Operating Procedures (SOP)

### 2.1 Generating a Manual Production Backup

Run the standard logical backup script:

```bash
#!/bin/bash
# scripts/backup-database.sh
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/shopeers"
BACKUP_FILE="${BACKUP_DIR}/shopeers_prod_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "==> Starting Shopeers PostgreSQL logical dump..."
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --dbname="${DATABASE_URL}" \
  --file="${BACKUP_FILE}"

echo "==> Encrypting backup file with AES-256..."
openssl enc -aes-256-cbc -salt -in "${BACKUP_FILE}" -out "${BACKUP_FILE}.enc" -pass env:BACKUP_ENCRYPTION_KEY
rm -f "${BACKUP_FILE}"

echo "==> Uploading encrypted backup to offsite bucket..."
aws s3 cp "${BACKUP_FILE}.enc" "s3://${BACKUP_S3_BUCKET}/daily/${TIMESTAMP}.dump.enc"

echo "==> Backup completed successfully: ${TIMESTAMP}"
```

---

## 3. Disaster Recovery & Restoration Drill

### 3.1 Point-in-Time Recovery (PITR) Procedure

If data corruption or accidental tenant deletion occurs:

1. **Isolate Affected Node:**
   Set API servers into maintenance mode:
   ```bash
   pnpm run ops:maintenance-on
   ```
2. **Download Target Backup:**
   ```bash
   aws s3 cp "s3://${BACKUP_S3_BUCKET}/daily/20261016_030000.dump.enc" ./backup.dump.enc
   ```
3. **Decrypt the Backup File:**
   ```bash
   openssl enc -d -aes-256-cbc -in ./backup.dump.enc -out ./backup.dump -pass env:BACKUP_ENCRYPTION_KEY
   ```
4. **Restore to Staging / Clean Database:**
   ```bash
   pg_restore \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     --dbname="${TARGET_DATABASE_URL}" \
     ./backup.dump
   ```
5. **Re-apply Journal Migrations (if applicable):**
   ```bash
   pnpm --filter @growthomic/db run db:migrate
   ```
6. **Verify Data Integrity:**
   - Execute test query verifying tenant record count and latest order sequence.
   - Run verification test: `pnpm --filter @growthomic/api test:e2e`.
7. **Resume Traffic:**
   ```bash
   pnpm run ops:maintenance-off
   ```

---

## 4. Disaster Recovery Drills

- **Cadence:** Bi-monthly scheduled recovery drills conducted on a dedicated staging replica.
- **Verification Criteria:**
  1. Clean database restore within 45 minutes.
  2. All 13 migrations intact and verified.
  3. RLS policies active and isolating test tenants.
  4. Encrypted courier credentials successfully decryptable with active production secret key.
