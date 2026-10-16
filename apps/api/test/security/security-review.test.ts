import { describe, it, expect, vi } from 'vitest';
import {
  isFormulaInjection,
  sanitizeCsvCell,
  cleanImportCell,
  encryptCourierCredentials,
  decryptCourierCredentials,
} from '@growthomic/shared';
import { ImportsService } from '../../src/imports/imports.service';
import { CustomersService } from '../../src/customers/customers.service';
import * as dbModule from '@growthomic/db';

describe('Security & Hardening Review Suite', () => {
  describe('Spreadsheet Formula Injection (CSV Injection / DDE Attack Defense)', () => {
    const maliciousPayloads = [
      '=cmd|\' /C calc\'!A0',
      '+1234567890',
      '-2+3+cmd|’ /C notepad’!A0',
      '@SUM(A1:A10)',
      '\tmalicious-tab-trigger',
      '\rmalicious-cr-trigger',
      '  =DDE("server","topic","item")',
    ];

    it('accurately identifies formula injection attack signatures', () => {
      for (const payload of maliciousPayloads) {
        expect(isFormulaInjection(payload)).toBe(true);
      }
    });

    it('neutralizes attack vectors on CSV export with single quote prepending', () => {
      for (const payload of maliciousPayloads) {
        const sanitized = sanitizeCsvCell(payload);
        expect(sanitized.startsWith("'")).toBe(true);
      }
    });

    it('strips formula prefixes safely on intake with cleanImportCell', () => {
      expect(cleanImportCell('=cmd|\' /C calc\'!A0')).toBe("cmd|' /C calc'!A0");
      expect(cleanImportCell('@SUM(A1:A10)')).toBe('SUM(A1:A10)');
      expect(cleanImportCell('+Regular Product')).toBe('Regular Product');
    });

    it('prevents formula injection in dryRun imports', async () => {
      const importsService = new ImportsService();
      const res = await importsService.dryRun('tenant-sec', {
        entityType: 'products',
        fileName: 'security-test.csv',
        rows: [
          {
            name: '=ALERT("XSS/Formula")',
            sku: '+SEC-001',
            retailPrice: 999,
          },
        ],
      });

      expect(res.validRows).toBe(1);
      // Cleaned payload without leading '='
      expect(res.preview[0].name).toBe('ALERT("XSS/Formula")');
      expect(res.preview[0].sku).toBe('SEC-001');
    });
  });

  describe('Tenant Isolation & RLS Boundary Verification', () => {
    it('enforces tenant boundary on customer anonymization', async () => {
      const customersService = new CustomersService();
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // Attempt to access customer belonging to another tenant
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      // Target tenant-B from tenant-A
      await expect(
        customersService.anonymizeCustomer('tenant-A', 'cust-of-tenant-B', 'admin-user')
      ).rejects.toThrow();
    });

    it('enforces tenant boundary on import batch rollback', async () => {
      const importsService = new ImportsService();
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      // Attempt to rollback batch from different tenant
      await expect(
        importsService.undoBatch('tenant-A', 'admin-user', 'batch-of-tenant-B')
      ).rejects.toThrow();
    });
  });

  describe('Cryptographic Security & Secret Suppression', () => {
    it('encrypts sensitive credentials using authenticated AES-256-GCM', () => {
      const sensitiveKey = 'steadfast_live_secret_key_89712398471';
      const encrypted = encryptCourierCredentials(sensitiveKey);

      expect(encrypted).not.toContain(sensitiveKey);
      expect(encrypted).toContain(':'); // IV : AuthTag : Ciphertext structure

      const decrypted = decryptCourierCredentials(encrypted);
      expect(decrypted).toBe(sensitiveKey);
    });

    it('fails to decrypt if payload has been tampered with', () => {
      const sensitiveKey = 'super_secret';
      const encrypted = encryptCourierCredentials(sensitiveKey);
      const tampered = encrypted.slice(0, -4) + 'ffff';

      expect(() => decryptCourierCredentials(tampered)).toThrow();
    });
  });
});
