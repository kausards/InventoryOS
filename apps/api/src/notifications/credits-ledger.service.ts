import { Injectable, BadRequestException } from '@nestjs/common';
import { withTenant, messageCreditLedgers } from '@growthomic/db';
import { eq, desc, and, sql } from 'drizzle-orm';

export interface CreditBalanceSummary {
  smsBalance: number;
  whatsappBalance: number;
  totalBalance: number;
}

@Injectable()
export class CreditsLedgerService {
  /**
   * Get current balance for tenant
   */
  async getBalance(tenantId: string, channel?: 'sms' | 'whatsapp'): Promise<number> {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const sumRes = await tx
        .select({
          total: sql<number>`COALESCE(SUM(${messageCreditLedgers.amount}), 0)`,
        })
        .from(messageCreditLedgers)
        .where(
          channel
            ? and(
                eq(messageCreditLedgers.tenantId, tenantId),
                eq(messageCreditLedgers.channel, channel)
              )
            : eq(messageCreditLedgers.tenantId, tenantId)
        );

      return Number(sumRes[0]?.total || 0);
    });
  }

  /**
   * Get comprehensive balance summary
   */
  async getBalanceSummary(tenantId: string): Promise<CreditBalanceSummary> {
    const [smsBalance, whatsappBalance, totalBalance] = await Promise.all([
      this.getBalance(tenantId, 'sms'),
      this.getBalance(tenantId, 'whatsapp'),
      this.getBalance(tenantId),
    ]);
    return { smsBalance, whatsappBalance, totalBalance };
  }

  /**
   * Atomic credit deduction (Acceptance Gate 1)
   */
  async atomicDeductCredits(
    tenantId: string,
    channel: 'sms' | 'whatsapp',
    amount: number,
    referenceId: string,
    description: string
  ): Promise<{ success: boolean; balanceAfter: number }> {
    if (amount <= 0) {
      throw new BadRequestException('Deduction amount must be strictly greater than 0');
    }

    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      // Row lock the tenant record to serialize concurrent credit deductions for this tenant
      await tx.execute(
        sql`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`
      );

      // Compute current total balance for this channel
      const sumRes = await tx
        .select({
          total: sql<number>`COALESCE(SUM(${messageCreditLedgers.amount}), 0)`,
        })
        .from(messageCreditLedgers)
        .where(
          and(
            eq(messageCreditLedgers.tenantId, tenantId),
            eq(messageCreditLedgers.channel, channel)
          )
        );

      const currentBalance = Number(sumRes[0]?.total || 0);

      if (currentBalance < amount) {
        throw new BadRequestException(
          `Insufficient ${channel.toUpperCase()} credits. Current balance: ${currentBalance}, required: ${amount}`
        );
      }

      const balanceAfter = currentBalance - amount;

      // Append immutable deduction entry
      await tx.insert(messageCreditLedgers).values({
        tenantId,
        type: 'deduction',
        channel,
        amount: -amount,
        balanceAfter,
        referenceId,
        description,
      });

      return { success: true, balanceAfter };
    });
  }

  /**
   * Top-up credits (Manual or Payment callback)
   */
  async topUpCredits(
    tenantId: string,
    channel: 'sms' | 'whatsapp' | 'system',
    amount: number,
    description: string,
    referenceId?: string,
    userId?: string
  ): Promise<{ success: boolean; balanceAfter: number }> {
    if (amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than 0');
    }

    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      // Lock tenant for serialized balance update
      await tx.execute(
        sql`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`
      );

      const sumRes = await tx
        .select({
          total: sql<number>`COALESCE(SUM(${messageCreditLedgers.amount}), 0)`,
        })
        .from(messageCreditLedgers)
        .where(
          and(
            eq(messageCreditLedgers.tenantId, tenantId),
            eq(messageCreditLedgers.channel, channel)
          )
        );

      const currentBalance = Number(sumRes[0]?.total || 0);
      const balanceAfter = currentBalance + amount;

      await tx.insert(messageCreditLedgers).values({
        tenantId,
        type: 'top_up',
        channel,
        amount,
        balanceAfter,
        referenceId: referenceId || `TOPUP-${Date.now()}`,
        description,
        createdBy: userId || null,
      });

      return { success: true, balanceAfter };
    });
  }

  /**
   * Refund credits (e.g. if provider dispatch fails after deduction)
   */
  async refundCredits(
    tenantId: string,
    channel: 'sms' | 'whatsapp',
    amount: number,
    referenceId: string,
    reason: string
  ): Promise<{ success: boolean; balanceAfter: number }> {
    if (amount <= 0) return { success: true, balanceAfter: await this.getBalance(tenantId, channel) };

    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      await tx.execute(
        sql`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`
      );

      const sumRes = await tx
        .select({
          total: sql<number>`COALESCE(SUM(${messageCreditLedgers.amount}), 0)`,
        })
        .from(messageCreditLedgers)
        .where(
          and(
            eq(messageCreditLedgers.tenantId, tenantId),
            eq(messageCreditLedgers.channel, channel)
          )
        );

      const currentBalance = Number(sumRes[0]?.total || 0);
      const balanceAfter = currentBalance + amount;

      await tx.insert(messageCreditLedgers).values({
        tenantId,
        type: 'refund',
        channel,
        amount,
        balanceAfter,
        referenceId,
        description: `Refund: ${reason}`,
      });

      return { success: true, balanceAfter };
    });
  }

  /**
   * List credit ledger history
   */
  async listLedger(
    tenantId: string,
    channel?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return withTenant(tenantId, { type: 'system' }, async (tx: any) => {
      const records = await tx
        .select()
        .from(messageCreditLedgers)
        .where(
          channel
            ? and(
                eq(messageCreditLedgers.tenantId, tenantId),
                eq(messageCreditLedgers.channel, channel)
              )
            : eq(messageCreditLedgers.tenantId, tenantId)
        )
        .orderBy(desc(messageCreditLedgers.createdAt))
        .limit(limit)
        .offset(offset);

      return records;
    });
  }
}
