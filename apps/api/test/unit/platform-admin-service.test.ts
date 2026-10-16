import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformAdminService } from '../../src/platform-admin/platform-admin.service';
import * as dbModule from '@growthomic/db';

describe('PlatformAdminService (M10 Super-Admin Operations)', () => {
  let service: PlatformAdminService;
  const mockAdminId = 'admin-user-001';
  const mockSubmissionId = 'sub-pay-123';
  const mockTenantId = 'tenant-456';
  const mockPlanId = 'plan-growth-789';

  beforeEach(() => {
    service = new PlatformAdminService();
    vi.restoreAllMocks();
  });

  it('rejects a payment submission and records rejection reason', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: mockSubmissionId,
                tenantId: mockTenantId,
                status: 'pending',
                transactionId: 'TRX-INVALID-001',
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: mockSubmissionId,
                status: 'rejected',
                verifiedBy: mockAdminId,
                rejectionReason: 'Invalid TrxID on bKash statement',
                amountMinor: 249900n,
              },
            ]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await service.verifyPayment(mockSubmissionId, mockAdminId, {
      decision: 'rejected',
      rejectionReason: 'Invalid TrxID on bKash statement',
    });

    expect(result.status).toBe('rejected');
    expect(result.rejectionReason).toBe('Invalid TrxID on bKash statement');
    expect(mockTx.insert).toHaveBeenCalledTimes(1); // audit log
  });

  it('verifies payment, activates subscription, creates invoice, and resets period usage', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn()
              .mockResolvedValueOnce([
                {
                  id: mockSubmissionId,
                  tenantId: mockTenantId,
                  planId: mockPlanId,
                  billingCycle: 'monthly',
                  paymentMethod: 'bkash',
                  amountMinor: 249900n,
                  transactionId: 'TRX-BKASH-VALID-1',
                  status: 'pending',
                },
              ]) // submission found
              .mockResolvedValueOnce([
                {
                  id: mockPlanId,
                  name: 'Growth',
                },
              ]) // plan found
              .mockResolvedValueOnce([
                {
                  id: 'sub-existing-1',
                  tenantId: mockTenantId,
                },
              ]), // existing subscription
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: mockSubmissionId,
                status: 'verified',
                verifiedBy: mockAdminId,
                amountMinor: 249900n,
              },
            ]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'inv-new-1',
              invoiceNumber: 'INV-SUB-20261016-1234',
              amountMinor: 249900n,
              planName: 'Growth',
              paymentStatus: 'paid',
            },
          ]),
        }),
      }),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await service.verifyPayment(mockSubmissionId, mockAdminId, {
      decision: 'verified',
    });

    expect(result.subscriptionStatus).toBe('active');
    expect(result.payment.status).toBe('verified');
    expect(result.invoice.amountMinor).toBe(249900);
    expect(result.invoice.paymentStatus).toBe('paid');
  });

  it('throws BadRequestException if payment submission is not pending', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: mockSubmissionId,
                status: 'verified', // already verified
              },
            ]),
          }),
        }),
      }),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      service.verifyPayment(mockSubmissionId, mockAdminId, { decision: 'verified' })
    ).rejects.toThrow(BadRequestException);
  });
});
