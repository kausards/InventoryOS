import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import {
  validateSsrfSafeUrl,
  verifyWooCommerceWebhookSignature,
  computeWebhookDeduplicationKey,
  encryptStoreCredentials,
  decryptStoreCredentials,
  maskStoreCredentials,
  connectStoreSchema,
  mapProductVariantSchema,
} from '../index';

describe('M6 Integrations — SSRF Protection', () => {
  it('allows valid public domain store URLs', () => {
    const validUrls = [
      'https://my-awesome-store.com.bd',
      'https://shop.brand.com/store',
      'http://ecommerce-demo.org:8080/shop',
      'https://woocommerce.mycompany.io',
    ];

    for (const url of validUrls) {
      const res = validateSsrfSafeUrl(url);
      expect(res.isValid, `Expected ${url} to be valid`).toBe(true);
      expect(res.sanitizedUrl).toBeDefined();
    }
  });

  it('rejects localhost and 127.0.0.0/8 loopback URLs', () => {
    const loopbacks = [
      'http://localhost',
      'http://localhost:3000',
      'https://127.0.0.1',
      'http://127.0.0.1:8080/admin',
      'http://127.10.20.30',
      'http://0.0.0.0',
    ];

    for (const url of loopbacks) {
      const res = validateSsrfSafeUrl(url);
      expect(res.isValid, `Expected ${url} to be rejected`).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it('rejects RFC 1918 private IP ranges (10.x, 172.16-31.x, 192.168.x)', () => {
    const privateIps = [
      'http://10.0.0.1',
      'https://10.254.1.10/wp-admin',
      'http://172.16.0.1',
      'http://172.24.100.5',
      'http://172.31.255.254',
      'http://192.168.1.1',
      'http://192.168.0.100:80',
    ];

    for (const url of privateIps) {
      const res = validateSsrfSafeUrl(url);
      expect(res.isValid, `Expected ${url} to be rejected`).toBe(false);
      expect(res.error).toContain('Private IP addresses');
    }
  });

  it('rejects cloud metadata link-local endpoints (169.254.169.254)', () => {
    const metadataUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.10.20',
      'https://169.254.169.254',
    ];

    for (const url of metadataUrls) {
      const res = validateSsrfSafeUrl(url);
      expect(res.isValid, `Expected metadata URL ${url} to be rejected`).toBe(false);
      expect(res.error).toContain('Cloud metadata');
    }
  });

  it('rejects non-http protocols and embedded credentials', () => {
    const dangerous = [
      'file:///etc/passwd',
      'ftp://ftp.example.com',
      'gopher://evil.com',
      'javascript:alert(1)',
      'http://admin:secret@legit-site.com',
    ];

    for (const url of dangerous) {
      const res = validateSsrfSafeUrl(url);
      expect(res.isValid, `Expected ${url} to be rejected`).toBe(false);
    }
  });
});

describe('M6 Integrations — WooCommerce Webhook Signature Verification', () => {
  const secret = 'super_secret_webhook_token_123';
  const payload = JSON.stringify({ id: 1042, status: 'processing', total: '1500.00' });

  it('validates authentic webhook signatures correctly', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(Buffer.from(payload, 'utf8'))
      .digest('base64');

    const result = verifyWooCommerceWebhookSignature(payload, validSignature, secret);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects tampered payloads with original signature', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(Buffer.from(payload, 'utf8'))
      .digest('base64');

    const tamperedPayload = JSON.stringify({ id: 1042, status: 'completed', total: '0.00' });
    const result = verifyWooCommerceWebhookSignature(tamperedPayload, validSignature, secret);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid webhook signature.');
  });

  it('rejects signatures generated with wrong secret', () => {
    const wrongSignature = crypto
      .createHmac('sha256', 'wrong_secret')
      .update(Buffer.from(payload, 'utf8'))
      .digest('base64');

    const result = verifyWooCommerceWebhookSignature(payload, wrongSignature, secret);
    expect(result.isValid).toBe(false);
  });

  it('rejects missing or malformed signature header', () => {
    expect(verifyWooCommerceWebhookSignature(payload, '', secret).isValid).toBe(false);
    expect(verifyWooCommerceWebhookSignature(payload, null, secret).isValid).toBe(false);
    expect(verifyWooCommerceWebhookSignature(payload, 'not_base64_garbage', secret).isValid).toBe(false);
  });

  it('computes consistent deduplication keys', () => {
    const key1 = computeWebhookDeduplicationKey('store-uuid-1', 'order.created', 1042, 'delivery-99');
    const key2 = computeWebhookDeduplicationKey('store-uuid-1', 'order.created', 1042, 'delivery-99');
    const key3 = computeWebhookDeduplicationKey('store-uuid-1', 'order.created', 1043, 'delivery-100');

    expect(key1).toBe('store-uuid-1:order.created:1042:delivery-99');
    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });
});

describe('M6 Integrations — Credential Encryption & Masking', () => {
  const credentials = {
    consumerKey: 'ck_982347892347892374982374',
    consumerSecret: 'cs_823479823479823749823749823',
    webhookSecret: 'whsec_728934792384792384',
  };

  it('encrypts and decrypts credentials losslessly using AES-256-GCM', () => {
    const encrypted = encryptStoreCredentials(credentials);
    expect(encrypted).toContain(':');
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptStoreCredentials(encrypted);
    expect(decrypted).toEqual(credentials);
  });

  it('masks sensitive credentials preventing plaintext exposure', () => {
    const masked = maskStoreCredentials(credentials);
    expect(masked.consumerKey).toBe('ck_...2374');
    expect(masked.consumerSecret).toBe('cs_...9823');
    expect(masked.webhookSecret).toBe('******');

    // Never includes the full raw secret
    expect(masked.consumerKey).not.toBe(credentials.consumerKey);
    expect(masked.consumerSecret).not.toBe(credentials.consumerSecret);
  });
});

describe('M6 Integrations — Zod Validation Schemas', () => {
  it('validates connectStoreSchema correctly', () => {
    const valid = {
      storeName: 'Daraz Flagship Store',
      storeUrl: 'https://flagship-demo.com',
      consumerKey: 'ck_1234567890abcdef',
      consumerSecret: 'cs_1234567890abcdef',
      syncOrders: true,
      pushStock: true,
    };

    const parsed = connectStoreSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects connectStoreSchema with invalid URL or short keys', () => {
    const invalid = {
      storeName: 'D',
      storeUrl: 'not_a_url',
      consumerKey: 'short',
      consumerSecret: 'short',
    };

    const parsed = connectStoreSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates mapProductVariantSchema', () => {
    const valid = {
      internalVariantId: '11111111-2222-3333-4444-555555555555',
      mappingStatus: 'mapped',
    };

    const parsed = mapProductVariantSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});
