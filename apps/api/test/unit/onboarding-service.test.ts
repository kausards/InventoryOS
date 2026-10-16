import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { OnboardingService } from '../../src/onboarding/onboarding.service';
import * as dbModule from '@growthomic/db';

describe('OnboardingService - Setup Wizard & Store Initialization', () => {
  let service: OnboardingService;

  beforeEach(() => {
    service = new OnboardingService();
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('returns onboarding status, current step, and stats', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // 1. Tenant lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 't-1',
            name: 'Artisan BD',
            onboardingCompleted: false,
            metadata: { onboardingStep: 2 },
          },
        ]),
      });

      // 2. Warehouses count
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      });

      // 3. Courier accounts count
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });

      // 4. Products count
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });

      const res = await service.getStatus('t-1');

      expect(res.completed).toBe(false);
      expect(res.currentStep).toBe(2);
      expect(res.storeName).toBe('Artisan BD');
      expect(res.stats.warehousesCount).toBe(1);
      expect(res.stats.couriersCount).toBe(0);
    });

    it('throws NotFoundException if tenant not found', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      await expect(service.getStatus('invalid-tenant')).rejects.toThrow(NotFoundException);
    });
  });

  describe('saveStoreProfile', () => {
    it('updates store name and advances step to 2', async () => {
      const mockTx = {
        select: vi.fn(),
        update: vi.fn(),
        insert: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 't-1', name: 'Old Name', metadata: {} }]),
      });

      mockTx.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 't-1', name: 'Shopeers Fashion BD' }]),
          }),
        }),
      });

      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      const res = await service.saveStoreProfile('t-1', 'user-1', {
        organizationName: 'Shopeers Fashion BD',
        phone: '01811223344',
      });

      expect(res.success).toBe(true);
      expect(res.step).toBe(2);
      expect(res.tenant.name).toBe('Shopeers Fashion BD');
    });
  });

  describe('saveWarehouse', () => {
    it('creates initial warehouse and advances onboarding step', async () => {
      const mockTx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // Tenant lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 't-1', metadata: { onboardingStep: 2 } }]),
      });

      // Existing warehouse lookup -> none
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      // Insert warehouse
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: 'wh-1', name: 'Dhaka Central Hub', code: 'WH-01' },
          ]),
        }),
      });

      // Update tenant metadata
      mockTx.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      // Insert audit log
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      const res = await service.saveWarehouse('t-1', 'user-1', {
        name: 'Dhaka Central Hub',
        streetAddress: 'Mirpur 10',
        division: 'Dhaka',
        district: 'Dhaka',
      });

      expect(res.success).toBe(true);
      expect(res.step).toBe(3);
      expect(res.warehouse?.name).toBe('Dhaka Central Hub');
    });
  });

  describe('saveCourier', () => {
    it('encrypts credentials and saves courier account', async () => {
      const mockTx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // Tenant lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 't-1', metadata: { onboardingStep: 3 } }]),
      });

      // Existing courier lookup -> none
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      // Insert courier account
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: 'cour-1', courierCode: 'steadfast', isDefault: true },
          ]),
        }),
      });

      // Update tenant metadata
      mockTx.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      // Insert audit log
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      const res = await service.saveCourier('t-1', 'user-1', {
        courierName: 'steadfast',
        apiKey: 'st-key-1234',
        secretKey: 'st-secret-5678',
      });

      expect(res.success).toBe(true);
      expect(res.step).toBe(4);
      expect(res.courierCode).toBe('steadfast');
    });
  });

  describe('completeOnboarding', () => {
    it('sets onboardingCompleted: true and returns success message', async () => {
      const mockTx = {
        select: vi.fn(),
        update: vi.fn(),
        insert: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 't-1', metadata: {} }]),
      });

      mockTx.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { id: 't-1', onboardingCompleted: true },
            ]),
          }),
        }),
      });

      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      const res = await service.completeOnboarding('t-1', 'user-1');

      expect(res.success).toBe(true);
      expect(res.tenant.onboardingCompleted).toBe(true);
    });
  });
});
