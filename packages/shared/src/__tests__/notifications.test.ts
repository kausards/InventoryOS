import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  sendNotificationSchema,
  topUpCreditsSchema,
  updateConsentSchema,
  createTemplateSchema,
  DEFAULT_NOTIFICATION_TEMPLATES,
} from '../schemas/notifications';

describe('Notification Schemas & Utilities', () => {
  describe('renderTemplate', () => {
    it('should interpolate single and multiple variables correctly', () => {
      const template = 'Hello {{customer_name}}, your order #{{order_number}} is confirmed. Amount: ৳{{total_amount}}.';
      const rendered = renderTemplate(template, {
        customer_name: 'Shakib Al Hasan',
        order_number: 'ORD-9021',
        total_amount: '1,500',
      });
      expect(rendered).toBe('Hello Shakib Al Hasan, your order #ORD-9021 is confirmed. Amount: ৳1,500.');
    });

    it('should support Bangla unicode variables properly', () => {
      const template = 'প্রিয় {{customer_name}}, আপনার অর্ডার #{{order_number}} প্রস্তুত। মোট: ৳{{total_amount}}।';
      const rendered = renderTemplate(template, {
        customer_name: 'তানভীর আহমেদ',
        order_number: 'ORD-5544',
        total_amount: '২,৪৫০',
      });
      expect(rendered).toBe('প্রিয় তানভীর আহমেদ, আপনার অর্ডার #ORD-5544 প্রস্তুত। মোট: ৳২,৪৫০।');
    });

    it('should leave missing variables as placeholder tokens', () => {
      const template = 'Hello {{name}}, tracking is {{tracking_code}}';
      const rendered = renderTemplate(template, { name: 'Rahim' });
      expect(rendered).toBe('Hello Rahim, tracking is {{tracking_code}}');
    });

    it('should return empty string for empty template', () => {
      expect(renderTemplate('', {})).toBe('');
    });
  });

  describe('Validation Schemas', () => {
    it('validates sendNotificationSchema correctly', () => {
      const valid = sendNotificationSchema.safeParse({
        recipient: '01711000000',
        channel: 'sms',
        content: 'Order dispatched',
        variables: { order_number: 'ORD-1' },
      });
      expect(valid.success).toBe(true);

      const invalidChannel = sendNotificationSchema.safeParse({
        recipient: '01711000000',
        channel: 'carrier_pigeon',
        content: 'Test',
      });
      expect(invalidChannel.success).toBe(false);
    });

    it('validates topUpCreditsSchema requires positive amount', () => {
      const valid = topUpCreditsSchema.safeParse({
        channel: 'sms',
        amount: 500,
        description: 'Monthly bundle',
      });
      expect(valid.success).toBe(true);

      const zero = topUpCreditsSchema.safeParse({
        channel: 'sms',
        amount: 0,
      });
      expect(zero.success).toBe(false);

      const negative = topUpCreditsSchema.safeParse({
        channel: 'sms',
        amount: -50,
      });
      expect(negative.success).toBe(false);
    });

    it('validates updateConsentSchema requires valid consent status', () => {
      const optOut = updateConsentSchema.safeParse({
        phone: '01711223344',
        channel: 'sms',
        consentStatus: 'opted_out',
        optOutReason: 'Customer requested via SMS STOP',
      });
      expect(optOut.success).toBe(true);
    });

    it('verifies default templates include both Bangla and English options', () => {
      expect(DEFAULT_NOTIFICATION_TEMPLATES.length).toBeGreaterThanOrEqual(4);
      const bnTemplates = DEFAULT_NOTIFICATION_TEMPLATES.filter((t) => t.language === 'bn');
      const enTemplates = DEFAULT_NOTIFICATION_TEMPLATES.filter((t) => t.language === 'en');
      expect(bnTemplates.length).toBeGreaterThan(0);
      expect(enTemplates.length).toBeGreaterThan(0);
    });
  });
});
