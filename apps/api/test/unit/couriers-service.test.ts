import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouriersService } from '../../src/couriers/couriers.service';
import { RiskService } from '../../src/risk/risk.service';
import * as dbModule from '@growthomic/db';
import { encryptCourierCredentials } from '@growthomic/shared';

describe('CouriersService & Acceptance Gates (M5)', () => {
  let service: CouriersService;
  const mockTenantId = 'tenant-123';
  const mockActorId = 'user-456';
  const mockOrderId = 'order-789';
  const mockAccountId = 'acc-111';

  beforeEach(() => {
    service = new CouriersService();
    vi.restoreAllMocks();
  });

  const sampleEncryptedCredentials = encryptCourierCredentials(
    JSON.stringify({
      apiKey: 'test-api-key-12345',
      secretKey: 'test-secret-key-67890',
    })
  );

  const sampleAccount = {
    id: mockAccountId,
    tenantId: mockTenantId,
    courierCode: 'steadfast',
    accountName: 'Main Steadfast',
    encryptedCredentials: sampleEncryptedCredentials,
    senderName: 'Growthomic Store',
    senderPhone: '01711111111',
    senderAddress: 'Dhaka, Bangladesh',
    isActive: true,
    isDefault: true,
    testMode: false,
    lastConnectionTestAt: null,
    lastConnectionStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // ==========================================
  // GATE 4: CREDENTIAL CONFIDENTIALITY
  // ==========================================
  describe('Gate 4: Credential Confidentiality & Masking', () => {
    it('masks credentials as ****** and never reveals raw API keys or secrets in getAccounts', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([sampleAccount]),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const accounts = await service.getAccounts(mockTenantId);

      expect(accounts).toHaveLength(1);
      const acc = accounts[0];
      expect(acc).toBeDefined();
      expect(acc.maskedCredentials.apiKey).toBe('******');
      expect(acc.maskedCredentials.secretKey).toBe('******');

      const stringified = JSON.stringify(accounts);
      expect(stringified).not.toContain('test-api-key-12345');
      expect(stringified).not.toContain('test-secret-key-67890');
      expect(stringified).not.toContain('encryptedCredentials');
    });

    it('masks credentials as ****** upon account creation', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({}),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([sampleAccount]),
          }),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const created = await service.createAccount(mockTenantId, {
        courierCode: 'steadfast',
        accountName: 'New Steadfast',
        apiKey: 'fresh-key-abc',
        secretKey: 'fresh-secret-xyz',
        isDefault: true,
      });

      expect(created.maskedCredentials.apiKey).toBe('******');
      expect(created.maskedCredentials.secretKey).toBe('******');
      expect(JSON.stringify(created)).not.toContain('fresh-key-abc');
      expect(JSON.stringify(created)).not.toContain('fresh-secret-xyz');
    });
  });

  // ==========================================
  // GATE 1: AMBIGUOUS TIMEOUT HANDLING
  // ==========================================
  describe('Gate 1: Ambiguous Timeout & Deduplication Safety', () => {
    it('sets shipment to unknown_pending_reconciliation on network timeout and prevents duplicate parcel creation', async () => {
      const orderData = {
        id: mockOrderId,
        orderNumber: 'ORD-5001',
        tenantId: mockTenantId,
        customerId: 'cust-1',
        totalAmountMinor: BigInt(150000), // 1500 BDT
        orderStatus: 'confirmed',
        shipmentStatus: 'unfulfilled',
        customerNotes: 'Deliver between 2-5pm',
      };

      const customerData = {
        id: 'cust-1',
        tenantId: mockTenantId,
        name: 'Rahim Uddin',
        phone: '01712345678',
        normalizedPhone: '+8801712345678',
      };

      const mockTx = {
        select: vi.fn()
          // 1. Order lookup
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([orderData]),
          })
          // 2. Customer lookup
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([customerData]),
          })
          // 3. Active shipment check (none currently active)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          })
          // 4. Courier account lookup
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([sampleAccount]),
          })
          // 5. Customer address lookup
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              { streetAddress: 'House 12, Road 4', district: 'Dhaka', division: 'Dhaka' },
            ]),
          }),
        insert: vi.fn()
          // Insert timeout shipment
          .mockReturnValueOnce({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'ship-timeout-1',
                  tenantId: mockTenantId,
                  orderId: mockOrderId,
                  shipmentStatus: 'unknown_pending_reconciliation',
                },
              ]),
            }),
          })
          // Insert initial audit event
          .mockReturnValueOnce({
            values: vi.fn().mockResolvedValue({}),
          }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue({}),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // Mock fetch in SteadfastAdapter to simulate an ambiguous network timeout
      const abortError: any = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

      const result = await service.sendOrderToCourier(mockTenantId, mockActorId, {
        orderId: mockOrderId,
        courierAccountId: mockAccountId,
        notes: 'Handle with care',
      });

      expect(result.success).toBe(false);
      expect(result.isAmbiguousTimeout).toBe(true);
      expect(result.shipment.shipmentStatus).toBe('unknown_pending_reconciliation');
      expect(mockTx.update).toHaveBeenCalled(); // Order updated to unknown_pending_reconciliation
    });

    it('rejects dispatch if an active or pending-reconciliation shipment already exists for the order', async () => {
      const orderData = {
        id: mockOrderId,
        orderNumber: 'ORD-5001',
        tenantId: mockTenantId,
        customerId: 'cust-1',
        totalAmountMinor: BigInt(150000),
        orderStatus: 'confirmed',
        shipmentStatus: 'unknown_pending_reconciliation',
      };

      const customerData = {
        id: 'cust-1',
        name: 'Rahim Uddin',
        phone: '01712345678',
      };

      const existingActiveShipment = {
        id: 'ship-existing-1',
        tenantId: mockTenantId,
        orderId: mockOrderId,
        shipmentStatus: 'unknown_pending_reconciliation',
        trackingCode: 'SF-UNCONFIRMED',
      };

      const mockTx = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([orderData]),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([customerData]),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([existingActiveShipment]),
          }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        service.sendOrderToCourier(mockTenantId, mockActorId, {
          orderId: mockOrderId,
          courierAccountId: mockAccountId,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('allows manual reconciliation to confirm found or mark cancelled', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([
            {
              id: 'ship-reconcile-1',
              tenantId: mockTenantId,
              orderId: mockOrderId,
              shipmentStatus: 'unknown_pending_reconciliation',
            },
          ]),
        }),
        update: vi.fn()
          .mockReturnValueOnce({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([
              {
                id: 'ship-reconcile-1',
                shipmentStatus: 'pending',
                trackingCode: 'SF-CONFIRMED-999',
              },
            ]),
          })
          .mockReturnValueOnce({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue({}),
          }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue({}),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const reconciled = await service.reconcileShipment(mockTenantId, mockActorId, 'ship-reconcile-1', {
        action: 'confirm_found',
        consignmentId: 'CID-999',
        trackingCode: 'SF-CONFIRMED-999',
        note: 'Found on Steadfast portal after timeout investigation',
      });

      expect(reconciled.shipmentStatus).toBe('pending');
      expect(reconciled.trackingCode).toBe('SF-CONFIRMED-999');
    });
  });

  // ==========================================
  // GATE 2: OUT-OF-ORDER TRACKING & TERMINAL STATE PROTECTION
  // ==========================================
  describe('Gate 2: Out-of-Order Tracking & Terminal State Protection', () => {
    it('blocks status regression when a delivered shipment receives an out-of-order in_transit or pending event', async () => {
      const deliveredShipment = {
        id: 'ship-delivered-1',
        tenantId: mockTenantId,
        orderId: mockOrderId,
        courierAccountId: mockAccountId,
        trackingCode: 'SF-TRK-777',
        shipmentStatus: 'delivered', // ALREADY IN TERMINAL STATE
      };

      const mockTx = {
        select: vi.fn()
          // 1. Shipment lookup
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([deliveredShipment]),
          })
          // 2. Courier account lookup
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([sampleAccount]),
          })
          // 3. Reload updated shipment
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([deliveredShipment]),
          })
          // 4. Events timeline
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue({}),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue({}),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // Mock Steadfast tracking API returning delayed "in_transit" status
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          delivery_status: 'in_transit', // out-of-order event!
          tracking_code: 'SF-TRK-777',
        }),
      } as any);

      const result = await service.trackShipment(mockTenantId, 'ship-delivered-1');

      expect(result.terminalRegressionBlocked).toBe(true);
      expect(result.shipment.shipmentStatus).toBe('delivered'); // Preserved terminal status!
      // Shipment table status update should NOT have been called
      expect(mockTx.update).not.toHaveBeenCalled();
      // But audit event was recorded for traceability
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });

  // ==========================================
  // GATE 3: FRAUD CHECK PROVIDER DOWN HANDLING
  // ==========================================
  describe('Gate 3: Fraud Check Provider Down Protection', () => {
    it('returns provider_unavailable and NEVER "low" when courier fraud API fails or is down', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([sampleAccount]),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // Mock fetch throwing 500 error or network failure
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused to Steadfast server'));

      const result = await service.checkCustomerRisk(mockTenantId, '01712345678');

      expect(result.providerUnavailable).toBe(true);
      expect(result.riskRating).toBe('provider_unavailable');
      expect(result.riskRating).not.toBe('low');
    });

    it('ensures RiskService sets riskStatus to provider_unavailable when courier API is down', async () => {
      const mockCourierService = {
        checkCustomerRisk: vi.fn().mockResolvedValue({
          provider: 'steadfast',
          phone: '+8801712345678',
          totalOrders: 0,
          successfulDeliveries: 0,
          returns: 0,
          deliveryRatePercent: 0,
          returnRatePercent: 0,
          riskRating: 'provider_unavailable',
          providerUnavailable: true,
        }),
      };

      const riskService = new RiskService(mockCourierService as any);

      const mockTx = {
        select: vi.fn()
          // 1. Cached check (none)
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
          // 2. Risk rules lookup
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'rule-1',
                    tenantId: mockTenantId,
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
          // 3. Blacklist check (none)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          })
          // 4. Internal order history (empty)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
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
                id: 'risk-check-1',
                riskStatus: 'provider_unavailable',
                dataSource: 'courier',
              },
            ]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue({}),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const riskResult = await riskService.checkCustomerRisk(mockTenantId, {
        phone: '01712345678',
      });

      expect(riskResult.riskStatus).toBe('provider_unavailable');
      expect(riskResult.riskStatus).not.toBe('low');
    });
  });
});
