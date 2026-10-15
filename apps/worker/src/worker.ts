import PgBoss from 'pg-boss';
import { env } from './config/env';
import { handleSystemPing } from './jobs/system-ping.job';
import { handleInventoryDriftCheck } from './jobs/inventory-drift-check.job';

export async function startWorker(): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    // In production with pgBouncer transaction mode, pg-boss requires specific config
    // but standard mode works fine if configured correctly.
  });

  boss.on('error', (error) => console.error('pg-boss error:', error));

  await boss.start();

  console.log('Worker started. Registering jobs...');

  await boss.work('system.ping', {
    batchSize: env.WORKER_CONCURRENCY,
    pollingIntervalSeconds: env.WORKER_POLL_INTERVAL_MS / 1000,
  }, async (jobs) => {
    for (const job of Array.isArray(jobs) ? jobs : [jobs]) {
      await handleSystemPing(job);
    }
  });

  await boss.work('inventory.drift-check', {
    batchSize: env.WORKER_CONCURRENCY,
    pollingIntervalSeconds: env.WORKER_POLL_INTERVAL_MS / 1000,
  }, async (jobs) => {
    for (const job of Array.isArray(jobs) ? jobs : [jobs]) {
      await handleInventoryDriftCheck(job as any);
    }
  });

  return boss;
}
