import { describe, it, expect } from 'vitest';
import { isFormulaInjection, sanitizeCsvCell, cleanImportCell } from '../csv-safety.js';
import { importProductRowSchema, importCustomerRowSchema } from '../schemas/imports.js';

describe('CSV Safety & Formula Injection Protection (M11 Hardening)', () => {
  it('detects formula injection attempts starting with =, +, -, @, TAB, CR', () => {
    expect(isFormulaInjection('=cmd|/C calc!A0')).toBe(true);
    expect(isFormulaInjection('+123')).toBe(true);
    expect(isFormulaInjection('-SUM(1,2)')).toBe(true);
    expect(isFormulaInjection('@SUM(A1:A10)')).toBe(true);
    expect(isFormulaInjection('\tmalicious')).toBe(true);
    expect(isFormulaInjection('Plain Product Name')).toBe(false);
  });

  it('sanitizes export cells by prefixing single quote for formulas', () => {
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeCsvCell('+8801711223344')).toBe("'+8801711223344");
    expect(sanitizeCsvCell('Safe Text')).toBe('Safe Text');
    expect(sanitizeCsvCell(12345)).toBe('12345');
    expect(sanitizeCsvCell(null)).toBe('');
  });

  it('cleans import cells by stripping leading formula characters safely', () => {
    expect(cleanImportCell('=cmd|/C calc!A0')).toBe('cmd|/C calc!A0');
    expect(cleanImportCell('+++Cotton Shirt')).toBe('Cotton Shirt');
    expect(cleanImportCell('Normal Polo T-Shirt')).toBe('Normal Polo T-Shirt');
  });

  it('validates and cleans product row schema', () => {
    const raw = {
      name: '=Premium Polo T-Shirt',
      sku: 'POLO-001',
      retailPrice: 1200,
      stockQuantity: 50,
    };
    const parsed = importProductRowSchema.parse(raw);
    expect(parsed.name).toBe('Premium Polo T-Shirt'); // stripped formula prefix
    expect(parsed.sku).toBe('POLO-001');
    expect(parsed.retailPrice).toBe(1200);
    expect(parsed.stockQuantity).toBe(50);
  });

  it('validates and normalizes customer row with BD phone', () => {
    const raw = {
      name: 'Rahim Uddin',
      phone: '01711-223344',
      district: 'Dhaka',
    };
    const parsed = importCustomerRowSchema.parse(raw);
    expect(parsed.phone).toBe('+8801711223344');
    expect(parsed.name).toBe('Rahim Uddin');
  });
});
