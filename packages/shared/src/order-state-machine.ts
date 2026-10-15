export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'on_hold'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'delivery_failed'
  | 'returned'
  | 'cancelled'
  | 'closed';

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'on_hold', 'cancelled'],
  confirmed: ['processing', 'on_hold', 'cancelled'],
  on_hold: ['confirmed', 'cancelled'],
  processing: ['ready_to_ship', 'on_hold', 'cancelled'],
  ready_to_ship: ['shipped', 'on_hold', 'cancelled'],
  shipped: ['delivered', 'delivery_failed', 'returned'],
  delivery_failed: ['shipped', 'returned'],
  delivered: ['returned', 'closed'],
  returned: ['closed'],
  cancelled: [], // terminal
  closed: [], // terminal
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
