import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from '../../src/documents/documents.service';
import * as dbModule from '@growthomic/db';

describe('DocumentsService - Signed URLs & Tenant Scope Security', () => {
  let service: DocumentsService;

  beforeEach(() => {
    service = new DocumentsService();
    vi.restoreAllMocks();
  });

  it('generates a valid signed document URL with HMAC token and expiry', async () => {
    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await service.generateSignedUrl('tenant-1', 'user-1', {
      documentType: 'invoice',
      referenceId: 'ord-123',
      format: 'a4',
      expiresInMinutes: 30,
      lang: 'en',
    });

    expect(result.url).toContain('/api/v1/documents/render?');
    expect(result.url).toContain('token=');
    expect(result.url).toContain('tenantId=tenant-1');
    expect(result.url).toContain('documentType=invoice');
    expect(result.token).toBeDefined();
    expect(result.expiresAt).toBeDefined();
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('verifies a valid signed URL successfully', async () => {
    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const generated = await service.generateSignedUrl('tenant-1', 'user-1', {
      documentType: 'invoice',
      referenceId: 'ord-123',
      format: 'a4',
      expiresInMinutes: 30,
    });

    const parsedExpires = Number(new URLSearchParams(generated.url.split('?')[1]).get('expires'));

    const verification = service.verifySignedToken({
      token: generated.token,
      expires: parsedExpires,
      tenantId: 'tenant-1',
      documentType: 'invoice',
      referenceId: 'ord-123',
      format: 'a4',
    });

    expect(verification).toBe(true);
  });

  it('Gate 2: Rejects expired signed URLs with ForbiddenException', async () => {
    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // Generate with negative expiry to simulate expiration
    const generated = await service.generateSignedUrl('tenant-1', 'user-1', {
      documentType: 'invoice',
      referenceId: 'ord-123',
      format: 'a4',
      expiresInMinutes: -5, // expired 5 minutes ago
    });

    const parsedExpires = Number(new URLSearchParams(generated.url.split('?')[1]).get('expires'));

    expect(() =>
      service.verifySignedToken({
        token: generated.token,
        expires: parsedExpires,
        tenantId: 'tenant-1',
        documentType: 'invoice',
        referenceId: 'ord-123',
        format: 'a4',
      })
    ).toThrowError(/expired/i);
  });

  it('Gate 2: Rejects cross-tenant scope access or tampered signature with ForbiddenException', async () => {
    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const generated = await service.generateSignedUrl('tenant-1', 'user-1', {
      documentType: 'invoice',
      referenceId: 'ord-123',
      format: 'a4',
      expiresInMinutes: 30,
    });

    const parsedExpires = Number(new URLSearchParams(generated.url.split('?')[1]).get('expires'));

    // Try accessing with another tenant ID
    expect(() =>
      service.verifySignedToken({
        token: generated.token,
        expires: parsedExpires,
        tenantId: 'tenant-attacker', // Cross-tenant tampering
        documentType: 'invoice',
        referenceId: 'ord-123',
        format: 'a4',
      })
    ).toThrowError(/cross-tenant|invalid/i);

    // Try tampering referenceId
    expect(() =>
      service.verifySignedToken({
        token: generated.token,
        expires: parsedExpires,
        tenantId: 'tenant-1',
        documentType: 'invoice',
        referenceId: 'ord-999-other-order',
        format: 'a4',
      })
    ).toThrowError(/cross-tenant|invalid/i);
  });

  it('records print log with copy count and actor audit', async () => {
    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'log-1',
              tenantId: 'tenant-1',
              documentType: 'invoice',
              referenceId: 'ord-123',
              format: 'pos_thermal_80mm',
              copyCount: 1,
              printedBy: 'user-1',
              reprintReason: null,
            },
          ]),
        }),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const log = await service.createPrintLog('tenant-1', 'user-1', 'Staff Member', {
      documentType: 'invoice',
      orderIds: ['ord-123'],
      format: 'pos_thermal_80mm',
    });

    expect(log.id).toBe('log-1');
    expect(log.format).toBe('pos_thermal_80mm');
    expect(mockTx.insert).toHaveBeenCalled();
  });
});
