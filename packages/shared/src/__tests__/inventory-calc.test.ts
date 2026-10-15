import { describe, it, expect } from 'vitest';
import {
  calculateBundleAvailability,
  calculateWeightedAverageCost,
  sanitizeCsvCell,
} from '../inventory-calc.js';
import { csvImportBatchSchema, CSV_MAX_ROWS } from '../schemas/inventory.js';

describe('Inventory Calculators & Sanitizers', () => {
  describe('calculateBundleAvailability', () => {
    it('returns 0 when components list is empty', () => {
      expect(calculateBundleAvailability([])).toBe(0);
    });

    it('correctly calculates min floor ratio across components', () => {
      // Bundle needs 2 units of Comp A and 3 units of Comp B
      const components = [
        { onHand: 12, reserved: 2, requiredQuantity: 2 }, // available: 10, possible: 5
        { onHand: 20, reserved: 5, requiredQuantity: 3 }, // available: 15, possible: 5
      ];
      expect(calculateBundleAvailability(components)).toBe(5);
    });

    it('bottlenecks to lowest available component', () => {
      const components = [
        { onHand: 10, reserved: 7, requiredQuantity: 2 }, // available: 3, possible: 1
        { onHand: 100, reserved: 0, requiredQuantity: 1 }, // available: 100, possible: 100
      ];
      expect(calculateBundleAvailability(components)).toBe(1);
    });

    it('returns 0 if any component is completely out of stock', () => {
      const components = [
        { onHand: 5, reserved: 5, requiredQuantity: 1 }, // available: 0
        { onHand: 100, reserved: 0, requiredQuantity: 1 },
      ];
      expect(calculateBundleAvailability(components)).toBe(0);
    });
  });

  describe('calculateWeightedAverageCost', () => {
    it('returns incoming cost when initial stock is zero', () => {
      const cost = calculateWeightedAverageCost(0, BigInt(0), 10, BigInt(15000));
      expect(cost).toBe(BigInt(15000));
    });

    it('computes weighted average cost accurately without float drift', () => {
      // 10 units @ 10,000 paisa (৳100) + 10 units @ 20,000 paisa (৳200) => 15,000 paisa (৳150)
      const cost = calculateWeightedAverageCost(10, BigInt(10000), 10, BigInt(20000));
      expect(cost).toBe(BigInt(15000));
    });

    it('handles unequal incoming quantities and price swings', () => {
      // 100 units @ 5,000 paisa + 50 units @ 8,000 paisa
      // Total = 500,000 + 400,000 = 900,000 / 150 = 6,000 paisa
      const cost = calculateWeightedAverageCost(100, BigInt(5000), 50, BigInt(8000));
      expect(cost).toBe(BigInt(6000));
    });
  });

  describe('sanitizeCsvCell (Formula Injection Defense)', () => {
    it('prepends single quote to cells beginning with formula triggers', () => {
      expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
      expect(sanitizeCsvCell('+cmd|')).toBe("'+cmd|");
      expect(sanitizeCsvCell('-50')).toBe("'-50");
      expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(sanitizeCsvCell('\tmalicious')).toBe("'\tmalicious");
      expect(sanitizeCsvCell('\rmalicious')).toBe("'\rmalicious");
    });

    it('leaves standard text and numbers untouched', () => {
      expect(sanitizeCsvCell('Wireless Earbuds')).toBe('Wireless Earbuds');
      expect(sanitizeCsvCell('SKU-9921')).toBe('SKU-9921');
      expect(sanitizeCsvCell(500)).toBe('500');
      expect(sanitizeCsvCell(null)).toBe('');
      expect(sanitizeCsvCell(undefined)).toBe('');
    });
  });

  describe('CSV Import Limits (Row and Size Limit Tests)', () => {
    it('rejects empty CSV batch', () => {
      const result = csvImportBatchSchema.safeParse({ rows: [] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('at least 1 product row');
      }
    });

    it('rejects CSV batches exceeding the maximum allowed limit of 5,000 rows', () => {
      expect(CSV_MAX_ROWS).toBe(5000);

      // Create dummy array exceeding limit
      const oversizedRows = new Array(5001).fill({
        name: 'Bulk Item',
        sku: 'BULK-ITEM',
        retailPrice: 100,
      });

      const result = csvImportBatchSchema.safeParse({ rows: oversizedRows });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('cannot exceed 5000 rows');
      }
    });

    it('accepts valid CSV batch within boundary limits', () => {
      const validRows = [
        {
          name: 'Mechanical Keyboard',
          sku: 'KB-01',
          retailPrice: 450000,
          purchaseCost: 250000,
          initialStock: 20,
        },
      ];
      const result = csvImportBatchSchema.safeParse({ rows: validRows });
      expect(result.success).toBe(true);
    });
  });
});


