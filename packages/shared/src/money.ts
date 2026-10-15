/**
 * Money utilities for handling paisa (integer minor units).
 * ALL AMOUNTS MUST BE IN PAISA (BIGINT).
 */

export function add(a: bigint, b: bigint): bigint {
  return a + b;
}

export function subtract(a: bigint, b: bigint): bigint {
  return a - b;
}

export function multiplyByQty(amount: bigint, qty: number): bigint {
  if (!Number.isInteger(qty)) {
    throw new Error('Quantity must be an integer.');
  }
  return amount * BigInt(qty);
}

/**
 * Applies a percentage discount to an amount.
 * @param amount Amount in paisa
 * @param percent Percentage (e.g. 15 for 15%)
 * @param rounding Rule for rounding fractional paisa
 */
export function applyPercentageDiscount(
  amount: bigint,
  percent: number,
  rounding: 'HALF_UP' | 'HALF_DOWN' = 'HALF_UP'
): bigint {
  if (percent < 0 || percent > 100) {
    throw new Error('Percent must be between 0 and 100');
  }
  
  // amount * percent / 100
  // To round, we do normal multiplication and divide, observing remainder.
  const rawDiscount = amount * BigInt(Math.round(percent * 100)); // scaling percent to integer
  // Wait, if percent is 15.5, percent*100 = 1550.
  // rawDiscount = amount * 1550 / 10000
  const dividend = amount * BigInt(Math.round(percent * 10000)); 
  const divisor = BigInt(1000000);
  
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;
  
  const halfDivisor = divisor / BigInt(2);
  
  let discount = quotient;
  if (rounding === 'HALF_UP') {
    if (remainder >= halfDivisor) {
      discount += BigInt(1);
    }
  } else if (rounding === 'HALF_DOWN') {
    if (remainder > halfDivisor) {
      discount += BigInt(1);
    }
  }
  
  return discount;
}

/**
 * Formats a paisa amount for display.
 * @param amount Amount in paisa
 * @param currency Currency code (e.g. 'BDT')
 * @param locale 'en' or 'bn'
 */
export function format(amount: bigint, currency: string, locale: 'en' | 'bn'): string {
  const isNegative = amount < BigInt(0);
  const absAmount = isNegative ? -amount : amount;
  
  const major = absAmount / BigInt(100);
  const minor = absAmount % BigInt(100);
  
  const formatter = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  });
  
  // Format the float equivalent for standard Intl.NumberFormat
  const floatAmount = Number(major) + Number(minor) / 100;
  const result = formatter.format(isNegative ? -floatAmount : floatAmount);
  
  return result;
}

/**
 * Converts a major unit (e.g. Taka string/number "1500.50") to integer paisa BigInt.
 */
export function toPaisa(amount: string | number): bigint {
  if (typeof amount === 'number') {
    return BigInt(Math.round(amount * 100));
  }
  const str = String(amount || '').trim();
  if (!str) return BigInt(0);
  const num = Number(str);
  if (isNaN(num)) return BigInt(0);
  return BigInt(Math.round(num * 100));
}

/**
 * Converts integer paisa BigInt to major unit float (e.g. 150050n -> 1500.50).
 */
export function fromPaisa(amount: bigint): number {
  return Number(amount) / 100;
}

