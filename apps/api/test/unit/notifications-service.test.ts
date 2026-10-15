import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { CreditsLedgerService } from '../../src/notifications/credits-ledger.service';
import { ConsentService } from '../../src/notifications/consent.service';
import { ElitbuzzSmsAdapter } from '../../src/notifications/adapters/elitbuzz-sms.adapter';
import { MetaWhatsAppAdapter } from '../../src/notifications/adapters/meta-whatsapp.adapter';
import * as dbModule from '@growthomic/db';

describe('NotificationsService & Acceptance Gates (M8)', () => {
  let notificationsService: NotificationsService;
  let creditsLedgerService: CreditsLedgerService;
  let consentService: ConsentService;
  let smsAdapter: ElitbuzzSmsAdapter;
  let whatsAppAdapter: MetaWhatsAppAdapter;

  const mockTenantId = 'tenant-m8-123';
  const mockPhone = '01711001122';

  beforeEach(() => {
    creditsLedgerService = new CreditsLedgerService();
    consentService = new ConsentService();
    smsAdapter = new ElitbuzzSmsAdapter();
    whatsAppAdapter = new MetaWhatsAppAdapter();

    notificationsService = new NotificationsService(
      creditsLedgerService,
      consentService,
      smsAdapter,
      whatsAppAdapter
    );

    vi.restoreAllMocks();
  });

  // ==========================================
  // GATE 1: ATOMIC CREDIT DEDUCTION
  // ==========================================
  describe('Gate 1: Atomic Credit Deduction & Ledger Integrity', () => {
    it('prevents deduction and throws BadRequestException when credit balance is insufficient', async () => {
      // Mock withTenant to simulate current balance of 0
      const mockTx = {
        execute: vi.fn().mockResolvedValue(true),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        }),
        insert: vi.fn(),
      };

      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_t, _a, cb: any) => cb(mockTx));

      await expect(
        creditsLedgerService.atomicDeductCredits(
          mockTenantId,
          'sms',
          5,
          'ref-101',
          'Test SMS'
        )
      ).rejects.toThrow(BadRequestException);

      // Verify no deduction entry was inserted
      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it('deducts credits atomically and records balance_after when balance is sufficient', async () => {
      const mockTx = {
        execute: vi.fn().mockResolvedValue(true),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 100 }]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(true),
        }),
      };

      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_t, _a, cb: any) => cb(mockTx));

      const res = await creditsLedgerService.atomicDeductCredits(
        mockTenantId,
        'sms',
        2,
        'ref-102',
        'Order Confirmed SMS'
      );

      expect(res.success).toBe(true);
      expect(res.balanceAfter).toBe(98);
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it('refunds credits atomically if provider dispatch fails after deduction', async () => {
      // Mock consent: not opted out
      vi.spyOn(consentService, 'isOptedOut').mockResolvedValue(false);

      // Mock deduction success
      vi.spyOn(creditsLedgerService, 'atomicDeductCredits').mockResolvedValue({
        success: true,
        balanceAfter: 49,
      });

      // Mock refund spy
      const refundSpy = vi.spyOn(creditsLedgerService, 'refundCredits').mockResolvedValue({
        success: true,
        balanceAfter: 50,
      });

      // Mock SMS adapter failing
      vi.spyOn(smsAdapter, 'sendSms').mockResolvedValue({
        success: false,
        provider: 'elitbuzz',
        creditsCharged: 0,
        error: 'Network timeout to Elitbuzz gateway',
      });

      const mockNotification = { id: 'notif-failed-1', status: 'queued' };
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockNotification]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...mockNotification, status: 'failed' }]),
            }),
          }),
        }),
      };

      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_t, _a, cb: any) => cb(mockTx));

      const result = await notificationsService.sendNotification(mockTenantId, {
        recipient: mockPhone,
        channel: 'sms',
        content: 'Your parcel is on the way',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      // Gate 1 verification: Refund was called to restore balance
      expect(refundSpy).toHaveBeenCalledWith(
        mockTenantId,
        'sms',
        1,
        'notif-failed-1',
        expect.stringContaining('Network timeout to Elitbuzz gateway')
      );
    });
  });

  // ==========================================
  // GATE 2: OPT-OUT RESPECTED
  // ==========================================
  describe('Gate 2: Customer Consent & Opt-Out Enforcement', () => {
    it('blocks notification dispatch, deducts zero credits, and does not call provider when customer is opted out', async () => {
      // Mock consent service returning opted out
      vi.spyOn(consentService, 'isOptedOut').mockResolvedValue(true);

      const deductSpy = vi.spyOn(creditsLedgerService, 'atomicDeductCredits');
      const smsSpy = vi.spyOn(smsAdapter, 'sendSms');

      const mockBlockedRecord = {
        id: 'notif-blocked-1',
        status: 'opted_out',
        creditsDeducted: 0,
      };

      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockBlockedRecord]),
          }),
        }),
      };

      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_t, _a, cb: any) => cb(mockTx));

      const result = await notificationsService.sendNotification(mockTenantId, {
        recipient: mockPhone,
        channel: 'sms',
        content: 'Order #ORD-101 has been confirmed',
      });

      // Verification: Status is opted_out
      expect(result.success).toBe(false);
      expect(result.status).toBe('opted_out');
      expect(result.message).toContain('opted out');

      // Acceptance Gate 2 Criteria: ZERO credits deducted, adapter never invoked
      expect(deductSpy).not.toHaveBeenCalled();
      expect(smsSpy).not.toHaveBeenCalled();
    });

    it('allows dispatch when customer is not opted out', async () => {
      vi.spyOn(consentService, 'isOptedOut').mockResolvedValue(false);
      vi.spyOn(creditsLedgerService, 'atomicDeductCredits').mockResolvedValue({
        success: true,
        balanceAfter: 99,
      });
      vi.spyOn(smsAdapter, 'sendSms').mockResolvedValue({
        success: true,
        externalMessageId: 'EB-12345',
        provider: 'elitbuzz',
        creditsCharged: 1,
      });

      const mockRecord = { id: 'notif-ok-1', status: 'queued' };
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockRecord]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...mockRecord, status: 'sent' }]),
            }),
          }),
        }),
      };

      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_t, _a, cb: any) => cb(mockTx));

      const result = await notificationsService.sendNotification(mockTenantId, {
        recipient: mockPhone,
        channel: 'sms',
        content: 'Order #ORD-101 confirmed',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('sent');
      expect(result.externalMessageId).toBe('EB-12345');
    });
  });

  // ==========================================
  // IN-APP & TEMPLATE DELIVERY
  // ==========================================
  describe('In-App Delivery & Template Rendering', () => {
    it('delivers in-app notifications immediately without deducting message credits', async () => {
      const deductSpy = vi.spyOn(creditsLedgerService, 'atomicDeductCredits');

      const mockInApp = {
        id: 'inapp-1',
        channel: 'in_app',
        status: 'delivered',
        creditsDeducted: 0,
      };

      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockInApp]),
          }),
        }),
      };

      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_t, _a, cb: any) => cb(mockTx));

      const result = await notificationsService.sendNotification(mockTenantId, {
        recipient: 'staff-user-1',
        channel: 'in_app',
        title: 'Low Stock Alert',
        content: 'SKU POLO-BLU-M is below minimum safety threshold (2 remaining).',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('delivered');
      expect(deductSpy).not.toHaveBeenCalled();
    });

    it('interpolates template variables accurately for customer notifications', async () => {
      vi.spyOn(consentService, 'isOptedOut').mockResolvedValue(false);
      vi.spyOn(creditsLedgerService, 'atomicDeductCredits').mockResolvedValue({
        success: true,
        balanceAfter: 98,
      });

      let dispatchedMessage = '';
      vi.spyOn(smsAdapter, 'sendSms').mockImplementation(async (payload) => {
        dispatchedMessage = payload.message;
        return {
          success: true,
          externalMessageId: 'EB-999',
          provider: 'elitbuzz',
          creditsCharged: 1,
        };
      });

      const mockRecord = { id: 'notif-tmpl-1', status: 'queued' };
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockRecord]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...mockRecord, status: 'sent' }]),
            }),
          }),
        }),
      };

      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_t, _a, cb: any) => cb(mockTx));

      await notificationsService.sendNotification(mockTenantId, {
        recipient: mockPhone,
        channel: 'sms',
        content: 'প্রিয় {{customer_name}}, আপনার অর্ডার #{{order_number}} কুরিয়ারে দেওয়া হয়েছে। ট্র্যাকিং: {{tracking_code}}।',
        variables: {
          customer_name: 'সাকিব আল হাসান',
          order_number: 'ORD-7788',
          tracking_code: 'SF-99120',
        },
      });

      expect(dispatchedMessage).toBe(
        'প্রিয় সাকিব আল হাসান, আপনার অর্ডার #ORD-7788 কুরিয়ারে দেওয়া হয়েছে। ট্র্যাকিং: SF-99120।'
      );
    });
  });
});
