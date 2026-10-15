import { describe, it, expect } from 'vitest';
import {
  createOrderSchema,
  transitionOrderStatusSchema,
  cancelOrderSchema,
  holdOrderSchema,
  bulkOrderActionSchema,
} from '../schemas/orders.js';

describe('Orders Zod Validation Schemas', () => {
  it('validates a valid order input with customer details', () => {
    const validOrder = {
      customer: {
        name: 'Rafiqul Islam',
        phone: '01712345678',
        address: {
          division: 'Dhaka',
          district: 'Dhaka',
          streetAddress: 'House 12, Road 4, Dhanmondi',
        },
      },
      source: 'social_facebook',
      sourceReference: 'https://fb.com/messages/t/123456',
      items: [
        {
          variantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          quantity: 2,
          unitPrice: 150000,
        },
      ],
      deliveryCharge: 6000,
      paymentMethod: 'cod',
    };

    const res = createOrderSchema.safeParse(validOrder);
    expect(res.success).toBe(true);
  });

  it('rejects order with no customer ID or customer details', () => {
    const invalidOrder = {
      items: [
        {
          variantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          quantity: 1,
          unitPrice: 10000,
        },
      ],
    };

    const res = createOrderSchema.safeParse(invalidOrder);
    expect(res.success).toBe(false);
  });

  it('rejects order with empty items array', () => {
    const invalidOrder = {
      customerId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      items: [],
    };

    const res = createOrderSchema.safeParse(invalidOrder);
    expect(res.success).toBe(false);
  });

  it('validates cancel order schema requires a reason', () => {
    expect(cancelOrderSchema.safeParse({ reason: 'Customer changed mind' }).success).toBe(true);
    expect(cancelOrderSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(cancelOrderSchema.safeParse({}).success).toBe(false);
  });

  it('validates hold order schema requires a reason', () => {
    expect(holdOrderSchema.safeParse({ reason: 'Address unverified' }).success).toBe(true);
    expect(holdOrderSchema.safeParse({ reason: '' }).success).toBe(false);
  });

  it('validates bulk order action schema requires at least one order ID', () => {
    expect(bulkOrderActionSchema.safeParse({ orderIds: [], action: 'confirm' }).success).toBe(false);
    expect(
      bulkOrderActionSchema.safeParse({
        orderIds: ['c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'],
        action: 'confirm',
      }).success
    ).toBe(true);
  });
});
