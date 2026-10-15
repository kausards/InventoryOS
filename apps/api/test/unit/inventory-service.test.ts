import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from '../../src/inventory/inventory.service';
import * as dbModule from '@growthomic/db';

describe('InventoryService - Stock Balances, Ledger & Atomic Operations', () => {
  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService();
    vi.restoreAllMocks();
  });

  describe('reserveStock (Atomic Reservation)', () => {
    it('throws BadRequestException if requested quantity exceeds available stock', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // Balance lookup: onHand: 10, reserved: 8, available: 2
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'sb-1', onHand: 10, reserved: 8, available: 2 },
        ]),
      });

      // Attempting to reserve 5 when available is 2
      await expect(
        service.reserveStock('t-1', 'actor-1', {
          warehouseId: 'wh-1',
          variantId: 'var-1',
          quantity: 5,
          referenceType: 'order',
          referenceId: 'ord-100',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully reserves stock, updates balances, and appends to ledger', async () => {
      const mockTx = {
        select: vi.fn(),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'sb-1', onHand: 10, reserved: 2, available: 8 },
        ]),
      });

      const res = await service.reserveStock('t-1', 'actor-1', {
        warehouseId: 'wh-1',
        variantId: 'var-1',
        quantity: 3,
        referenceType: 'order',
        referenceId: 'ord-100',
      });

      expect(res.reserved).toBe(5);
      expect(res.available).toBe(5);
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled(); // appends to inventory_movements
    });

    it('concurrent reservations: only the first request succeeds when remaining stock cannot satisfy both', async () => {
      let currentOnHand = 5;
      let currentReserved = 3; // available: 2
      let lockQueue = Promise.resolve();

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => {
        // Simulate database transaction row lock (FOR UPDATE serialization)
        const previousLock = lockQueue;
        let releaseLock: () => void;
        lockQueue = new Promise((resolve) => {
          releaseLock = resolve;
        });
        await previousLock;

        try {
          const mockTx = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              for: vi.fn().mockReturnThis(),
              limit: vi.fn().mockImplementation(async () => {
                const available = currentOnHand - currentReserved;
                return [{ id: 'sb-1', onHand: currentOnHand, reserved: currentReserved, available }];
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockImplementation((payload: any) => {
                if (payload.reserved !== undefined) {
                  currentReserved = payload.reserved;
                }
                return {
                  where: vi.fn().mockResolvedValue({}),
                };
              }),
            }),
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockResolvedValue({}),
            }),
          };
          return await cb(mockTx);
        } finally {
          releaseLock!();
        }
      });

      // Two simultaneous reservation requests each requesting 2 units
      const req1 = service.reserveStock('t-1', 'actor-1', {
        warehouseId: 'wh-1',
        variantId: 'var-1',
        quantity: 2,
        referenceType: 'order',
        referenceId: 'ord-1',
      });

      const req2 = service.reserveStock('t-1', 'actor-2', {
        warehouseId: 'wh-1',
        variantId: 'var-1',
        quantity: 2,
        referenceType: 'order',
        referenceId: 'ord-2',
      });

      const results = await Promise.allSettled([req1, req2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
    });
  });

  describe('releaseReservation', () => {
    it('restores available stock and decrements reserved', async () => {
      const mockTx = {
        select: vi.fn(),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'sb-1', onHand: 10, reserved: 5, available: 5 },
        ]),
      });

      const res = await service.releaseReservation('t-1', 'actor-1', {
        warehouseId: 'wh-1',
        variantId: 'var-1',
        quantity: 3,
        referenceType: 'order',
        referenceId: 'ord-100',
      });

      expect(res.reserved).toBe(2);
      expect(res.available).toBe(8);
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });

  describe('adjustStock (Negative Stock Prevention & Ledger Audit)', () => {
    it('blocks stock adjustment that would result in negative available stock due to existing reservations', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // onHand: 10, reserved: 7, available: 3
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'sb-1', onHand: 10, reserved: 7, available: 3 },
        ]),
      });

      // Trying to adjust onHand to 4 (which is less than reserved 7 -> available would be -3!)
      await expect(
        service.adjustStock('t-1', 'actor-1', {
          warehouseId: 'wh-1',
          variantId: 'var-1',
          countedQuantity: 4,
          reason: 'damaged',
          note: 'Water damage',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully processes valid stock adjustment, updating balances and writing ledger', async () => {
      const mockTx = {
        select: vi.fn(),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        }),
        insert: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // 1. Balance lookup: onHand: 10, reserved: 2, available: 8
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'sb-1', onHand: 10, reserved: 2, available: 8 },
        ]),
      });

      // 2. Variant lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { sku: 'SKU-1', purchaseCost: BigInt(5000) },
        ]),
      });

      // 3. Insert stock_adjustments returning
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'adj-1' }]),
        }),
      });

      // 4. Insert inventory_movements
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      // 5. Insert audit_logs
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      // Counting 15 units (+5 delta)
      const res = await service.adjustStock('t-1', 'actor-1', {
        warehouseId: 'wh-1',
        variantId: 'var-1',
        countedQuantity: 15,
        reason: 'stocktake',
        note: 'Found extra carton',
      });

      expect(res.newOnHand).toBe(15);
      expect(res.delta).toBe(5);
      expect(res.available).toBe(13); // 15 - 2 reserved = 13
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalledTimes(3); // adjustment, movement, audit
    });
  });

  describe('reconcileLedger (Acceptance Gate: Ledger sum = balance)', () => {
    it('confirms balanced status when sum of ledger matches cached onHand', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // 1. Balance query: onHand = 25
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ onHand: 25 }]),
      });

      // 2. Sum ledger movements query: total = 25
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 25 }]),
      });

      const res = await service.reconcileLedger('t-1', 'wh-1', 'var-1');
      expect(res.isBalanced).toBe(true);
      expect(res.drift).toBe(0);
      expect(res.onHand).toBe(25);
      expect(res.ledgerSum).toBe(25);
    });

    it('detects drift when sum of ledger deviates from cached balance', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ onHand: 30 }]),
      });

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 28 }]), // 2 units drift
      });

      const res = await service.reconcileLedger('t-1', 'wh-1', 'var-1');
      expect(res.isBalanced).toBe(false);
      expect(res.drift).toBe(2);
    });
  });
});
