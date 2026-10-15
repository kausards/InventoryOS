# Deployment Guide

## Infrastructure Architecture
- **Web**: Next.js App Router -> Vercel
- **API**: NestJS backend -> Railway / Render / Fly
- **Worker**: pg-boss background worker -> Railway / Render / Fly
- **Database**: PostgreSQL (Supabase) in Singapore region

## Environment Variables

### Web (`apps/web/.env`)
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEFAULT_LOCALE`

### API (`apps/api/.env`)
- `DATABASE_URL`: Must be the **transaction-mode connection pooler URL** (port 6543)
- `DATABASE_URL_DIRECT`: Direct connection for migrations (port 5432)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `ENCRYPTION_KEY`
- `FRONTEND_URL`

### Worker (`apps/worker/.env`)
- `DATABASE_URL`: Same transaction-mode connection pooler URL as API
- `WORKER_CONCURRENCY`: e.g. 5
- `WORKER_POLL_INTERVAL_MS`: e.g. 2000

## Connection Pooling Note
Because we use transaction-local settings (`set_config(..., true)`), our tenant isolation is safe with transaction-mode connection pooling. Context is scoped specifically to each transaction and does not leak across requests reusing the same connection.
