import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { IntegrationsService } from '../../src/integrations/integrations.service';
import { InventoryService } from '../../src/inventory/inventory.service';
import { WooCommerceClient } from '../../src/integrations/woocommerce.client';
import * as dbModule from '@growthomic/db';
import { encryptStoreCredentials } from '@growthomic/shared';

describe('IntegrationsService & Acceptance Gates (M6)', () => {
  let service: IntegrationsService;
  let mockInventoryService: InventoryService;

  const mockTenantId = 'tenant-123';
  const mockActorId = 'user-456';
  const mockStoreId = 'store-789';
  const mockWebhookSecret = 'my_wh_secret_xyz_123';

  const sampleRawCreds = {
    consumerKey: 'ck_1234567890abcdef',
    consumerSecret: 'cs_1234567890abcdef',
    webhookSecret: mockWebhookSecret,
  };

  const sampleStore = {
    id: mockStoreId,
    tenantId: mockTenantId,
    platform: 'woocommerce',
    storeName: 'Daraz Flagship',
    storeUrl: 'https://flagship-store.com.bd',
    encryptedCredentials: encryptStoreCredentials(sampleRawCreds),
    isActive: true,
    syncOrders: true,
    pushStock: true,
    defaultWarehouseId: 'wh-1',
    lastOrderSyncedAt: null,
    lastStockPushedAt: null,
    healthStatus: 'healthy',
    healthMessage: 'Connected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockInventoryService = {
      reserveStock: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as InventoryService;

    service = new IntegrationsService(mockInventoryService);
    vi.restoreAllMocks();
  });

  // ==========================================
  // GATE 4: SSRF BLOCK TEST
  // ==========================================
  describe('Acceptance Gate 4: SSRF Block Test', () => {
    it('rejects connection attempts to localhost (127.0.0.1)', async () => {
      await expect(
        service.connectStore(mockTenantId, mockActorId, {
          platform: 'woocommerce',
          storeName: 'Evil Localhost',
          storeUrl: 'http://127.0.0.1:3000',
          consumerKey: 'ck_1234567890abcdef',
          consumerSecret: 'cs_1234567890abcdef',
          syncOrders: true,
          pushStock: true,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects connection attempts to private IP ranges (10.x, 192.168.x)', async () => {
      await expect(
        service.connectStore(mockTenantId, mockActorId, {
          platform: 'woocommerce',
          storeName: 'Private Network Attack',
          storeUrl: 'https://192.168.1.100/wp-admin',
          consumerKey: 'ck_1234567890abcdef',
          consumerSecret: 'cs_1234567890abcdef',
          syncOrders: true,
          pushStock: true,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects connection attempts to AWS metadata endpoint (169.254.169.254)', async () => {
      await expect(
        service.connectStore(mockTenantId, mockActorId, {
          platform: 'woocommerce',
          storeName: 'Cloud Metadata Attack',
          storeUrl: 'http://169.254.169.254/latest/meta-data/',
          consumerKey: 'ck_1234567890abcdef',
          consumerSecret: 'cs_1234567890abcdef',
          syncOrders: true,
          pushStock: true,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-http protocols (file://, ftp://)', async () => {
      await expect(
        service.connectStore(mockTenantId, mockActorId, {
          platform: 'woocommerce',
          storeName: 'File Scheme Attack',
          storeUrl: 'file:///etc/passwd',
          consumerKey: 'ck_1234567890abcdef',
          consumerSecret: 'cs_1234567890abcdef',
          syncOrders: true,
          pushStock: true,
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // GATE 2: INVALID SIGNATURE REJECTED
  // ==========================================
  describe('Acceptance Gate 2: Invalid Webhook Signature Rejected', () => {
    it('throws UnauthorizedException when webhook signature does not match payload HMAC', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([sampleStore]),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const payload = JSON.stringify({ id: 999, status: 'processing' });
      const forgedSignature = 'not_a_valid_hmac_signature';

      await expect(
        service.handleWebhook(
          mockStoreId,
          payload,
          forgedSignature,
          'woocommerce.order.created',
          { id: 999, status: 'processing' }
        )
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when webhook signature header is completely missing', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([sampleStore]),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const payload = JSON.stringify({ id: 999 });

      await expect(
        service.handleWebhook(
          mockStoreId,
          payload,
          null,
          'woocommerce.order.created',
          { id: 999 }
        )
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ==========================================
  // GATE 1: REPLAYED WEBHOOK CREATES NO DUPLICATE
  // ==========================================
  describe('Acceptance Gate 1: Replayed Webhook Creates No Duplicate', () => {
    it('ignores replayed webhook events using deduplication key without creating duplicate orders', async () => {
      const payloadObj = { id: 1042, date_modified: '2026-10-14T10:00:00Z', total: '150.00' };
      const rawPayload = JSON.stringify(payloadObj);

      const validSignature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(Buffer.from(rawPayload, 'utf8'))
        .digest('base64');

      const existingEvent = {
        id: 'event-already-recorded-1',
        deduplicationKey: `${mockStoreId}:woocommerce.order.created:1042:2026-10-14T10:00:00Z`,
        status: 'processed',
      };

      const mockTx = {
        select: vi.fn()
          // 1st query: get store
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([sampleStore]),
          })
          // 2nd query: check deduplication key (finds existing!)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([existingEvent]),
          }),
        insert: vi.fn(),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const res = await service.handleWebhook(
        mockStoreId,
        rawPayload,
        validSignature,
        'woocommerce.order.created',
        payloadObj
      );

      expect(res.status).toBe('duplicate_ignored');
      expect(res.message).toContain('already processed');
      // Verify insert was never called!
      expect(mockTx.insert).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // GATE 3: MISSED EVENT RECOVERED BY RECONCILIATION
  // ==========================================
  describe('Acceptance Gate 3: Missed Event Recovered by Reconciliation', () => {
    it('ingests missing WooCommerce orders during reconciliation scan', async () => {
      const mockWcOrder = {
        id: 7777,
        number: '7777',
        status: 'processing',
        total: '2500.00',
        shipping_total: '100.00',
        discount_total: '0.00',
        payment_method: 'cod',
        billing: {
          first_name: 'Rahim',
          last_name: 'Uddin',
          phone: '01712345678',
          email: 'rahim@example.com',
          address_1: 'Mirpur 10',
          city: 'Dhaka',
        },
        shipping: {},
        line_items: [
          {
            id: 1,
            product_id: 101,
            variation_id: 0,
            name: 'Polo Shirt',
            price: 2400,
            quantity: 1,
            total: '2400.00',
          },
        ],
      };

      // Mock WooCommerceClient.getOrders
      vi.spyOn(WooCommerceClient.prototype, 'getOrders').mockResolvedValue([mockWcOrder as any]);

      const mockTx = {
        select: vi.fn()
          // 1st: get store
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([sampleStore]),
          })
          // 2nd: check if order exists (returns empty -> missed order!)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          })
          // 3rd: check customer
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          })
          // 4th: get warehouse
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'wh-1' }]),
          })
          // 5th: order sequence
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            for: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ prefix: 'ORD-', lastNumber: 1500 }]),
          })
          // 6th: product mapping lookup
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          }),
        insert: vi.fn()
          // insert customer
          .mockReturnValueOnce({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'cust-new', name: 'Rahim' }]),
            }),
          })
          // insert customer address
          .mockReturnValueOnce({ values: vi.fn().mockResolvedValue([]) })
          // insert order
          .mockReturnValueOnce({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'ord-new', orderNumber: 'ORD-1501' }]),
            }),
          })
          // insert order items
          .mockReturnValueOnce({ values: vi.fn().mockResolvedValue([]) })
          // insert order status history
          .mockReturnValueOnce({ values: vi.fn().mockResolvedValue([]) }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const reconResult = await service.reconcileOrders(mockTenantId, mockStoreId, 7);

      expect(reconResult.success).toBe(true);
      expect(reconResult.totalChecked).toBe(1);
      expect(reconResult.recoveredCount).toBe(1);
      expect(reconResult.alreadySyncedCount).toBe(0);
    });
  });

  // ==========================================
  // CREDENTIAL MASKING & DISCONNECT TESTS
  // ==========================================
  describe('Credential Confidentiality & Store Disconnection', () => {
    it('masks Consumer Key and Secret in listStores preventing leak', async () => {
      const mockTx = {
        select: vi.fn()
          // 1st: get stores
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue([sampleStore]),
          })
          // 2nd: mapping stats
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([
              { totalMappings: 10, mappedCount: 8, unmappedCount: 2 },
            ]),
          }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const stores = await service.listStores(mockTenantId);
      expect(stores).toHaveLength(1);
      const s = stores[0];
      expect(s).toBeDefined();
      expect(s.credentials.consumerKey).toContain('ck_...');
      expect(s.credentials.consumerSecret).toContain('cs_...');
      expect(s.encryptedCredentials).toBe('[ENCRYPTED_AES_256_GCM]');

      const str = JSON.stringify(stores);
      expect(str).not.toContain('ck_1234567890abcdef');
      expect(str).not.toContain('cs_1234567890abcdef');
    });

    it('disconnects store by setting isActive false and keeps historical data intact', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([sampleStore]),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...sampleStore, isActive: false, healthStatus: 'disconnected' }]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const res = await service.disconnectStore(mockTenantId, mockStoreId, mockActorId);
      expect(res.success).toBe(true);
      expect(res.store.isActive).toBe(false);
      expect(res.store.healthStatus).toBe('disconnected');
    });

    it('prevents stock push loops when quantity is already pushed', async () => {
      const mockMapping = {
        id: 'map-1',
        tenantId: mockTenantId,
        storeId: mockStoreId,
        externalProductId: '101',
        externalVariantId: '',
        internalVariantId: 'var-1',
        mappingStatus: 'mapped',
        lastPushedStock: 25, // Already 25!
      };

      const mockTx = {
        select: vi.fn()
          // 1st: get store
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([sampleStore]),
          })
          // 2nd: get mappings
          .mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([mockMapping]),
          }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      const updateStockSpy = vi.spyOn(WooCommerceClient.prototype, 'updateStock');

      const pushRes = await service.pushStockToStore(mockTenantId, mockStoreId, 'var-1', 25);
      expect(pushRes.success).toBe(true);
      expect(pushRes.updatedCount).toBe(0); // Skipped because lastPushedStock is already 25!
      expect(updateStockSpy).not.toHaveBeenCalled();
    });
  });
});
