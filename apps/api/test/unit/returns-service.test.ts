import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReturnsService } from '../../src/returns/returns.service';
import * as dbModule from '@growthomic/db';

describe('ReturnsService & Acceptance Gates (M7)', () => {
  let service: ReturnsService;
  const mockTenantId = 'tenant-123';
  const mockActorId = 'user-456';
  const mockOrderId = 'order-789';
  const mockWarehouseId = 'wh-001';
  const mockReturnId = 'ret-101';
  const mockItemId = 'item-202';
  const mockVariantId = 'var-303';
  const mockExchangeVariantId = 'var-404';

  beforeEach(() => {
    service = new ReturnsService();
    vi.restoreAllMocks();
  });

  // ==========================================
  // GATE 1: DAMAGED RETURN SAFEGUARD
  // ==========================================
  describe('Gate 1: Damaged return creates NO restock movement into sellable inventory', () => {
    it('throws BadRequestException if attempting to restock a damaged item', async () => {
      const mockReturn = {
        id: mockReturnId,
        tenantId: mockTenantId,
        warehouseId: mockWarehouseId,
        status: 'received',
      };

      const mockReturnItem = {
        id: mockItemId,
        tenantId: mockTenantId,
        productVariantId: mockVariantId,
        quantity: 2,
        exchangeQuantity: 0,
      };

      const mockTx = {
        select: vi.fn()
          // First select: return record
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockReturn]),
          })
          // Second select: return item
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockReturnItem]),
          }),
        insert: vi.fn(),
        update: vi.fn(),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        service.inspectReturn(mockTenantId, mockActorId, mockReturnId, {
          items: [
            {
              itemId: mockItemId,
              condition: 'damaged',
              disposition: 'restock', // Illegal for damaged item!
            },
          ],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('marks damaged item as damage_writeoff with 0 quantity movement to sellable stock', async () => {
      const mockReturn = {
        id: mockReturnId,
        tenantId: mockTenantId,
        warehouseId: mockWarehouseId,
        status: 'received',
      };

      const mockReturnItem = {
        id: mockItemId,
        tenantId: mockTenantId,
        productVariantId: mockVariantId,
        quantity: 1,
        exchangeQuantity: 0,
      };

      const insertedMovements: any[] = [];
      const mockTx = {
        select: vi.fn()
          // Return record
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockReturn]),
          })
          // Return item
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockReturnItem]),
          }),
        insert: vi.fn().mockImplementation((table: any) => ({
          values: vi.fn().mockImplementation((val: any) => {
            if (table === dbModule.inventoryMovements) {
              insertedMovements.push(val);
            }
            return Promise.resolve();
          }),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: mockReturnId, status: 'inspecting' }]),
            }),
          }),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      await service.inspectReturn(mockTenantId, mockActorId, mockReturnId, {
        items: [
          {
            itemId: mockItemId,
            condition: 'damaged',
            disposition: 'damage_writeoff',
          },
        ],
      });

      // Verify that no movement with quantity > 0 was created for sellable stock
      const sellableRestock = insertedMovements.find(
        (m) => m.type === 'customer_return_receipt' || m.quantity > 0
      );
      expect(sellableRestock).toBeUndefined();

      // Damaged write-off ledger entry has quantity: 0 (no addition to available stock)
      const damagedEntry = insertedMovements.find((m) => m.type === 'damaged');
      expect(damagedEntry).toBeDefined();
      expect(damagedEntry.quantity).toBe(0);
    });
  });

  // ==========================================
  // GATE 2: BALANCED EXCHANGE INVENTORY MOVEMENTS
  // ==========================================
  describe('Gate 2: Exchange creates balanced inventory movements', () => {
    it('decrements new replacement variant and increments returned variant if restocked', async () => {
      const mockReturn = {
        id: mockReturnId,
        tenantId: mockTenantId,
        warehouseId: mockWarehouseId,
        returnType: 'exchange',
        status: 'received',
      };

      const mockReturnItem = {
        id: mockItemId,
        tenantId: mockTenantId,
        productVariantId: mockVariantId,
        quantity: 1,
        exchangeVariantId: mockExchangeVariantId,
        exchangeQuantity: 1,
      };

      const mockStockBalances: Record<string, any> = {
        [mockVariantId]: { id: 'bal-1', onHand: 10, available: 10 },
        [mockExchangeVariantId]: { id: 'bal-2', onHand: 5, available: 5 },
      };

      const insertedMovements: any[] = [];
      const updatedBalances: any[] = [];

      const mockTx = {
        select: vi.fn()
          // 1. Return record
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockReturn]),
          })
          // 2. Return item
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockReturnItem]),
          })
          // 3. Stock balance for returned variant (mockVariantId)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockStockBalances[mockVariantId]]),
          })
          // 4. Stock balance for exchange variant (mockExchangeVariantId)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockStockBalances[mockExchangeVariantId]]),
          }),
        insert: vi.fn().mockImplementation((table: any) => ({
          values: vi.fn().mockImplementation((val: any) => {
            if (table === dbModule.inventoryMovements) {
              insertedMovements.push(val);
            }
            return Promise.resolve();
          }),
        })),
        update: vi.fn().mockImplementation((table: any) => ({
          set: vi.fn().mockImplementation((setVals: any) => {
            if (table === dbModule.warehouseStockBalances) {
              updatedBalances.push(setVals);
            }
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  table === dbModule.returns
                    ? { id: mockReturnId, status: 'inspecting' }
                    : { id: mockItemId, ...setVals },
                ]),
              }),
            };
          }),
        })),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      await service.inspectReturn(mockTenantId, mockActorId, mockReturnId, {
        items: [
          {
            itemId: mockItemId,
            condition: 'intact',
            disposition: 'restock',
            exchangeVariantId: mockExchangeVariantId,
            exchangeQuantity: 1,
          },
        ],
      });

      // 1. Verify returned variant incremented in ledger
      const restockMovement = insertedMovements.find(
        (m) => m.variantId === mockVariantId && m.type === 'customer_return_receipt'
      );
      expect(restockMovement).toBeDefined();
      expect(restockMovement.quantity).toBe(1);

      // 2. Verify replacement variant decremented in ledger
      const exchangeMovement = insertedMovements.find(
        (m) => m.variantId === mockExchangeVariantId && m.type === 'fulfillment_deduction'
      );
      expect(exchangeMovement).toBeDefined();
      expect(exchangeMovement.quantity).toBe(-1);

      // 3. Verify warehouse stock updates
      // Returned variant incremented: 10 + 1 = 11
      expect(updatedBalances).toContainEqual(
        expect.objectContaining({ onHand: 11, available: 11 })
      );
      // Replacement variant decremented: 5 - 1 = 4
      expect(updatedBalances).toContainEqual(
        expect.objectContaining({ onHand: 4, available: 4 })
      );
    });
  });

  // ==========================================
  // COMPLETE RETURN & REFUND
  // ==========================================
  describe('completeReturn', () => {
    it('completes return and updates refund amounts and status', async () => {
      const mockReturn = {
        id: mockReturnId,
        tenantId: mockTenantId,
        status: 'inspecting',
        customerDeliveryChargeRefunded: false,
        notes: 'Initial return',
      };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockReturn]),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: mockReturnId,
                  status: 'completed',
                  refundAmountMinor: 120000n,
                  refundStatus: 'refunded',
                  customerDeliveryChargeRefunded: true,
                },
              ]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(true),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const res = await service.completeReturn(mockTenantId, mockActorId, mockReturnId, {
        refundAmountMinor: 120000,
        refundStatus: 'refunded',
        customerDeliveryChargeRefunded: true,
        notes: 'Refund sent via bKash',
      });

      expect(res.status).toBe('completed');
      expect(res.refundAmountMinor).toBe(120000);
      expect(res.refundStatus).toBe('refunded');
      expect(res.customerDeliveryChargeRefunded).toBe(true);
    });
  });
});
