import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import * as dbModule from '@growthomic/db';

describe('SubscriptionsService (M10 Subscriptions & Entitlements)', () => {
  let service: SubscriptionsService;
  const mockTenantId = 'tenant-sub-123';
  const mockUserId = 'user-sub-456';
  const mockPlanId = 'plan-growth-001';

  beforeEach(() => {
    service = new SubscriptionsService();
    vi.restoreAllMocks();
  });

  it('lists active subscription plans with serialized prices in minor units', async () => {
    const mockPlanRows = [
      {
        id: 'plan-starter-1',
        name: 'Starter',
        slug: 'starter',
        monthlyPriceMinor: 99900n,
        annualPriceMinor: 999000n,
        isActive: true,
        entitlements: { maxMonthlyOrders: 500 },
      },
      {
        id: 'plan-growth-1',
        name: 'Growth',
        slug: 'growth',
        monthlyPriceMinor: 249900n,
        annualPriceMinor: 2499000n,
        isActive: true,
        entitlements: { maxMonthlyOrders: 2500 },
      },
    ];

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockPlanRows),
          }),
        }),
      }),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const plans = await service.getPlans();
    expect(plans).toHaveLength(2);
    expect(plans[0].monthlyPriceMinor).toBe(99900);
    expect(typeof plans[0].monthlyPriceMinor).toBe('number');
    expect(plans[1].monthlyPriceMinor).toBe(249900);
  });

  it('submits manual payment and prevents duplicate pending transaction IDs', async () => {
    const mockInput = {
      planId: mockPlanId,
      billingCycle: 'monthly' as const,
      paymentMethod: 'bkash' as const,
      amountMinor: 249900n,
      transactionId: 'TRX-BKASH-9988',
      senderNumber: '01711223344',
      receiptUrl: 'https://example.com/receipt.jpg',
      notes: 'Paid via bKash personal',
    };

    // 1. Duplicate check mock: returns existing record
    const mockTxDuplicate = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValueOnce([
              { id: mockPlanId, isActive: true }, // plan exists
            ]).mockResolvedValueOnce([
              { id: 'sub-tx-existing', transactionId: 'TRX-BKASH-9988' }, // duplicate found
            ]),
          }),
        }),
      }),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTxDuplicate));

    await expect(
      service.submitManualPayment(mockTenantId, mockUserId, mockInput)
    ).rejects.toThrow(BadRequestException);
  });

  it('successfully submits manual payment and sets subscription status to payment_pending if not active', async () => {
    const mockInput = {
      planId: mockPlanId,
      billingCycle: 'monthly' as const,
      paymentMethod: 'bkash' as const,
      amountMinor: 249900n,
      transactionId: 'TRX-BKASH-NEW123',
      senderNumber: '01711223344',
      receiptUrl: 'https://example.com/receipt.jpg',
      notes: 'Payment done',
    };

    const mockTxSuccess = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn()
              .mockResolvedValueOnce([{ id: mockPlanId, isActive: true }]) // plan exists
              .mockResolvedValueOnce([]) // no duplicate
              .mockResolvedValueOnce([{ id: 'sub-trial', status: 'trial' }]), // current sub is trial
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'mp-new-1',
              tenantId: mockTenantId,
              planId: mockPlanId,
              transactionId: mockInput.transactionId,
              amountMinor: mockInput.amountMinor,
              status: 'pending',
            },
          ]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTxSuccess));

    const result = await service.submitManualPayment(mockTenantId, mockUserId, mockInput);
    expect(result.id).toBe('mp-new-1');
    expect(result.status).toBe('pending');
    expect(result.amountMinor).toBe(249900);
  });
});
