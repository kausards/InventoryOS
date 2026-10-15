import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  withTenant,
  notifications,
  notificationTemplates,
  notificationPreferences,
} from '@growthomic/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  SendNotificationInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  UpdatePreferencesInput,
  renderTemplate,
  DEFAULT_NOTIFICATION_TEMPLATES,
} from '@growthomic/shared';
import { CreditsLedgerService } from './credits-ledger.service';
import { ConsentService } from './consent.service';
import { ElitbuzzSmsAdapter } from './adapters/elitbuzz-sms.adapter';
import { MetaWhatsAppAdapter } from './adapters/meta-whatsapp.adapter';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly creditsLedgerService: CreditsLedgerService,
    private readonly consentService: ConsentService,
    private readonly smsAdapter: ElitbuzzSmsAdapter,
    private readonly whatsAppAdapter: MetaWhatsAppAdapter
  ) {}

  /**
   * Main notification dispatcher (Acceptance Gates 1, 2, 3)
   */
  async sendNotification(tenantId: string, input: SendNotificationInput) {
    const channel = input.channel;
    const recipient = input.recipient.trim();

    // 1. Consent / Opt-Out Check (Acceptance Gate 2)
    if (channel === 'sms' || channel === 'whatsapp') {
      const isOptedOut = await this.consentService.isOptedOut(tenantId, recipient, channel);
      if (isOptedOut) {
        this.logger.warn(`Dispatch blocked: recipient ${recipient} is opted out for ${channel}`);

        // Record as opted_out without deducting any credits
        const record = await withTenant(tenantId, { type: 'system' }, async (tx: any) => {
          const [res] = await tx
            .insert(notifications)
            .values({
              tenantId,
              recipient,
              customerId: input.customerId || null,
              orderId: input.orderId || null,
              channel,
              type: input.type || 'customer_alert',
              title: input.title || 'Message Blocked',
              content: input.content,
              status: 'opted_out',
              creditsDeducted: 0,
              errorDetails: 'Recipient has opted out of receiving notifications on this channel.',
            })
            .returning();
          return res;
        });

        return {
          success: false,
          status: 'opted_out',
          message: 'Customer has opted out of receiving notifications',
          notification: record,
        };
      }
    }

    // 2. Resolve content (Template variables or direct text)
    let finalContent = input.content;
    const templateId = input.templateId || null;

    if (templateId) {
      const tmpl = await this.getTemplateById(tenantId, templateId);
      if (tmpl) {
        finalContent = renderTemplate(tmpl.content, input.variables || {});
      }
    } else if (input.variables && Object.keys(input.variables).length > 0) {
      finalContent = renderTemplate(input.content, input.variables);
    }

    // 3. Handle In-App notifications (Free, immediate delivery)
    if (channel === 'in_app') {
      const record = await withTenant(tenantId, { type: 'system' }, async (tx: any) => {
        const [res] = await tx
          .insert(notifications)
          .values({
            tenantId,
            recipient,
            customerId: input.customerId || null,
            orderId: input.orderId || null,
            channel: 'in_app',
            type: input.type || 'staff_alert',
            title: input.title || 'System Notification',
            content: finalContent,
            status: 'delivered',
            creditsDeducted: 0,
            deliveredAt: new Date().toISOString(),
          })
          .returning();
        return res;
      });

      return {
        success: true,
        status: 'delivered',
        notification: record,
      };
    }

    // 4. Calculate required credits
    // SMS: 1 credit per segment (160 ASCII or 70 Unicode)
    // WhatsApp: 2 credits per message
    const hasUnicode = /[^\u0000-\u007f]/.test(finalContent);
    const segmentSize = hasUnicode ? 70 : 160;
    const requiredCredits =
      channel === 'whatsapp'
        ? 2
        : Math.max(1, Math.ceil(finalContent.length / segmentSize));

    // 5. Create queued notification record first
    const notificationRecord: any = await withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const [res] = await tx
        .insert(notifications)
        .values({
          tenantId,
          recipient,
          customerId: input.customerId || null,
          orderId: input.orderId || null,
          channel,
          type: input.type || 'customer_alert',
          title: input.title || null,
          content: finalContent,
          status: 'queued',
          creditsDeducted: 0,
        })
        .returning();
      return res;
    });

    // 6. Atomic credit deduction (Acceptance Gate 1)
    let deductionSuccessful = false;
    try {
      await this.creditsLedgerService.atomicDeductCredits(
        tenantId,
        channel as 'sms' | 'whatsapp',
        requiredCredits,
        notificationRecord.id,
        `${channel.toUpperCase()} dispatch to ${recipient} (Order: ${input.orderId || 'N/A'})`
      );
      deductionSuccessful = true;
    } catch (err: any) {
      this.logger.warn(`Credit deduction failed for tenant ${tenantId}: ${err.message}`);

      // Mark notification as credit_exhausted
      await withTenant(tenantId, { type: 'system' }, async (tx: any) => {
        await tx
          .update(notifications)
          .set({
            status: 'credit_exhausted',
            errorDetails: err.message,
          })
          .where(eq(notifications.id, notificationRecord.id));
      });

      return {
        success: false,
        status: 'credit_exhausted',
        message: err.message,
        notificationId: notificationRecord.id,
      };
    }

    // 7. Dispatch to provider adapter
    let sendResult: { success: boolean; externalMessageId?: string | undefined; error?: string | undefined };

    if (channel === 'sms') {
      sendResult = await this.smsAdapter.sendSms({
        to: recipient,
        message: finalContent,
      });
    } else {
      sendResult = await this.whatsAppAdapter.sendWhatsApp({
        to: recipient,
        message: finalContent,
      });
    }

    // 8. Handle dispatch result
    if (sendResult.success) {
      const [updated] = await withTenant(tenantId, { type: 'system' }, async (tx: any) => {
        return tx
          .update(notifications)
          .set({
            status: 'sent',
            creditsDeducted: requiredCredits,
            externalMessageId: sendResult.externalMessageId || null,
            sentAt: new Date().toISOString(),
          })
          .where(eq(notifications.id, notificationRecord.id))
          .returning();
      });

      return {
        success: true,
        status: 'sent',
        externalMessageId: sendResult.externalMessageId,
        creditsDeducted: requiredCredits,
        notification: updated,
      };
    } else {
      // Dispatch failed: Refund deducted credits atomically
      if (deductionSuccessful) {
        await this.creditsLedgerService.refundCredits(
          tenantId,
          channel as 'sms' | 'whatsapp',
          requiredCredits,
          notificationRecord.id,
          `Provider error: ${sendResult.error}`
        );
      }

      const [updated] = await withTenant(tenantId, { type: 'system' }, async (tx: any) => {
        return tx
          .update(notifications)
          .set({
            status: 'failed',
            creditsDeducted: 0,
            errorDetails: sendResult.error || 'Provider dispatch failed',
          })
          .where(eq(notifications.id, notificationRecord.id))
          .returning();
      });

      return {
        success: false,
        status: 'failed',
        error: sendResult.error,
        notification: updated,
      };
    }
  }

  /**
   * Retry a previously failed or credit-exhausted notification safely
   */
  async retryNotification(tenantId: string, notificationId: string) {
    const record: any = await withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const res = await tx
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.tenantId, tenantId),
            eq(notifications.id, notificationId)
          )
        )
        .limit(1);
      return res[0];
    });

    if (!record) {
      throw new NotFoundException('Notification not found');
    }

    if (record.status === 'sent' || record.status === 'delivered') {
      throw new BadRequestException('Notification has already been sent');
    }

    // Increment retry count
    await withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      await tx
        .update(notifications)
        .set({ retryCount: record.retryCount + 1 })
        .where(eq(notifications.id, notificationId));
    });

    // Re-dispatch using main flow
    return this.sendNotification(tenantId, {
      recipient: record.recipient,
      channel: record.channel as any,
      type: record.type as any,
      title: record.title || undefined,
      content: record.content,
      variables: {},
      orderId: record.orderId || undefined,
      customerId: record.customerId || undefined,
    });
  }

  /**
   * List notification delivery logs
   */
  async listNotifications(
    tenantId: string,
    filter: {
      channel?: string | undefined;
      status?: string | undefined;
      orderId?: string | undefined;
      search?: string | undefined;
      page?: number | undefined;
      limit?: number | undefined;
    } = {}
  ) {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 50;
    const offset = (page - 1) * limit;

    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const conditions: any[] = [eq(notifications.tenantId, tenantId)];

      if (filter.channel) {
        conditions.push(eq(notifications.channel, filter.channel));
      }
      if (filter.status) {
        conditions.push(eq(notifications.status, filter.status));
      }
      if (filter.orderId) {
        conditions.push(eq(notifications.orderId, filter.orderId));
      }
      if (filter.search) {
        conditions.push(
          sql`(${notifications.recipient} ILIKE ${`%${filter.search}%`} OR ${notifications.content} ILIKE ${`%${filter.search}%`})`
        );
      }

      const [items, countResult] = await Promise.all([
        tx
          .select()
          .from(notifications)
          .where(and(...conditions))
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset(offset),
        tx
          .select({ count: sql<number>`count(*)` })
          .from(notifications)
          .where(and(...conditions)),
      ]);

      const total = Number(countResult[0]?.count || 0);

      return {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  /**
   * Get in-app notification center alerts
   */
  async getInAppNotifications(tenantId: string, limit: number = 20) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const items = await tx
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.tenantId, tenantId),
            eq(notifications.channel, 'in_app')
          )
        )
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      const unreadCountRes = await tx
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(
            eq(notifications.tenantId, tenantId),
            eq(notifications.channel, 'in_app'),
            sql`${notifications.readAt} IS NULL`
          )
        );

      return {
        items,
        unreadCount: Number(unreadCountRes[0]?.count || 0),
      };
    });
  }

  /**
   * Mark an in-app notification as read
   */
  async markInAppRead(tenantId: string, notificationId: string) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const [updated] = await tx
        .update(notifications)
        .set({ readAt: new Date().toISOString() })
        .where(
          and(
            eq(notifications.tenantId, tenantId),
            eq(notifications.id, notificationId)
          )
        )
        .returning();
      return updated;
    });
  }

  /**
   * Mark all in-app notifications as read
   */
  async markAllInAppRead(tenantId: string) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      await tx
        .update(notifications)
        .set({ readAt: new Date().toISOString() })
        .where(
          and(
            eq(notifications.tenantId, tenantId),
            eq(notifications.channel, 'in_app'),
            sql`${notifications.readAt} IS NULL`
          )
        );
      return { success: true };
    });
  }

  // ----------------------------------------------------
  // Templates Management
  // ----------------------------------------------------

  async listTemplates(tenantId: string) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const templates = await tx
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.tenantId, tenantId))
        .orderBy(notificationTemplates.name);

      if (templates.length === 0) {
        return this.seedDefaultTemplates(tenantId);
      }
      return templates;
    });
  }

  async getTemplateById(tenantId: string, id: string) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const res = await tx
        .select()
        .from(notificationTemplates)
        .where(
          and(
            eq(notificationTemplates.tenantId, tenantId),
            eq(notificationTemplates.id, id)
          )
        )
        .limit(1);
      return res[0] || null;
    });
  }

  async createTemplate(tenantId: string, input: CreateTemplateInput) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const [created] = await tx
        .insert(notificationTemplates)
        .values({
          tenantId,
          name: input.name,
          triggerEvent: input.triggerEvent,
          channel: input.channel,
          language: input.language || 'bn',
          content: input.content,
          isActive: input.isActive ?? true,
        })
        .returning();
      return created;
    });
  }

  async updateTemplate(tenantId: string, id: string, input: UpdateTemplateInput) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const [updated] = await tx
        .update(notificationTemplates)
        .set({
          ...input,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(notificationTemplates.tenantId, tenantId),
            eq(notificationTemplates.id, id)
          )
        )
        .returning();
      return updated;
    });
  }

  async seedDefaultTemplates(tenantId: string) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const values = DEFAULT_NOTIFICATION_TEMPLATES.map((t) => ({
        tenantId,
        name: t.name,
        triggerEvent: t.triggerEvent,
        channel: t.channel,
        language: t.language,
        content: t.content,
        isActive: true,
        isSystem: true,
      }));

      return tx.insert(notificationTemplates).values(values).returning();
    });
  }

  // ----------------------------------------------------
  // Preferences Management
  // ----------------------------------------------------

  async getPreferences(tenantId: string) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const res = await tx
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.tenantId, tenantId))
        .limit(1);

      if (res.length > 0) return res[0];

      const [created] = await tx
        .insert(notificationPreferences)
        .values({ tenantId })
        .returning();
      return created;
    });
  }

  async updatePreferences(tenantId: string, input: UpdatePreferencesInput) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const existing = await tx
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.tenantId, tenantId))
        .limit(1);

      const now = new Date().toISOString();

      if (existing.length > 0) {
        const [updated] = await tx
          .update(notificationPreferences)
          .set({
            ...input,
            updatedAt: now,
          })
          .where(eq(notificationPreferences.tenantId, tenantId))
          .returning();
        return updated;
      }

      const [created] = await tx
        .insert(notificationPreferences)
        .values({
          tenantId,
          ...input,
        })
        .returning();
      return created;
    });
  }
}
