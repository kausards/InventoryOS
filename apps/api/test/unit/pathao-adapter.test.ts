import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PathaoAdapter, PathaoCredentials } from '../../src/couriers/adapters/pathao.adapter';

describe('PathaoAdapter (Gate 3 & Pathao v2 API)', () => {
  const mockCredentials: PathaoCredentials = {
    clientId: 'test-client-id-123',
    clientSecret: 'test-client-secret-456',
    username: 'merchant@shopeers.com',
    password: 'secure_password_123',
    storeId: 101,
    testMode: true,
  };

  let adapter: PathaoAdapter;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    adapter = new PathaoAdapter(mockCredentials, { timeoutMs: 2000 });
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('OAuth2 Token Management', () => {
    it('obtains access token via OAuth2 password grant', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-pathao-bearer-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
        }),
      } as any);

      const token = await adapter.getAccessToken();
      expect(token).toBe('mock-pathao-bearer-token');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://courier-api-sandbox.pathao.com/aladdin/api/v1/issue-token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            client_id: 'test-client-id-123',
            client_secret: 'test-client-secret-456',
            username: 'merchant@shopeers.com',
            password: 'secure_password_123',
            grant_type: 'password',
          }),
        })
      );
    });

    it('caches token and avoids duplicate requests if token is still valid', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'cached-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as any);

      const token1 = await adapter.getAccessToken();
      const token2 = await adapter.getAccessToken();

      expect(token1).toBe('cached-token-123');
      expect(token2).toBe('cached-token-123');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('testConnection', () => {
    it('succeeds when token and store list resolve', async () => {
      global.fetch = vi.fn()
        // First call: token
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'bearer-test-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        } as any)
        // Second call: stores
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              data: [{ store_id: 101, store_name: 'Main Hub' }],
            },
          }),
        } as any);

      const res = await adapter.testConnection();
      expect(res.success).toBe(true);
      expect(res.message).toContain('Connected successfully to Pathao API');
    });
  });

  describe('Gate 3: createOrder (Pathao Order Dispatch)', () => {
    it('successfully creates order and parses consignment ID and tracking code', async () => {
      global.fetch = vi.fn()
        // Token call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'valid-token',
            expires_in: 3600,
          }),
        } as any)
        // Create order call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            type: 'success',
            code: 200,
            message: 'Order Created Successfully',
            data: {
              consignment_id: 'PT-99887766',
              merchant_order_id: 'INV-2026-101',
              order_status: 'Pending',
              delivery_fee: 60,
            },
          }),
        } as any);

      const result = await adapter.createOrder({
        invoice: 'INV-2026-101',
        recipientName: 'Abir Hasan',
        recipientPhone: '01711223344',
        recipientAddress: 'House 12, Road 4, Dhanmondi, Dhaka',
        codAmount: 1250,
        operationId: 'op-m7-01',
        note: 'Deliver afternoon',
      });

      expect(result.success).toBe(true);
      expect(result.consignmentId).toBe('PT-99887766');
      expect(result.trackingCode).toBe('PT-99887766');
      expect(result.status).toBe('pending');
    });

    it('handles network timeout with ambiguous timeout response (Gate 1 safety)', async () => {
      global.fetch = vi.fn()
        // Token call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'valid-token',
            expires_in: 3600,
          }),
        } as any)
        // Create order call times out
        .mockRejectedValueOnce({
          name: 'AbortError',
          message: 'The operation was aborted',
        });

      const result = await adapter.createOrder({
        invoice: 'INV-TIMEOUT-001',
        recipientName: 'Tariq Rahman',
        recipientPhone: '01811223344',
        recipientAddress: 'Gulshan 2, Dhaka',
        codAmount: 500,
        operationId: 'op-m7-timeout',
      });

      expect(result.success).toBe(false);
      expect(result.isAmbiguousTimeout).toBe(true);
      expect(result.status).toBe('unknown_pending_reconciliation');
    });
  });

  describe('Tracking and Status Normalization', () => {
    it('normalizes Pathao statuses accurately', () => {
      expect(adapter.normalizePathaoStatus('Pending')).toBe('pending');
      expect(adapter.normalizePathaoStatus('Order_Created')).toBe('pending');
      expect(adapter.normalizePathaoStatus('Pickup_Requested')).toBe('in_transit');
      expect(adapter.normalizePathaoStatus('In_Transit')).toBe('in_transit');
      expect(adapter.normalizePathaoStatus('Out_For_Delivery')).toBe('out_for_delivery');
      expect(adapter.normalizePathaoStatus('Delivered')).toBe('delivered');
      expect(adapter.normalizePathaoStatus('Partial_Delivered')).toBe('partially_delivered');
      expect(adapter.normalizePathaoStatus('Cancelled')).toBe('cancelled');
      expect(adapter.normalizePathaoStatus('Returned_To_Merchant')).toBe('returned');
      expect(adapter.normalizePathaoStatus('Delivery_Failed')).toBe('failed');
    });

    it('tracks by consignment ID', async () => {
      global.fetch = vi.fn()
        // Token call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'valid-token',
            expires_in: 3600,
          }),
        } as any)
        // Track call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              consignment_id: 'PT-123456',
              order_status: 'Delivered',
              delivery_fee: 60,
              updated_at: '2026-10-15T12:00:00Z',
            },
          }),
        } as any);

      const tracking = await adapter.trackByConsignmentId('PT-123456');
      expect(tracking.consignmentId).toBe('PT-123456');
      expect(tracking.normalizedStatus).toBe('delivered');
      expect(tracking.deliveryCharge).toBe(60);
    });
  });
});
