/**
 * Finance Engine Formulas — PRD Part R
 * Stored as integer minor units (paisa) as BigInt.
 * Deterministic, unit-tested, no float rounding errors.
 */

export interface OrderFinancialSummary {
  /** Gross sales / product subtotal before discounts in paisa */
  productSubtotal: bigint;
  /** Discounts applied to order in paisa */
  discounts: bigint;
  /** Recognized reversals/returns in paisa */
  reversals: bigint;
  /** Net Product Sales = subtotal - discounts - reversals */
  netSales: bigint;
  /** Base Product COGS (inventory unit cost * qty) in paisa */
  baseCogs: bigint;
  /** Direct product acquisition / handling cost in paisa */
  acquisitionCost: bigint;
  /** Total COGS = baseCogs + acquisitionCost */
  totalCogs: bigint;
  /** Gross Profit = Net Sales - Total COGS */
  grossProfit: bigint;
  /** Courier delivery charge allocated in paisa */
  courierFee: bigint;
  /** Packaging materials cost in paisa */
  packagingCost: bigint;
  /** Courier COD collection fee in paisa */
  codFee: bigint;
  /** Return logistics / write-off loss in paisa */
  returnLoss: bigint;
  /** Total Direct Order Costs = courierFee + packagingCost + codFee + returnLoss */
  totalOrderCosts: bigint;
  /** Contribution After Order Costs = Gross Profit - Total Order Costs */
  contribution: bigint;
}

export interface CalculateOrderFinanceParams {
  productSubtotal: bigint | number;
  discounts?: bigint | number;
  reversals?: bigint | number;
  baseCogs: bigint | number;
  acquisitionCost?: bigint | number;
  courierFee?: bigint | number;
  packagingCost?: bigint | number;
  codFee?: bigint | number;
  returnLoss?: bigint | number;
}

/**
 * Calculates deterministic order-level financial metrics per PRD R.3.
 */
export function calculateOrderFinance(params: CalculateOrderFinanceParams): OrderFinancialSummary {
  const subtotal = BigInt(params.productSubtotal);
  const discounts = BigInt(params.discounts ?? 0);
  const reversals = BigInt(params.reversals ?? 0);
  const baseCogs = BigInt(params.baseCogs);
  const acquisition = BigInt(params.acquisitionCost ?? 0);
  const courier = BigInt(params.courierFee ?? 0);
  const packaging = BigInt(params.packagingCost ?? 0);
  const cod = BigInt(params.codFee ?? 0);
  const returnLoss = BigInt(params.returnLoss ?? 0);

  // Net Product Sales = product subtotal − discounts − recognized reversals
  const netSales = subtotal - discounts - reversals;

  // Total COGS = base COGS + acquisition
  const totalCogs = baseCogs + acquisition;

  // Gross Profit = Net Sales − Total COGS
  const grossProfit = netSales - totalCogs;

  // Total Order Costs
  const totalOrderCosts = courier + packaging + cod + returnLoss;

  // Contribution After Order Costs = Gross Profit − total order-level costs
  const contribution = grossProfit - totalOrderCosts;

  return {
    productSubtotal: subtotal,
    discounts,
    reversals,
    netSales,
    baseCogs,
    acquisitionCost: acquisition,
    totalCogs,
    grossProfit,
    courierFee: courier,
    packagingCost: packaging,
    codFee: cod,
    returnLoss,
    totalOrderCosts,
    contribution,
  };
}

/**
 * Operating Profit = Gross Profit − operating expenses ± other operating items
 */
export function calculateOperatingProfit(
  grossProfit: bigint | number,
  operatingExpenses: bigint | number,
  otherItems: bigint | number = 0
): bigint {
  return BigInt(grossProfit) - BigInt(operatingExpenses) + BigInt(otherItems);
}

/**
 * Net Cash Movement = actual inflows − actual outflows (cash basis)
 */
export function calculateNetCashMovement(
  inflows: bigint | number,
  outflows: bigint | number
): bigint {
  return BigInt(inflows) - BigInt(outflows);
}

/**
 * Helper to compute margin percentage with 2 decimal precision (e.g., 42.50%)
 */
export function calculateMarginPercent(numerator: bigint | number, denominator: bigint | number): number {
  const num = BigInt(numerator);
  const den = BigInt(denominator);
  if (den === BigInt(0)) return 0;
  // Multiply by 10000 to get two decimal places (e.g. 4250 -> 42.50%)
  const basisPoints = Number((num * BigInt(10000)) / den);
  return basisPoints / 100;
}
