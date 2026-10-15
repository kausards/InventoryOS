import type { RiskLevel } from './schemas/risk';

export interface CustomerOrderHistorySummary {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
}

export interface RiskRulesConfiguration {
  minEligibleOrders: number;
  cancellationThresholdPercent: number;
  returnThresholdPercent: number;
  deliveryFailureThresholdPercent: number;
  autoFlagHighRisk: boolean;
  manualReviewRequiredForHighRisk: boolean;
}

export interface BlacklistCheckResult {
  isBlacklisted: boolean;
  isWatchlisted: boolean;
  reason?: string | null;
}

export interface RiskFactor {
  factor: string;
  level: 'info' | 'low' | 'medium' | 'high';
  details: string;
}

export interface RiskEvaluationResult {
  riskStatus: RiskLevel;
  riskScore: number; // 0 - 100
  riskFactors: RiskFactor[];
  dataSource: 'internal_history' | 'blacklist' | 'courier';
  dataConfidence: 'low' | 'medium' | 'high';
  metrics: {
    eligibleOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    returnedOrders: number;
    deliveryRatePercent: number;
    cancellationRatePercent: number;
    returnRatePercent: number;
  };
  requiresManualReview: boolean;
}

export const DEFAULT_RISK_RULES: RiskRulesConfiguration = {
  minEligibleOrders: 3,
  cancellationThresholdPercent: 40,
  returnThresholdPercent: 25,
  deliveryFailureThresholdPercent: 30,
  autoFlagHighRisk: true,
  manualReviewRequiredForHighRisk: true,
};

/**
 * Deterministic Risk Assessment Engine.
 * Evaluates a customer's fraud and delivery failure risk based on order history, blacklist/watchlist, and rules.
 * 
 * CRITICAL RULE (Acceptance Gate 1): Insufficient data or provider failure NEVER returns 'low'.
 */
export function evaluateCustomerRisk(params: {
  history?: CustomerOrderHistorySummary | null;
  blacklistMatch?: BlacklistCheckResult | null;
  rules?: Partial<RiskRulesConfiguration>;
  providerStatus?: 'available' | 'unavailable';
}): RiskEvaluationResult {
  const rules: RiskRulesConfiguration = {
    ...DEFAULT_RISK_RULES,
    ...(params.rules || {}),
  };

  const history = params.history || {
    totalOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
  };

  const eligibleOrders = history.deliveredOrders + history.cancelledOrders + history.returnedOrders;
  const deliveryRate = eligibleOrders > 0 ? Math.round((history.deliveredOrders / eligibleOrders) * 100) : 0;
  const cancellationRate = eligibleOrders > 0 ? Math.round((history.cancelledOrders / eligibleOrders) * 100) : 0;
  const returnRate = eligibleOrders > 0 ? Math.round((history.returnedOrders / eligibleOrders) * 100) : 0;

  const metrics = {
    eligibleOrders,
    deliveredOrders: history.deliveredOrders,
    cancelledOrders: history.cancelledOrders,
    returnedOrders: history.returnedOrders,
    deliveryRatePercent: deliveryRate,
    cancellationRatePercent: cancellationRate,
    returnRatePercent: returnRate,
  };

  // 1. BLACKLIST HIT -> Absolute High Risk
  if (params.blacklistMatch?.isBlacklisted) {
    return {
      riskStatus: 'high',
      riskScore: 98,
      dataSource: 'blacklist',
      dataConfidence: 'high',
      riskFactors: [
        {
          factor: 'BLACKLIST_HIT',
          level: 'high',
          details: params.blacklistMatch.reason || 'Customer mobile is present on the tenant blacklist',
        },
      ],
      metrics,
      requiresManualReview: rules.manualReviewRequiredForHighRisk,
    };
  }

  // 2. PROVIDER FAILURE / UNAVAILABLE (Gate 1: Never returns 'low')
  if (params.providerStatus === 'unavailable') {
    return {
      riskStatus: 'provider_unavailable',
      riskScore: 50,
      dataSource: 'courier',
      dataConfidence: 'low',
      riskFactors: [
        {
          factor: 'PROVIDER_UNAVAILABLE',
          level: 'medium',
          details: 'Courier fraud verification service is temporarily unreachable; fallback to internal history',
        },
      ],
      metrics,
      requiresManualReview: false,
    };
  }

  // 3. INSUFFICIENT DATA CHECK (Gate 1: Never returns 'low')
  if (eligibleOrders < rules.minEligibleOrders) {
    const factors: RiskFactor[] = [
      {
        factor: 'INSUFFICIENT_DATA',
        level: 'info',
        details: `Customer has only ${eligibleOrders} order(s) on record (threshold requires minimum ${rules.minEligibleOrders})`,
      },
    ];

    if (params.blacklistMatch?.isWatchlisted) {
      factors.push({
        factor: 'WATCHLIST_HIT',
        level: 'medium',
        details: params.blacklistMatch.reason || 'Customer is on manual watchlist',
      });
      return {
        riskStatus: 'medium',
        riskScore: 65,
        dataSource: 'blacklist',
        dataConfidence: 'medium',
        riskFactors: factors,
        metrics,
        requiresManualReview: true,
      };
    }

    return {
      riskStatus: 'insufficient_data',
      riskScore: 35,
      dataSource: 'internal_history',
      dataConfidence: 'low',
      riskFactors: factors,
      metrics,
      requiresManualReview: false,
    };
  }

  // 4. HISTORICAL METRICS EVALUATION
  const factors: RiskFactor[] = [];
  let isHigh = false;
  let isMedium = false;

  if (params.blacklistMatch?.isWatchlisted) {
    factors.push({
      factor: 'WATCHLIST_HIT',
      level: 'medium',
      details: params.blacklistMatch.reason || 'Customer is marked on watchlist',
    });
    isMedium = true;
  }

  if (returnRate >= rules.returnThresholdPercent) {
    factors.push({
      factor: 'HIGH_RETURN_RATE',
      level: 'high',
      details: `Customer return rate is ${returnRate}% (threshold: ${rules.returnThresholdPercent}%)`,
    });
    isHigh = true;
  } else if (returnRate >= Math.round(rules.returnThresholdPercent / 2)) {
    factors.push({
      factor: 'ELEVATED_RETURN_RATE',
      level: 'medium',
      details: `Customer return rate is ${returnRate}%`,
    });
    isMedium = true;
  }

  if (cancellationRate >= rules.cancellationThresholdPercent) {
    factors.push({
      factor: 'HIGH_CANCELLATION_RATE',
      level: 'high',
      details: `Customer cancellation rate is ${cancellationRate}% (threshold: ${rules.cancellationThresholdPercent}%)`,
    });
    isHigh = true;
  } else if (cancellationRate >= Math.round(rules.cancellationThresholdPercent / 2)) {
    factors.push({
      factor: 'ELEVATED_CANCELLATION_RATE',
      level: 'medium',
      details: `Customer cancellation rate is ${cancellationRate}%`,
    });
    isMedium = true;
  }

  const failureRate = cancellationRate + returnRate;
  if (failureRate >= rules.deliveryFailureThresholdPercent && !isHigh) {
    factors.push({
      factor: 'HIGH_DELIVERY_FAILURE_RATE',
      level: 'high',
      details: `Total delivery failure rate (cancellations + returns) is ${failureRate}% (threshold: ${rules.deliveryFailureThresholdPercent}%)`,
    });
    isHigh = true;
  }

  if (isHigh) {
    const score = Math.min(95, Math.max(70, Math.round(50 + failureRate / 2)));
    return {
      riskStatus: rules.autoFlagHighRisk ? 'high' : 'medium',
      riskScore: score,
      dataSource: 'internal_history',
      dataConfidence: 'high',
      riskFactors: factors,
      metrics,
      requiresManualReview: rules.manualReviewRequiredForHighRisk,
    };
  }

  if (isMedium) {
    const score = Math.min(68, Math.max(45, Math.round(30 + failureRate / 2)));
    return {
      riskStatus: 'medium',
      riskScore: score,
      dataSource: 'internal_history',
      dataConfidence: 'high',
      riskFactors: factors,
      metrics,
      requiresManualReview: false,
    };
  }

  // Clean, consistent, verified low risk
  factors.push({
    factor: 'CLEAN_DELIVERY_RECORD',
    level: 'low',
    details: `Customer has successfully received ${history.deliveredOrders} out of ${eligibleOrders} order(s) (${deliveryRate}% success rate)`,
  });

  const lowScore = Math.max(5, Math.min(25, 100 - deliveryRate));
  return {
    riskStatus: 'low',
    riskScore: lowScore,
    dataSource: 'internal_history',
    dataConfidence: 'high',
    riskFactors: factors,
    metrics,
    requiresManualReview: false,
  };
}
