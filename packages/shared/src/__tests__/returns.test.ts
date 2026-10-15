import { describe, it, expect } from 'vitest';
import {
  createReturnSchema,
  inspectReturnSchema,
  completeReturnSchema,
  receiveReturnSchema,
  returnReportFilterSchema,
  RETURN_TYPES,
  RETURN_STATUSES,
  ITEM_CONDITIONS,
  ITEM_DISPOSITIONS,
} from '../schemas/returns';

describe('Returns Schemas (@growthomic/shared)', () => {
  const validUuid1 = 'a0000000-0000-0000-0000-000000000001';
  const validUuid2 = 'a0000000-0000-0000-0000-000000000002';
  const validUuid3 = 'a0000000-0000-0000-0000-000000000003';

  describe('createReturnSchema', () => {
    it('accepts valid customer return payload', () => {
      const input = {
        orderId: validUuid1,
        warehouseId: validUuid2,
        returnType: 'customer_return',
        reason: 'defective',
        notes: 'Item stopped working after 2 days',
        shippingCostMinor: 6000,
        customerDeliveryChargeRefunded: true,
        items: [
          {
            productVariantId: validUuid3,
            quantity: 1,
            unitPriceMinor: 150000,
            notes: 'Damaged power cord',
          },
        ],
      };

      const result = createReturnSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.returnType).toBe('customer_return');
        expect(result.data.shippingCostMinor).toBe(6000);
        expect(result.data.customerDeliveryChargeRefunded).toBe(true);
      }
    });

    it('accepts valid courier return (RTO) payload with defaults', () => {
      const input = {
        orderId: validUuid1,
        warehouseId: validUuid2,
        returnType: 'courier_return_rto',
        reason: 'undelivered_rto',
        items: [
          {
            productVariantId: validUuid3,
            quantity: 2,
          },
        ],
      };

      const result = createReturnSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.returnType).toBe('courier_return_rto');
        expect(result.data.reason).toBe('undelivered_rto');
        expect(result.data.shippingCostMinor).toBe(0);
        expect(result.data.customerDeliveryChargeRefunded).toBe(false);
      }
    });

    it('accepts exchange payload with exchange variant details', () => {
      const input = {
        orderId: validUuid1,
        warehouseId: validUuid2,
        returnType: 'exchange',
        reason: 'size_fit',
        notes: 'Exchange size M to L',
        items: [
          {
            productVariantId: validUuid3,
            quantity: 1,
            unitPriceMinor: 120000,
            exchangeVariantId: validUuid1,
            exchangeQuantity: 1,
          },
        ],
      };

      const result = createReturnSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success && result.data.items[0]) {
        expect(result.data.returnType).toBe('exchange');
        expect(result.data.items[0].exchangeVariantId).toBe(validUuid1);
        expect(result.data.items[0].exchangeQuantity).toBe(1);
      }
    });

    it('rejects invalid uuid or missing required fields', () => {
      const invalid = {
        orderId: 'invalid-id',
        warehouseId: validUuid2,
        items: [],
      };
      const result = createReturnSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects empty items array', () => {
      const input = {
        orderId: validUuid1,
        warehouseId: validUuid2,
        items: [],
      };
      const result = createReturnSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects negative quantity or invalid returnType', () => {
      const input = {
        orderId: validUuid1,
        warehouseId: validUuid2,
        returnType: 'non_existent_type',
        items: [
          {
            productVariantId: validUuid3,
            quantity: -1,
          },
        ],
      };
      const result = createReturnSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('inspectReturnSchema', () => {
    it('accepts inspection with intact item for restock', () => {
      const input = {
        notes: 'Inspection complete, items verified',
        items: [
          {
            itemId: validUuid1,
            condition: 'intact',
            disposition: 'restock',
            notes: 'Packaging unopened, ready for restock',
          },
        ],
      };

      const result = inspectReturnSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success && result.data.items[0]) {
        expect(result.data.items[0].condition).toBe('intact');
        expect(result.data.items[0].disposition).toBe('restock');
      }
    });

    it('accepts inspection with damaged item for write-off', () => {
      const input = {
        notes: 'Item damaged during customer use',
        items: [
          {
            itemId: validUuid1,
            condition: 'damaged',
            disposition: 'damage_writeoff',
            notes: 'Screen cracked, written off',
          },
        ],
      };

      const result = inspectReturnSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success && result.data.items[0]) {
        expect(result.data.items[0].condition).toBe('damaged');
        expect(result.data.items[0].disposition).toBe('damage_writeoff');
      }
    });

    it('rejects invalid condition or disposition', () => {
      const input = {
        items: [
          {
            itemId: validUuid1,
            condition: 'exploded',
            disposition: 'resell_as_new',
          },
        ],
      };

      const result = inspectReturnSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('receiveReturnSchema and completeReturnSchema', () => {
    it('validates receive return input', () => {
      const input = { notes: 'Courier delivered parcel to warehouse' };
      const result = receiveReturnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('validates complete return input with refund amount and status', () => {
      const input = {
        refundAmountMinor: 145000,
        refundStatus: 'refunded',
        customerDeliveryChargeRefunded: true,
        notes: 'Refunded via bKash',
      };
      const result = completeReturnSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.refundAmountMinor).toBe(145000);
        expect(result.data.refundStatus).toBe('refunded');
      }
    });
  });

  describe('Constants and Enums', () => {
    it('contains expected return types, statuses, conditions, and dispositions', () => {
      expect(RETURN_TYPES).toContain('customer_return');
      expect(RETURN_TYPES).toContain('courier_return_rto');
      expect(RETURN_TYPES).toContain('exchange');

      expect(RETURN_STATUSES).toContain('requested');
      expect(RETURN_STATUSES).toContain('received');
      expect(RETURN_STATUSES).toContain('completed');

      expect(ITEM_CONDITIONS).toContain('intact');
      expect(ITEM_CONDITIONS).toContain('damaged');

      expect(ITEM_DISPOSITIONS).toContain('restock');
      expect(ITEM_DISPOSITIONS).toContain('damage_writeoff');
    });
  });
});
