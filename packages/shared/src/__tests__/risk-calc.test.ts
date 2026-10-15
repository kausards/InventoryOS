import { describe, it, expect } from 'vitest';
import { evaluateCustomerRisk, DEFAULT_RISK_RULES } from '../risk-calc';

describe('Risk Calculation Engine (Acceptance Gate 1)', () => {
  it('insufficient data NEVER returns "low" risk status (0 eligible orders)', () => {
    const res = evaluateCustomerRisk({
      history: {
        totalOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        returnedOrders: 0,
      },
    });

    expect(res.riskStatus).toBe('insufficient_data');
    expect(res.riskStatus).not.toBe('low');
    expect(res.dataConfidence).toBe('low');
    expect(res.riskFactors[0]?.factor).toBe('INSUFFICIENT_DATA');
  });

  it('insufficient data NEVER returns "low" risk status (less than min eligible orders)', () => {
    // 2 eligible orders, but threshold is 3
    const res = evaluateCustomerRisk({
      history: {
        totalOrders: 2,
        deliveredOrders: 2,
        cancelledOrders: 0,
        returnedOrders: 0,
      },
      rules: { minEligibleOrders: 3 },
    });

    expect(res.riskStatus).toBe('insufficient_data');
    expect(res.riskStatus).not.toBe('low');
  });

  it('courier provider failure/unavailable NEVER returns "low" risk status', () => {
    const res = evaluateCustomerRisk({
      providerStatus: 'unavailable',
      history: {
        totalOrders: 10,
        deliveredOrders: 10,
        cancelledOrders: 0,
        returnedOrders: 0,
      },
    });

    expect(res.riskStatus).toBe('provider_unavailable');
    expect(res.riskStatus).not.toBe('low');
    expect(res.dataConfidence).toBe('low');
    expect(res.riskFactors[0]?.factor).toBe('PROVIDER_UNAVAILABLE');
  });

  it('blacklist match immediately classifies customer as "high" risk and requires manual review', () => {
    const res = evaluateCustomerRisk({
      blacklistMatch: {
        isBlacklisted: true,
        isWatchlisted: false,
        reason: 'Known return abuser / fake COD order history',
      },
      history: {
        totalOrders: 5,
        deliveredOrders: 5,
        cancelledOrders: 0,
        returnedOrders: 0,
      },
    });

    expect(res.riskStatus).toBe('high');
    expect(res.riskScore).toBeGreaterThanOrEqual(90);
    expect(res.requiresManualReview).toBe(true);
    expect(res.riskFactors.some((f) => f.factor === 'BLACKLIST_HIT')).toBe(true);
  });

  it('watchlist match with low orders returns "medium" risk with manual review', () => {
    const res = evaluateCustomerRisk({
      blacklistMatch: {
        isBlacklisted: false,
        isWatchlisted: true,
        reason: 'Suspicious address changes',
      },
      history: {
        totalOrders: 1,
        deliveredOrders: 1,
        cancelledOrders: 0,
        returnedOrders: 0,
      },
    });

    expect(res.riskStatus).toBe('medium');
    expect(res.requiresManualReview).toBe(true);
    expect(res.riskFactors.some((f) => f.factor === 'WATCHLIST_HIT')).toBe(true);
  });

  it('high return rate triggers "high" risk classification', () => {
    // 4 delivered, 2 returned = 33% return rate (threshold is 25%)
    const res = evaluateCustomerRisk({
      history: {
        totalOrders: 6,
        deliveredOrders: 4,
        cancelledOrders: 0,
        returnedOrders: 2,
      },
      rules: { returnThresholdPercent: 25 },
    });

    expect(res.riskStatus).toBe('high');
    expect(res.riskFactors.some((f) => f.factor === 'HIGH_RETURN_RATE')).toBe(true);
    expect(res.requiresManualReview).toBe(true);
  });

  it('high cancellation rate triggers "high" risk classification', () => {
    // 3 delivered, 3 cancelled = 50% cancellation rate (threshold is 40%)
    const res = evaluateCustomerRisk({
      history: {
        totalOrders: 6,
        deliveredOrders: 3,
        cancelledOrders: 3,
        returnedOrders: 0,
      },
      rules: { cancellationThresholdPercent: 40 },
    });

    expect(res.riskStatus).toBe('high');
    expect(res.riskFactors.some((f) => f.factor === 'HIGH_CANCELLATION_RATE')).toBe(true);
  });

  it('clean historical record with >= minEligibleOrders returns verified "low" risk', () => {
    // 5 orders, 5 delivered, 0 cancelled, 0 returned
    const res = evaluateCustomerRisk({
      history: {
        totalOrders: 5,
        deliveredOrders: 5,
        cancelledOrders: 0,
        returnedOrders: 0,
      },
      rules: { minEligibleOrders: 3 },
    });

    expect(res.riskStatus).toBe('low');
    expect(res.riskScore).toBeLessThanOrEqual(25);
    expect(res.dataConfidence).toBe('high');
    expect(res.requiresManualReview).toBe(false);
    expect(res.riskFactors.some((f) => f.factor === 'CLEAN_DELIVERY_RECORD')).toBe(true);
  });
});
