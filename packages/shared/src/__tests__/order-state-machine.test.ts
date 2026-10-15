import { describe, it, expect } from 'vitest';
import { canTransition } from '../order-state-machine';

describe('order-state-machine', () => {
  it('allows valid transitions', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'processing')).toBe(true);
    expect(canTransition('shipped', 'delivered')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('pending', 'shipped')).toBe(false);
    expect(canTransition('delivered', 'processing')).toBe(false);
  });

  it('terminal states have no transitions', () => {
    expect(canTransition('cancelled', 'pending')).toBe(false);
    expect(canTransition('closed', 'returned')).toBe(false);
  });
});
