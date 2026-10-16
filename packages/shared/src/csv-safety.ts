/**
 * Utility functions for CSV safety and protection against CSV Formula Injection (PRD Section 3.5 & Security Rules)
 * Prevents malicious spreadsheet formula execution (=, +, -, @, TAB, CR)
 */

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Checks if a string value begins with dangerous spreadsheet formula triggers
 */
export function isFormulaInjection(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const rawFirstChar = value.charAt(0);
  const trimmed = value.trim();
  return (
    FORMULA_PREFIXES.includes(rawFirstChar) ||
    FORMULA_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
  );
}

/**
 * Sanitizes a cell value for CSV export or storage to neutralize formula injection
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  if (isFormulaInjection(str)) {
    // Prefix with single quote to force spreadsheet programs (Excel, Sheets) to treat it as plain text
    return `'${str}`;
  }

  return str;
}

/**
 * Strips dangerous formula injection prefix for safe database storage
 */
export function cleanImportCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();

  // If user pasted or CSV contains leading formula characters, strip them safely
  while (FORMULA_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    str = str.slice(1).trim();
  }

  return str;
}
