/**
 * Calculates bundle availability based on component on-hand and reserved quantities.
 * Formula: min over components of floor(component_available / requiredQuantity)
 */
export function calculateBundleAvailability(
  components: { onHand: number; reserved: number; requiredQuantity: number }[]
): number {
  if (components.length === 0) return 0;

  let minPossible = Infinity;

  for (const comp of components) {
    if (comp.requiredQuantity <= 0) continue;
    const available = Math.max(0, comp.onHand - comp.reserved);
    const possibleBundles = Math.floor(available / comp.requiredQuantity);
    if (possibleBundles < minPossible) {
      minPossible = possibleBundles;
    }
  }

  return minPossible === Infinity ? 0 : minPossible;
}

/**
 * Calculates weighted average cost for inventory items.
 * Formula: (currentOnHand * currentAvgCost + incomingQty * incomingCost) / (currentOnHand + incomingQty)
 */
export function calculateWeightedAverageCost(
  currentOnHand: number,
  currentAvgCost: bigint,
  incomingQty: number,
  incomingCost: bigint
): bigint {
  if (currentOnHand <= 0) return incomingCost;
  if (incomingQty <= 0) return currentAvgCost;

  const currentTotal = BigInt(currentOnHand) * currentAvgCost;
  const incomingTotal = BigInt(incomingQty) * incomingCost;
  const totalQty = BigInt(currentOnHand + incomingQty);

  if (totalQty === BigInt(0)) return BigInt(0);

  return (currentTotal + incomingTotal) / totalQty;
}

export { sanitizeCsvCell } from './csv-safety.js';

