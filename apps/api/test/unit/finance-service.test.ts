import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FinanceService } from '../../src/finance/finance.service';
import * as dbModule from '@growthomic/db';

describe('FinanceService & Ledger Acceptance Gates (M9)', () => {
  let service: FinanceService;
  const mockTenantId = 'tenant-123';
  const mockActorId = 'user-456';
  const mockOrderId = 'order-789';

  beforeEach(() => {
    service = new FinanceService();
    vi.restoreAllMocks();
  });

  // ==========================================
  // GATE 1: PRD R.3 WORKED EXAMPLE & DELIVERED SALES RECOGNITION
  // ==========================================
  describe('Gate 1: Revenue Recognition at Delivery & Minor Unit Formulas', () => {
    it('creates sale, cogs, courier, and packaging ledger entries on order delivery', async () => {
      const mockOrder = {
        id: mockOrderId,
        tenantId: mockTenantId,
        orderNumber: 'ORD-1001',
        subtotalMinor: 100000n, // ৳1,000.00
        discountMinor: 5000n, // ৳50.00
        deliveryChargeMinor: 8000n, // ৳80.00 courier
        paymentMethod: 'cash',
      };

      const mockItems = [
        {
          id: 'item-1',
          orderId: mockOrderId,
          quantity: 2,
          unitPriceMinor: 50000n,
          unitCostMinor: 25000n, // ৳250.00 x 2 = ৳500.00 total COGS (50,000 paisa)
        },
      ];

      const insertedEntries: any[] = [];
      const mockTx = {
        select: vi.fn()
          // 1. Idempotency check: returns empty
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          })
          // 2. Fetch order
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([mockOrder]),
          })
          // 3. Fetch items
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(mockItems),
          }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((val) => {
            insertedEntries.push(val);
            return {
              returning: vi.fn().mockResolvedValue([{ ...val, id: `txn-${insertedEntries.length}` }]),
            };
          }),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.recordOrderDeliveredRevenue(mockTenantId, mockOrderId, mockActorId);

      expect(result.recorded).toBe(true);
      expect(result.entriesCount).toBe(4);

      // Verify Sale entry: Net product sales = ৳1,000 - ৳50 = ৳950 (95,000 paisa)
      const saleEntry = insertedEntries.find((e) => e.type === 'sale');
      expect(saleEntry).toBeDefined();
      expect(saleEntry.direction).toBe('in');
      expect(saleEntry.category).toBe('revenue');
      expect(saleEntry.amountMinor).toBe(95000n);

      // Verify COGS entry: ৳500 (50,000 paisa)
      const cogsEntry = insertedEntries.find((e) => e.type === 'cogs');
      expect(cogsEntry).toBeDefined();
      expect(cogsEntry.direction).toBe('out');
      expect(cogsEntry.category).toBe('cogs');
      expect(cogsEntry.amountMinor).toBe(50000n);

      // Verify Courier entry: ৳80 (8,000 paisa)
      const courierEntry = insertedEntries.find((e) => e.type === 'courier_fee');
      expect(courierEntry).toBeDefined();
      expect(courierEntry.direction).toBe('out');
      expect(courierEntry.category).toBe('order_cost');
      expect(courierEntry.amountMinor).toBe(8000n);

      // Verify Packaging entry: default ৳20 (2,000 paisa)
      const packagingEntry = insertedEntries.find((e) => e.type === 'packaging_cost');
      expect(packagingEntry).toBeDefined();
      expect(packagingEntry.direction).toBe('out');
      expect(packagingEntry.category).toBe('order_cost');
      expect(packagingEntry.amountMinor).toBe(2000n);
    });

    it('skips duplicate revenue recognition if order sale already posted (idempotency)', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: 'existing-txn-1' }]),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.recordOrderDeliveredRevenue(mockTenantId, mockOrderId, mockActorId);
      expect(result.recorded).toBe(false);
      expect(result.message).toContain('Revenue already recognized');
    });
  });

  // ==========================================
  // GATE 2: LEDGER IMMUTABILITY & REVERSAL TRANSACTIONS
  // ==========================================
  describe('Gate 2: Ledger Immutability & Reversal Workflow', () => {
    it('creates offsetting reversal entry with inverted direction and marks original reversed', async () => {
      const originalTx = {
        id: 'txn-sale-original',
        tenantId: mockTenantId,
        transactionNumber: 'TXN-SALE-ORD-1001',
        type: 'sale',
        direction: 'in',
        category: 'revenue',
        amountMinor: 95000n,
        currency: 'BDT',
        referenceType: 'order',
        referenceId: mockOrderId,
        paymentMethod: 'cash',
        status: 'posted',
      };

      let insertedReversal: any = null;
      let updatedStatus: any = null;

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([originalTx]),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((val) => {
            insertedReversal = val;
            return {
              returning: vi.fn().mockResolvedValue([{ ...val, id: 'rev-txn-1' }]),
            };
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((val) => {
            updatedStatus = val;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...originalTx, ...val }]),
              }),
            };
          }),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.reverseTransaction(
        mockTenantId,
        mockActorId,
        originalTx.id,
        { reason: 'Customer disputed charge' }
      );

      // Verify original updated status
      expect(updatedStatus.status).toBe('reversed');
      expect(result.original.status).toBe('reversed');

      // Verify reversing entry
      expect(insertedReversal).toBeDefined();
      expect(insertedReversal.direction).toBe('out'); // Flipped from 'in' to 'out'
      expect(insertedReversal.amountMinor).toBe(95000n);
      expect(insertedReversal.reversalOf).toBe(originalTx.id);
      expect(insertedReversal.notes).toContain('Customer disputed charge');
      expect(result.reversal.amountMinor).toBe(95000);
    });

    it('rejects reversal if transaction is already reversed', async () => {
      const alreadyReversedTx = {
        id: 'txn-already-reversed',
        tenantId: mockTenantId,
        transactionNumber: 'TXN-001',
        status: 'reversed',
      };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([alreadyReversedTx]),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        service.reverseTransaction(mockTenantId, mockActorId, alreadyReversedTx.id, {
          reason: 'Double reversal attempt',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // GATE 3: P&L REPORT DETERMINISTIC RECONCILIATION
  // ==========================================
  describe('Gate 3: P&L Statement Reconciliation', () => {
    it('produces exact Gross Profit, Contribution, Operating Profit, and Margins matching PRD R.3', async () => {
      // Mock transactions representing PRD R.3 worked example + operating expenses
      const mockRows = [
        // Sale: ৳1,000 (100,000 paisa)
        {
          id: '1',
          type: 'sale',
          direction: 'in',
          category: 'revenue',
          amountMinor: 100000n,
          reversalOf: null,
          transactionNumber: 'TXN-1',
        },
        // Reversal/Discount: ৳50 (5,000 paisa)
        {
          id: '2',
          type: 'sale',
          direction: 'out',
          category: 'revenue',
          amountMinor: 5000n,
          reversalOf: '1',
          transactionNumber: 'REV-TXN-1',
        },
        // COGS: ৳500 (50,000 paisa)
        {
          id: '3',
          type: 'cogs',
          direction: 'out',
          category: 'cogs',
          amountMinor: 50000n,
          reversalOf: null,
          transactionNumber: 'TXN-2',
        },
        // Courier: ৳80 (8,000 paisa)
        {
          id: '4',
          type: 'courier_fee',
          direction: 'out',
          category: 'order_cost',
          amountMinor: 8000n,
          reversalOf: null,
          transactionNumber: 'TXN-3',
        },
        // Packaging: ৳20 (2,000 paisa)
        {
          id: '5',
          type: 'packaging_cost',
          direction: 'out',
          category: 'order_cost',
          amountMinor: 2000n,
          reversalOf: null,
          transactionNumber: 'TXN-4',
        },
        // Operating Expense: ৳100 (10,000 paisa)
        {
          id: '6',
          type: 'expense',
          direction: 'out',
          category: 'operating_expense',
          amountMinor: 10000n,
          reversalOf: null,
          transactionNumber: 'TXN-5',
        },
      ];

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(mockRows),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const pnl = await service.getPnLReport(mockTenantId);

      // Net sales = 100,000 - 5,000 = 95,000 paisa (৳950)
      expect(pnl.revenue.netProductSalesMinor).toBe(95000);

      // Gross profit = 95,000 - 50,000 = 45,000 paisa (৳450)
      expect(pnl.profit.grossProfitMinor).toBe(45000);

      // Direct order costs = 8,000 + 2,000 = 10,000 paisa (৳100)
      expect(pnl.directOrderCosts.totalDirectOrderCostsMinor).toBe(10000);

      // Contribution margin = 45,000 - 10,000 = 35,000 paisa (৳350)
      expect(pnl.directOrderCosts.contributionMarginMinor).toBe(35000);

      // Operating expenses = 10,000 paisa (৳100)
      expect(pnl.operatingExpenses.totalOperatingExpensesMinor).toBe(10000);

      // Operating profit = 45,000 - 10,000 = 35,000 paisa (৳350)
      expect(pnl.bottomLine.operatingProfitMinor).toBe(35000);

      // Gross margin % = (45,000 / 95,000) * 100 = 47.36%
      expect(pnl.profit.grossMarginPercent).toBe(47.36);

      // Net cash movement = 100,000 - (5,000 + 50,000 + 8,000 + 2,000 + 10,000) = 25,000 paisa (৳250)
      expect(pnl.bottomLine.netCashMovementMinor).toBe(25000);
    });
  });
});
