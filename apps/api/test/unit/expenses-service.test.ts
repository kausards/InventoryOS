import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ExpensesService } from '../../src/expenses/expenses.service';
import * as dbModule from '@growthomic/db';

describe('ExpensesService (M9 Operating Expenses)', () => {
  let service: ExpensesService;
  let mockFinanceService: any;
  const mockTenantId = 'tenant-123';
  const mockActorId = 'user-456';
  const mockExpenseId = 'exp-789';

  beforeEach(() => {
    mockFinanceService = {
      createTransaction: vi.fn().mockResolvedValue({ id: 'txn-exp-1' }),
    };
    service = new ExpensesService(mockFinanceService);
    vi.restoreAllMocks();
  });

  it('creates an expense and automatically posts to finance ledger if paymentStatus is paid', async () => {
    const mockExpenseInput = {
      title: 'Warehouse Rent October',
      category: 'rent' as const,
      amountMinor: 2500000n, // ৳25,000.00
      currency: 'BDT',
      paymentStatus: 'paid' as const,
      paymentMethod: 'bank' as const,
    };

    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: mockExpenseId,
              tenantId: mockTenantId,
              expenseNumber: 'EXP-101',
              title: mockExpenseInput.title,
              category: mockExpenseInput.category,
              amountMinor: mockExpenseInput.amountMinor,
              paymentStatus: 'paid',
              paymentMethod: 'bank',
            },
          ]),
        }),
      }),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await service.createExpense(mockTenantId, mockActorId, mockExpenseInput);

    expect(result.id).toBe(mockExpenseId);
    expect(result.amountMinor).toBe(2500000);
    expect(mockFinanceService.createTransaction).toHaveBeenCalledTimes(1);
    expect(mockFinanceService.createTransaction).toHaveBeenCalledWith(
      mockTenantId,
      mockActorId,
      expect.objectContaining({
        type: 'expense',
        direction: 'out',
        category: 'operating_expense',
        amountMinor: mockExpenseInput.amountMinor,
        referenceType: 'expense',
        referenceId: mockExpenseId,
      })
    );
  });

  it('aggregates expenses by category with percentages in getCategorySummary', async () => {
    const mockCategoryRows = [
      { category: 'rent', totalMinor: 2000000, count: 1 }, // ৳20,000
      { category: 'marketing', totalMinor: 1000000, count: 2 }, // ৳10,000
      { category: 'utilities', totalMinor: 1000000, count: 1 }, // ৳10,000
    ];

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockCategoryRows),
      }),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const summary = await service.getCategorySummary(mockTenantId);

    // Grand total: 4,000,000 paisa (৳40,000)
    expect(summary.grandTotalMinor).toBe(4000000);
    expect(summary.categories).toHaveLength(3);

    const rent = summary.categories.find((c) => c.category === 'rent');
    expect(rent?.percentage).toBe(50); // 20k / 40k = 50%

    const mkt = summary.categories.find((c) => c.category === 'marketing');
    expect(mkt?.percentage).toBe(25); // 10k / 40k = 25%
  });
});
