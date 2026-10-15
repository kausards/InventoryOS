import { describe, it, expect, vi } from 'vitest';
import { handleInventoryDriftCheck } from '../src/jobs/inventory-drift-check.job';
import * as dbModule from '@growthomic/db';

describe('Worker Job: inventory.drift-check', () => {
  it('throws error if tenantId is missing in payload', async () => {
    const job: any = { id: 'job-err', data: {} };
    await expect(handleInventoryDriftCheck(job)).rejects.toThrow('Missing tenantId in payload');
  });

  it('runs drift check and detects drift when ledger sum does not match cached onHand', async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Balances query: 1 record with onHand: 50
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { id: 'bal-1', warehouseId: 'wh-1', variantId: 'var-1', onHand: 50 },
      ]),
    });

    // 2. Sum inventory ledger movements: sum is 47 (3 units drift!)
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ total: 47 }]),
    });

    const job: any = {
      id: 'job-drift-1',
      data: { tenantId: 't-1', warehouseId: 'wh-1' },
    };

    const res = await handleInventoryDriftCheck(job);

    expect(res.success).toBe(true);
    expect(res.scanned).toBe(1);
    expect(res.drifted).toBe(1);
    expect(res.reports[0].drift).toBe(3);
    // Verified that audit log was inserted for drift anomaly
    expect(mockTx.insert).toHaveBeenCalledTimes(1);
  });

  it('reports zero drift when ledger sum strictly matches cached onHand', async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Balances query: 1 record with onHand: 20
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { id: 'bal-1', warehouseId: 'wh-1', variantId: 'var-1', onHand: 20 },
      ]),
    });

    // 2. Sum inventory ledger movements: sum is 20
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ total: 20 }]),
    });

    const job: any = {
      id: 'job-drift-2',
      data: { tenantId: 't-1' },
    };

    const res = await handleInventoryDriftCheck(job);

    expect(res.success).toBe(true);
    expect(res.scanned).toBe(1);
    expect(res.drifted).toBe(0);
    expect(mockTx.insert).not.toHaveBeenCalled();
  });
});
