import { describe, it, expect } from 'vitest';
import {
  calculateOrderFinance,
  calculateOperatingProfit,
  calculateNetCashMovement,
  calculateMarginPercent,
} from '../finance-calc';

describe('Finance Engine Formulas (PRD Part R Acceptance Gates)', () => {
  it('PRD Worked Example matches exact values in paisa (Gate 1)', () => {
    // PRD R.3:
    // Sales ৳1,000 (100,000 paisa)
    // Discount ৳50 (5,000 paisa)
    // Cost ৳500 (50,000 paisa)
    // Acquisition ৳30 (3,000 paisa)
    // Courier ৳80 (8,000 paisa)
    // Packaging ৳20 (2,000 paisa)
    const result = calculateOrderFinance({
      productSubtotal: 100000n, // ৳1,000
      discounts: 5000n,        // ৳50
      baseCogs: 50000n,         // ৳500
      acquisitionCost: 3000n,   // ৳30
      courierFee: 8000n,        // ৳80
      packagingCost: 2000n,     // ৳20
    });

    // Net Product Sales = ৳1,000 − ৳50 = ৳950 (95,000 paisa)
    expect(result.netSales).toBe(95000n);

    // Total COGS = ৳500 + ৳30 = ৳530 (53,000 paisa)
    expect(result.totalCogs).toBe(53000n);

    // Gross Profit = ৳950 − ৳530 = ৳420 (42,000 paisa)
    expect(result.grossProfit).toBe(42000n);

    // Total Order Costs = ৳80 + ৳20 = ৳100 (10,000 paisa)
    expect(result.totalOrderCosts).toBe(10000n);

    // Contribution After Order Costs = ৳420 − ৳100 = ৳320 (32,000 paisa)
    expect(result.contribution).toBe(32000n);
  });

  it('calculates operating profit with monthly overhead expenses', () => {
    // Gross Profit ৳42,000 (4,200,000 paisa)
    // Operating Expenses ৳15,000 (1,500,000 paisa: rent, electricity, marketing)
    const opProfit = calculateOperatingProfit(4200000n, 1500000n);
    expect(opProfit).toBe(2700000n); // ৳27,000
  });

  it('calculates operating profit with other operating items / non-operating income', () => {
    // Gross Profit ৳50,000 (5,000,000 paisa), expenses ৳20,000 (2,000,000 paisa), other income ৳2,000 (200,000 paisa)
    const opProfit = calculateOperatingProfit(5000000n, 2000000n, 200000n);
    expect(opProfit).toBe(3200000n); // ৳32,000
  });

  it('handles order with return loss and COD fee', () => {
    const result = calculateOrderFinance({
      productSubtotal: 200000n, // ৳2,000
      discounts: 10000n,        // ৳100
      reversals: 20000n,        // ৳200 (partial return refund)
      baseCogs: 90000n,         // ৳900
      courierFee: 12000n,       // ৳120
      codFee: 2000n,            // ৳20 (1% COD charge)
      returnLoss: 5000n,        // ৳50 (return shipping charge)
    });

    // Net Sales = 200,000 - 10,000 - 20,000 = 170,000
    expect(result.netSales).toBe(170000n);
    // Gross Profit = 170,000 - 90,000 = 80,000
    expect(result.grossProfit).toBe(80000n);
    // Order Costs = 12,000 + 2,000 + 5,000 = 19,000
    expect(result.totalOrderCosts).toBe(19000n);
    // Contribution = 80,000 - 19,000 = 61,000
    expect(result.contribution).toBe(61000n);
  });

  it('calculates net cash movement accurately', () => {
    // Inflows (COD settlement ৳80,000 + bKash direct ৳20,000) = 10,000,000 paisa
    // Outflows (Vendor payouts ৳40,000 + rent ৳10,000) = 5,000,000 paisa
    const netCash = calculateNetCashMovement(10000000n, 5000000n);
    expect(netCash).toBe(5000000n); // +৳50,000
  });

  it('calculates profit margin percentages correctly', () => {
    // Gross Margin %: Gross Profit ৳420 on Net Sales ৳950 = 44.21%
    const grossMargin = calculateMarginPercent(42000n, 95000n);
    expect(grossMargin).toBe(44.21);

    // Contribution Margin %: Contribution ৳320 on Net Sales ৳950 = 33.68%
    const contribMargin = calculateMarginPercent(32000n, 95000n);
    expect(contribMargin).toBe(33.68);

    // Edge case: zero sales denominator
    expect(calculateMarginPercent(0n, 0n)).toBe(0);
  });
});
