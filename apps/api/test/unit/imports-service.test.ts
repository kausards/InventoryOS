import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImportsService } from '../../src/imports/imports.service';
import * as dbModule from '@growthomic/db';

describe('ImportsService - Data Import & Undo Rollback', () => {
  let service: ImportsService;

  beforeEach(() => {
    service = new ImportsService();
    vi.restoreAllMocks();
  });

  describe('dryRun', () => {
    it('validates products CSV rows and catches invalid rows', async () => {
      const res = await service.dryRun('t-1', {
        entityType: 'products',
        fileName: 'products.csv',
        rows: [
          {
            name: 'Cotton Panjabi',
            sku: 'PANJ-001',
            retailPrice: 2500,
            purchaseCost: 1200,
            stockQuantity: 50,
          },
          {
            name: '', // missing required name
            sku: 'FAIL-001',
            retailPrice: -500, // invalid negative price
          },
        ],
      });

      expect(res.totalRows).toBe(2);
      expect(res.validRows).toBe(1);
      expect(res.invalidRows).toBeGreaterThan(0);
      expect(res.preview).toHaveLength(1);
      expect(res.preview[0].name).toBe('Cotton Panjabi');
    });

    it('neutralizes formula injection characters during dryRun validation', async () => {
      const res = await service.dryRun('t-1', {
        entityType: 'products',
        fileName: 'malicious.csv',
        rows: [
          {
            name: '=cmd|’ /C calc’!A0',
            sku: '+MAL-001',
            retailPrice: 1000,
            stockQuantity: 10,
          },
        ],
      });

      expect(res.validRows).toBe(1);
      expect(res.preview[0].name).toBe('cmd|’ /C calc’!A0');
      expect(res.preview[0].sku).toBe('MAL-001');
    });

    it('validates customer rows and normalizes Bangladesh phone numbers', async () => {
      const res = await service.dryRun('t-1', {
        entityType: 'customers',
        fileName: 'customers.csv',
        rows: [
          {
            name: 'Tanvir Hossain',
            phone: '01712345678',
            address: 'Dhanmondi 27',
            division: 'Dhaka',
            district: 'Dhaka',
          },
        ],
      });

      expect(res.validRows).toBe(1);
      expect(res.preview[0].phone).toBe('+8801712345678');
    });
  });

  describe('commit', () => {
    it('commits valid product rows into database and registers import_batch', async () => {
      const mockTx = {
        select: vi.fn(),
        insert: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // 1. Warehouse lookup -> found default warehouse
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'wh-1', name: 'Main Warehouse', isDefault: true },
        ]),
      });

      // 2. Insert product
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'prod-1', name: 'Silk Saree' }]),
        }),
      });

      // 3. Insert product variant
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'var-1', sku: 'SAR-001' }]),
        }),
      });

      // 4. Insert warehouseStockBalances
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      // 5. Insert inventoryMovements
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      // 6. Insert importBatches
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'batch-1',
              entityType: 'products',
              fileName: 'products.csv',
              totalRows: 1,
              successfulRows: 1,
              status: 'completed',
              importedIds: ['prod-1'],
            },
          ]),
        }),
      });

      // 7. Insert auditLogs
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      const res = await service.commit('t-1', 'user-1', {
        entityType: 'products',
        fileName: 'products.csv',
        rows: [
          {
            name: 'Silk Saree',
            sku: 'SAR-001',
            retailPrice: 4500,
            stockQuantity: 20,
          },
        ],
      });

      expect(res.batch.id).toBe('batch-1');
      expect(res.batch.status).toBe('completed');
      expect(res.batch.successfulRows).toBe(1);
    });

    it('throws BadRequestException when no valid rows exist', async () => {
      await expect(
        service.commit('t-1', 'user-1', {
          entityType: 'products',
          fileName: 'invalid.csv',
          rows: [
            {
              name: '',
              sku: '',
              retailPrice: -1,
            },
          ],
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('undoBatch', () => {
    it('reverts all entities created by the batch and transitions status to reverted', async () => {
      const mockTx = {
        select: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
        insert: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      // 1. Select batch
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'batch-1',
            entityType: 'products',
            status: 'completed',
            importedIds: ['prod-1'],
          },
        ]),
      });

      // 2. Select variants of imported products
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'var-1' }]),
      });

      // 3. Delete stock balances
      mockTx.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue({}),
      });

      // 4. Delete inventory movements
      mockTx.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue({}),
      });

      // 5. Delete variants
      mockTx.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue({}),
      });

      // 6. Delete products
      mockTx.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue({}),
      });

      // 7. Update batch status to reverted
      mockTx.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'batch-1',
                status: 'reverted',
              },
            ]),
          }),
        }),
      });

      // 8. Insert auditLog
      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({}),
      });

      const res = await service.undoBatch('t-1', 'user-1', 'batch-1');

      expect(res.success).toBe(true);
      expect(res.revertedCount).toBe(1);
      expect(res.batch.status).toBe('reverted');
    });

    it('rejects rollback if batch was already reverted', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'batch-1',
            status: 'reverted',
            importedIds: ['prod-1'],
          },
        ]),
      });

      await expect(
        service.undoBatch('t-1', 'user-1', 'batch-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if batch does not exist', async () => {
      const mockTx = {
        select: vi.fn(),
      };
      vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      await expect(
        service.undoBatch('t-1', 'user-1', 'non-existent-batch')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
