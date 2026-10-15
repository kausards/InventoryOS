import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../phone';

describe('phone', () => {
  it('normalizes 01X format', () => {
    const res = normalizePhone('01712345678');
    expect(res.valid).toBe(true);
    if (res.valid) expect(res.normalized).toBe('+8801712345678');
  });

  it('normalizes 8801X format', () => {
    const res = normalizePhone('8801912345678');
    expect(res.valid).toBe(true);
    if (res.valid) expect(res.normalized).toBe('+8801912345678');
  });

  it('normalizes +8801X format', () => {
    const res = normalizePhone('+8801812345678');
    expect(res.valid).toBe(true);
    if (res.valid) expect(res.normalized).toBe('+8801812345678');
  });

  it('strips spaces and dashes', () => {
    const res = normalizePhone('+880 17 12-34-5678');
    expect(res.valid).toBe(true);
    if (res.valid) expect(res.normalized).toBe('+8801712345678');
  });

  it('rejects invalid length', () => {
    expect(normalizePhone('0171234567').valid).toBe(false);
  });

  it('rejects invalid operator prefix', () => {
    expect(normalizePhone('01212345678').valid).toBe(false);
  });
});
