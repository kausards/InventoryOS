const BD_OPERATOR_PREFIXES = ['018', '019', '017', '016', '015', '014', '013'];

export function normalizePhone(
  raw: string
): { valid: true; normalized: string } | { valid: false; error: string } {
  // Strip spaces, dashes, parentheses
  const cleaned = raw.replace(/[\s\-()]/g, '');

  if (!/^\+?[0-9]+$/.test(cleaned)) {
    return { valid: false, error: 'Contains invalid characters.' };
  }

  let normalized = cleaned;
  if (normalized.startsWith('01')) {
    normalized = '+88' + normalized;
  } else if (normalized.startsWith('8801')) {
    normalized = '+' + normalized;
  }

  if (!normalized.startsWith('+8801')) {
    return { valid: false, error: 'Not a valid Bangladesh number prefix.' };
  }

  if (normalized.length !== 14) {
    return { valid: false, error: 'Invalid length for Bangladesh phone number.' };
  }

  const prefix = normalized.substring(3, 6);
  if (!BD_OPERATOR_PREFIXES.includes(prefix)) {
    return { valid: false, error: `Invalid operator prefix: ${prefix}` };
  }

  return { valid: true, normalized };
}

export function normalizeBdPhone(raw: string): { isValid: boolean; e164: string; error?: string } {
  const res = normalizePhone(raw);
  if (res.valid) {
    return { isValid: true, e164: res.normalized };
  }
  return { isValid: false, e164: raw, error: res.error };
}

export function formatBangladeshPhone(raw: string): string {
  const res = normalizePhone(raw);
  return res.valid ? res.normalized : raw.trim();
}

export function isValidBangladeshPhone(raw: string): boolean {
  return normalizePhone(raw).valid;
}


