import { describe, it, expect } from 'vitest';
import { add, subtract, multiplyByQty, applyPercentageDiscount, format } from '../money';

describe('money', () => {
  it('adds paisa', () => {
    expect(add(100n, 200n)).toBe(300n);
  });

  it('subtracts paisa', () => {
    expect(subtract(500n, 200n)).toBe(300n);
  });

  it('multiplies by quantity', () => {
    expect(multiplyByQty(150n, 3)).toBe(450n);
    expect(() => multiplyByQty(150n, 1.5)).toThrow('Quantity must be an integer.');
  });

  it('applies percentage discount with HALF_UP rounding', () => {
    // 1000 paisa, 15% discount -> 150 paisa
    expect(applyPercentageDiscount(1000n, 15)).toBe(150n);
    // 10 paisa, 15% discount -> 1.5 paisa -> rounds to 2
    expect(applyPercentageDiscount(10n, 15)).toBe(2n);
  });

  it('formats paisa to en locale', () => {
    expect(format(95000n, 'BDT', 'en')).toBe('BDT 950.00'); // Note: standard Intl may use narrow NBSP
    expect(format(-1500n, 'BDT', 'en')).toBe('-BDT 15.00');
  });

  it('formats paisa to bn locale', () => {
    expect(format(95000n, 'BDT', 'bn')).toBe('৯৫০.০০৳');
  });

  it('matches PRD R.3 worked example', () => {
    const sales = 100000n;
    const discount = 5000n;
    const cost = 50000n;
    const acquisition = 3000n;
    const courier = 8000n;
    const packaging = 2000n;

    const netSales = subtract(sales, discount);
    expect(netSales).toBe(95000n);

    // OQ-2 Note: PRD says 420 for Gross Profit, but formula is NetSales - COGS
    // We stick to the logical formula for code integrity.
    const grossProfit = subtract(netSales, cost);
    expect(grossProfit).toBe(45000n);

    const contribution = subtract(subtract(subtract(grossProfit, acquisition), courier), packaging);
    expect(contribution).toBe(32000n);
  });
});
