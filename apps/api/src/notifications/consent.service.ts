import { Injectable, Logger } from '@nestjs/common';
import { withTenant, customerConsents } from '@growthomic/db';
import { eq, and, desc } from 'drizzle-orm';
import { formatBangladeshPhone, UpdateConsentInput } from '@growthomic/shared';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  /**
   * Check if a recipient phone is opted out for a given channel (Acceptance Gate 2)
   */
  async isOptedOut(tenantId: string, phone: string, channel: 'sms' | 'whatsapp'): Promise<boolean> {
    const cleanPhone = formatBangladeshPhone(phone);

    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const records = await tx
        .select()
        .from(customerConsents)
        .where(
          and(
            eq(customerConsents.tenantId, tenantId),
            eq(customerConsents.phone, cleanPhone),
            eq(customerConsents.channel, channel)
          )
        )
        .limit(1);

      if (records.length === 0) {
        return false;
      }

      return records[0].consentStatus === 'opted_out';
    });
  }

  /**
   * Record or update customer consent status (Opt-in or Opt-out)
   */
  async recordConsent(
    tenantId: string,
    input: UpdateConsentInput,
    source: string = 'manual'
  ) {
    const cleanPhone = formatBangladeshPhone(input.phone);

    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const existing = await tx
        .select()
        .from(customerConsents)
        .where(
          and(
            eq(customerConsents.tenantId, tenantId),
            eq(customerConsents.phone, cleanPhone),
            eq(customerConsents.channel, input.channel)
          )
        )
        .limit(1);

      const now = new Date().toISOString();

      if (existing.length > 0) {
        const [updated] = await tx
          .update(customerConsents)
          .set({
            consentStatus: input.consentStatus,
            optedOutAt: input.consentStatus === 'opted_out' ? now : null,
            optOutReason: input.consentStatus === 'opted_out' ? input.optOutReason || 'Customer opt-out request' : null,
            source,
            updatedAt: now,
          })
          .where(eq(customerConsents.id, existing[0].id))
          .returning();

        this.logger.log(`Consent updated for ${cleanPhone} on ${input.channel}: ${input.consentStatus}`);
        return updated;
      }

      const [created] = await tx
        .insert(customerConsents)
        .values({
          tenantId,
          customerId: input.customerId || null,
          phone: cleanPhone,
          channel: input.channel,
          consentStatus: input.consentStatus,
          optedOutAt: input.consentStatus === 'opted_out' ? now : null,
          optOutReason: input.consentStatus === 'opted_out' ? input.optOutReason : null,
          source,
        })
        .returning();

      this.logger.log(`Consent recorded for ${cleanPhone} on ${input.channel}: ${input.consentStatus}`);
      return created;
    });
  }

  /**
   * List customer consent records
   */
  async listConsents(tenantId: string, limit: number = 50, offset: number = 0) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      return tx
        .select()
        .from(customerConsents)
        .where(eq(customerConsents.tenantId, tenantId))
        .orderBy(desc(customerConsents.updatedAt))
        .limit(limit)
        .offset(offset);
    });
  }
}
