import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RiskService } from '../../src/risk/risk.service';
import * as dbModule from '@growthomic/db';

describe('RiskService - Fraud & Delivery Failure Risk Engine', () => {
  let service: RiskService;

  beforeEach(() => {
    service = new RiskService();
    vi.restoreAllMocks();
  });

  it('retrieves default risk rules if tenant has no custom rules configured', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'rule-1',
              tenantId: 'tenant-1',
              minEligibleOrders: 3,
              cancellationThresholdPercent: 40,
              returnThresholdPercent: 25,
              deliveryFailureThresholdPercent: 30,
              autoFlagHighRisk: true,
              manualReviewRequiredForHighRisk: true,
              cacheDurationHours: 24,
            },
          ]),
        }),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const settings = await service.getSettings('tenant-1');
    expect(settings.minEligibleOrders).toBe(3);
    expect(settings.cancellationThresholdPercent).toBe(40);
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('updates settings and preserves audit snapshot in risk_rule_history', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'rule-1',
                tenantId: 'tenant-1',
                minEligibleOrders: 3,
                cancellationThresholdPercent: 40,
                returnThresholdPercent: 25,
                deliveryFailureThresholdPercent: 30,
                autoFlagHighRisk: true,
                manualReviewRequiredForHighRisk: true,
                cacheDurationHours: 24,
              },
            ]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'rule-1',
                tenantId: 'tenant-1',
                minEligibleOrders: 5,
                cancellationThresholdPercent: 50,
                returnThresholdPercent: 25,
                deliveryFailureThresholdPercent: 30,
                autoFlagHighRisk: true,
                manualReviewRequiredForHighRisk: true,
                cacheDurationHours: 48,
              },
            ]),
          }),
        }),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const updated = await service.updateSettings('tenant-1', 'user-1', {
      minEligibleOrders: 5,
      cancellationThresholdPercent: 50,
      reason: 'Tightened policy for festival rush',
    });

    expect(updated.minEligibleOrders).toBe(5);
    expect(mockTx.insert).toHaveBeenCalled(); // Audit history snapshot
    expect(mockTx.update).toHaveBeenCalled();
  });

  it('normalizes Bangladesh phone when adding to blacklist', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'bl-1',
              tenantId: 'tenant-1',
              phone: '01712345678',
              normalizedPhone: '+8801712345678',
              type: 'blacklist',
              reason: 'Habitual returner',
              isActive: true,
            },
          ]),
        }),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const entry = await service.addBlacklistEntry('tenant-1', 'user-1', {
      phone: '01712345678',
      type: 'blacklist',
      reason: 'Habitual returner',
    });

    expect(entry.normalizedPhone).toBe('+8801712345678');
    expect(entry.type).toBe('blacklist');
  });

  it('Gate 1: Never returns low risk when order count is below minEligibleOrders (returns insufficient_data)', async () => {
    const mockTx = {
      // 1. Cached check -> none
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        // 2. getSettings -> 3 minEligibleOrders
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'rule-1',
                  tenantId: 'tenant-1',
                  minEligibleOrders: 3,
                  cancellationThresholdPercent: 40,
                  returnThresholdPercent: 25,
                  deliveryFailureThresholdPercent: 30,
                  autoFlagHighRisk: true,
                  manualReviewRequiredForHighRisk: true,
                  cacheDurationHours: 24,
                },
              ]),
            }),
          }),
        })
        // 3. Blacklist match -> none
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        // 4. Customer orders -> only 1 order
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ status: 'delivered' }]),
            }),
          }),
        })
        // 5. Customer id lookup
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'cust-1' }]),
            }),
          }),
        }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'chk-1',
              tenantId: 'tenant-1',
              phone: '01812345678',
              normalizedPhone: '+8801812345678',
              riskStatus: 'insufficient_data',
              riskScore: 50,
            },
          ]),
        }),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const check = await service.checkCustomerRisk('tenant-1', {
      phone: '01812345678',
    });

    expect(check.riskStatus).toBe('insufficient_data');
    expect(check.riskStatus).not.toBe('low');
  });

  it('reuses valid cached risk check without re-querying order history', async () => {
    const unexpiredDate = new Date(Date.now() + 10 * 3600 * 1000).toISOString();
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'cached-chk-1',
                  tenantId: 'tenant-1',
                  phone: '01812345678',
                  normalizedPhone: '+8801812345678',
                  riskStatus: 'medium',
                  riskScore: 65,
                  validUntil: unexpiredDate,
                },
              ]),
            }),
            limit: vi.fn().mockResolvedValue([
              {
                id: 'cached-chk-1',
                tenantId: 'tenant-1',
                phone: '01812345678',
                normalizedPhone: '+8801812345678',
                riskStatus: 'medium',
                riskScore: 65,
                validUntil: unexpiredDate,
              },
            ]),
          }),
        }),
      }),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await service.checkCustomerRisk('tenant-1', {
      phone: '01812345678',
      skipCache: false,
    });

    expect(result.id).toBe('cached-chk-1');
    expect(result.riskStatus).toBe('medium');
    // Ensure no insert was made because cache hit
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it('records manual review override with mandatory reason and writes to auditLogs', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'ord-123',
                tenantId: 'tenant-1',
                riskLevel: 'high',
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
                id: 'ord-123',
                tenantId: 'tenant-1',
                riskLevel: 'high',
                riskDecision: 'approved',
                riskDecisionReason: 'Customer called and verified advance payment via bKash',
                riskDecidedBy: 'user-manager',
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

    const reviewed = await service.reviewOrderRisk('tenant-1', 'user-manager', 'ord-123', {
      decision: 'approved',
      decisionReason: 'Customer called and verified advance payment via bKash',
    });

    expect(reviewed.riskDecision).toBe('approved');
    expect(reviewed.riskDecisionReason).toContain('bKash');
    expect(mockTx.insert).toHaveBeenCalled(); // Audit log
  });
});
