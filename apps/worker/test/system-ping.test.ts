import { describe, it, expect } from 'vitest';
import { handleSystemPing } from '../src/jobs/system-ping.job';

describe('system-ping', () => {
  it('returns success', async () => {
    const job: any = { id: 'job-123', data: { time: Date.now() } };
    const result = await handleSystemPing(job);
    
    expect(result.success).toBe(true);
    expect(result.processedAt).toBeDefined();
  });
});
