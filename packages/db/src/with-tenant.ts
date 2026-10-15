import { sql } from 'drizzle-orm';
import { db } from './client';
import * as schema from './schema';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { ExtractTablesWithRelations } from 'drizzle-orm';

export type DrizzleTransaction = PgTransaction<PostgresJsQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export async function withTenant<T>(
  tenantId: string,
  actor: { type: 'user' | 'system' | 'worker'; id?: string },
  fn: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // true = transaction-local setting (will automatically clear on commit/rollback)
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`SELECT set_config('app.user_id', ${actor.id ?? ''}, true)`);
    return fn(tx as unknown as DrizzleTransaction);
  });
}

export async function withPlatformAdmin<T>(
  actor: { id: string; reason: string },
  fn: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // Platform admin bypasses some RLS or uses a different role.
    // In M0, this is just a stub. The actual SQL implementation would switch role:
    // await tx.execute(sql`SET ROLE growthomic_platform_admin`);
    // await tx.execute(sql`SELECT set_config('app.admin_id', ${actor.id}, true)`);
    return fn(tx as unknown as DrizzleTransaction);
  });
}

export async function withSystem<T>(
  fn: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.is_system', 'true', true)`);
    return fn(tx as unknown as DrizzleTransaction);
  });
}
