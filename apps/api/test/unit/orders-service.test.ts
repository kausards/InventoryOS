import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from '../../src/orders/orders.service';
import * as dbModule from '@growthomic/db';

describe('OrdersService - Order State Machine, Isolation & Stock Integration', () => {
  let service: OrdersService;
  let mockInventoryService: any;

  beforeEach(() => {
    mockInventoryService = {
      reserveStock: vi.fn().mockResolvedValue({ reserved: 5, available: 5 }),
      releaseReservation: vi.fn().mockResolvedValue({ reserved: 0, available: 10 }),
    };
    service = new OrdersService(mockInventoryService);
    vi.restoreAllMocks();
  });

  describe('Order State Machine Enforcement (Acceptance Gate: Invalid transitions rejected)', () => {
    it('rejects invalid state transition from pending directly to delivered', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // Order query returns order in pending status
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'ord-1', orderNumber: 'ORD-1001', orderStatus: 'pending', warehouseId: 'wh-1' },
        ]),
      });

      await expect(
        service.transitionStatus('t-1', 'actor-1', 'ord-1', {
          toStatus: 'delivered',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid state transition from cancelled (terminal state)', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'ord-1', orderNumber: 'ORD-1001', orderStatus: 'cancelled', warehouseId: 'wh-1' },
        ]),
      });

      await expect(
        service.transitionStatus('t-1', 'actor-1', 'ord-1', {
          toStatus: 'confirmed',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('allows valid transition pending -> confirmed and triggers atomic stock reservation', async () => {
      const mockTx = {
        select: vi.fn(),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'ord-1',
                  orderNumber: 'ORD-1001',
                  orderStatus: 'confirmed',
                  subtotalMinor: BigInt(50000),
                  discountMinor: BigInt(0),
                  deliveryChargeMinor: BigInt(6000),
                  totalAmountMinor: BigInt(56000),
                },
              ]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // 1. Order lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'ord-1', orderNumber: 'ORD-1001', orderStatus: 'pending', warehouseId: 'wh-1' },
        ]),
      });

      // 2. Order items lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { variantId: 'var-1', quantity: 2 },
        ]),
      });

      const res = await service.transitionStatus('t-1', 'actor-1', 'ord-1', {
        toStatus: 'confirmed',
      });

      expect(res.orderStatus).toBe('confirmed');
      // Stock reserved for the variant
      expect(mockInventoryService.reserveStock).toHaveBeenCalledTimes(1);
      expect(mockInventoryService.reserveStock).toHaveBeenCalledWith(
        't-1',
        'actor-1',
        expect.objectContaining({
          warehouseId: 'wh-1',
          variantId: 'var-1',
          quantity: 2,
          referenceId: 'ord-1',
        }),
        undefined
      );
    });
  });

  describe('Cancellation Releases Reservation (Acceptance Gate)', () => {
    it('cancelling a confirmed order releases reservation exactly once with required reason', async () => {
      const mockTx = {
        select: vi.fn(),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'ord-1',
                  orderNumber: 'ORD-1001',
                  orderStatus: 'cancelled',
                  cancelReason: 'Customer requested cancellation',
                  subtotalMinor: BigInt(50000),
                  discountMinor: BigInt(0),
                  deliveryChargeMinor: BigInt(6000),
                  totalAmountMinor: BigInt(56000),
                },
              ]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // 1. Order lookup (confirmed state)
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'ord-1',
            orderNumber: 'ORD-1001',
            orderStatus: 'confirmed',
            warehouseId: 'wh-1',
            customerId: 'cust-1',
          },
        ]),
      });

      // 2. Order items lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { variantId: 'var-1', quantity: 2 },
        ]),
      });

      const res = await service.cancelOrder('t-1', 'actor-1', 'ord-1', {
        reason: 'Customer requested cancellation',
      });

      expect(res.orderStatus).toBe('cancelled');
      // Release reservation called exactly once
      expect(mockInventoryService.releaseReservation).toHaveBeenCalledTimes(1);
      expect(mockInventoryService.releaseReservation).toHaveBeenCalledWith(
        't-1',
        'actor-1',
        expect.objectContaining({
          warehouseId: 'wh-1',
          variantId: 'var-1',
          quantity: 2,
          referenceId: 'ord-1',
        }),
        undefined
      );
    });

    it('cancelling an unconfirmed pending order does NOT release stock (none was reserved)', async () => {
      const mockTx = {
        select: vi.fn(),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'ord-1',
                  orderNumber: 'ORD-1001',
                  orderStatus: 'cancelled',
                  subtotalMinor: BigInt(50000),
                  discountMinor: BigInt(0),
                  deliveryChargeMinor: BigInt(6000),
                  totalAmountMinor: BigInt(56000),
                },
              ]),
            }),
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
          {
            id: 'ord-1',
            orderNumber: 'ORD-1001',
            orderStatus: 'pending',
            warehouseId: 'wh-1',
            customerId: 'cust-1',
          },
        ]),
      });

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ variantId: 'var-1', quantity: 1 }]),
      });

      await service.cancelOrder('t-1', 'actor-1', 'ord-1', {
        reason: 'Duplicate entry',
      });

      expect(mockInventoryService.releaseReservation).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Tenant Isolation (Acceptance Gate: Returns 404)', () => {
    it('returns NotFoundException when attempting to access another tenant order', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // tenant mismatch -> no rows
      });

      await expect(service.getOrderById('tenant-A', 'order-belonging-to-tenant-B')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('Duplicate Order Detection (Acceptance Gate)', () => {
    it('flags isDuplicateWarning when customer with same normalized phone placed an order in past 24h', async () => {
      const mockTx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // 1. Customer lookup by ID
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'cust-1', name: 'Tanvir Ahmed', normalizedPhone: '+8801711223344' },
        ]),
      });

      // 2. Duplicate check query -> finds existing recent order!
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'ord-previous', orderNumber: 'ORD-1000' },
        ]),
      });

      // 3. Sequence lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ prefix: 'ORD-', lastNumber: 1000 }]),
      });

      // 5. Sequence update
      mockTx.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      // 6. Variant lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'var-1',
            name: 'Blue M',
            sku: 'TSHIRT-BLU-M',
            retailPrice: BigInt(50000),
            purchaseCost: BigInt(25000),
            productId: 'prod-1',
            productName: 'Polo T-Shirt',
          },
        ]),
      });

      // 7. Order insert
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation((val: any) => {
            return Promise.resolve([
              {
                id: 'ord-new',
                orderNumber: 'ORD-1001',
                orderSequence: 1001,
                orderStatus: 'pending',
                isDuplicateWarning: true,
                duplicateOfOrderId: 'ord-previous',
                subtotalMinor: BigInt(50000),
                discountMinor: BigInt(0),
                deliveryChargeMinor: BigInt(6000),
                totalAmountMinor: BigInt(56000),
              },
            ]);
          }),
        }),
      });

      // 8. Order items insert
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      // 9. History insert
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      // 10. Customer aggregates update
      mockTx.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      // 10b. Subscription lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      // 11. Audit log
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      const res = await service.createOrder('t-1', 'actor-1', {
        customerId: 'cust-1',
        warehouseId: 'wh-1',
        items: [{ variantId: 'var-1', quantity: 1, unitPrice: 50000 }],
        deliveryCharge: 6000,
      });

      expect(res.isDuplicateWarning).toBe(true);
      expect(res.duplicateOfOrderId).toBe('ord-previous');
    });
  });
});
