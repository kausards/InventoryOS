import type { Job } from 'pg-boss';
import { withTenant } from '@growthomic/db';

export function withTenantGuard<T>(
  handler: (job: Job) => Promise<T>
): (job: Job) => Promise<T> {
  return async (job: Job) => {
    const data = job.data as { tenantId?: string } | undefined;
    
    if (!data?.tenantId) {
      throw new Error(`[Security] Job ${job.id} rejected: Missing tenantId in payload.`);
    }

    // Process job within a tenant-scoped transaction
    return withTenant(data.tenantId, { type: 'worker' }, async (_tx) => {
      // We pass the transaction object to the handler if needed, 
      // but typically we can just let it run. 
      // Note: In a real implementation, the handler would need to use `tx` 
      // or we use ALS (AsyncLocalStorage) to inject it into queries.
      // For M0, we just ensure it's wrapped.
      return handler(job);
    });
  };
}
