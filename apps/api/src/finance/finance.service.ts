import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import {
  withSystem,
  financialTransactions,
  orders,
  orderItems,
} from '@growthomic/db';
import type {
  CreateFinancialTransactionInput,
  ReverseFinancialTransactionInput,
  FinancialReportFilter,
} from '@growthomic/shared';
import {
  calculateOperatingProfit,
  calculateNetCashMovement,
  calculateMarginPercent,
} from '@growthomic/shared';

@Injectable()
export class FinanceService {
  /**
   * Helper to serialize BigInts to Number for Fastify JSON responses
   */
  private serializeTransaction(t: any) {
    if (!t) return null;
    return {
      ...t,
      amountMinor: t.amountMinor != null ? Number(t.amountMinor) : 0,
    };
  }

  // ==========================================
  // 1. LIST TRANSACTIONS
  // ==========================================
  async listTransactions(tenantId: string, filter: FinancialReportFilter) {
    return withSystem(async (tx) => {
      const conditions: any[] = [eq(financialTransactions.tenantId, tenantId)];

      if (filter.startDate) {
        conditions.push(gte(financialTransactions.date, filter.startDate));
      }
      if (filter.endDate) {
        conditions.push(lte(financialTransactions.date, filter.endDate));
      }
      if (filter.type) {
        conditions.push(eq(financialTransactions.type, filter.type));
      }
      if (filter.category) {
        conditions.push(eq(financialTransactions.category, filter.category));
      }
      if (filter.direction) {
        conditions.push(eq(financialTransactions.direction, filter.direction));
      }
      if (filter.referenceType) {
        conditions.push(eq(financialTransactions.referenceType, filter.referenceType));
      }

      const limit = filter.limit ?? 50;
      const offset = filter.offset ?? 0;

      const [rows, countResult] = await Promise.all([
        tx
          .select()
          .from(financialTransactions)
          .where(and(...conditions))
          .orderBy(desc(financialTransactions.date), desc(financialTransactions.createdAt))
          .limit(limit)
          .offset(offset),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(financialTransactions)
          .where(and(...conditions)),
      ]);

      const total = countResult[0]?.count ?? 0;

      return {
        items: rows.map((r) => this.serializeTransaction(r)),
        total,
        limit,
        offset,
      };
    });
  }

  // ==========================================
  // 2. GET TRANSACTION BY ID
  // ==========================================
  async getTransactionById(tenantId: string, id: string) {
    return withSystem(async (tx) => {
      const row = (
        await tx
          .select()
          .from(financialTransactions)
          .where(and(eq(financialTransactions.id, id), eq(financialTransactions.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!row) {
        throw new NotFoundException(`Financial transaction with ID ${id} not found`);
      }

      return this.serializeTransaction(row);
    });
  }

  // ==========================================
  // 3. CREATE TRANSACTION (MANUAL/ADJUSTMENT)
  // ==========================================
  async createTransaction(
    tenantId: string,
    actorId: string,
    dto: CreateFinancialTransactionInput
  ) {
    return withSystem(async (tx) => {
      const txnNumber = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const [created] = await tx
        .insert(financialTransactions)
        .values({
          tenantId,
          transactionNumber: txnNumber,
          type: dto.type,
          direction: dto.direction,
          category: dto.category,
          amountMinor: BigInt(dto.amountMinor),
          currency: dto.currency || 'BDT',
          date: dto.date || sql`now()`,
          referenceType: dto.referenceType ?? null,
          referenceId: dto.referenceId ?? null,
          paymentMethod: dto.paymentMethod ?? null,
          status: 'posted',
          notes: dto.notes ?? null,
          metadata: dto.metadata ?? null,
          createdBy: actorId,
        })
        .returning();

      return this.serializeTransaction(created);
    });
  }

  // ==========================================
  // 4. REVERSE TRANSACTION (IMMUTABLE LEDGER)
  // ==========================================
  async reverseTransaction(
    tenantId: string,
    actorId: string,
    transactionId: string,
    dto: ReverseFinancialTransactionInput
  ) {
    return withSystem(async (tx) => {
      const original = (
        await tx
          .select()
          .from(financialTransactions)
          .where(
            and(
              eq(financialTransactions.id, transactionId),
              eq(financialTransactions.tenantId, tenantId)
            )
          )
          .for('update')
          .limit(1)
      )[0];

      if (!original) {
        throw new NotFoundException(`Transaction ${transactionId} not found`);
      }

      if (original.status === 'reversed') {
        throw new BadRequestException(`Transaction ${original.transactionNumber} is already reversed`);
      }

      // 1. Create reversal transaction with opposite direction
      const reversedDirection = original.direction === 'in' ? 'out' : 'in';
      const reversalNumber = `REV-${original.transactionNumber}`;

      const [reversalRow] = await tx
        .insert(financialTransactions)
        .values({
          tenantId,
          transactionNumber: reversalNumber,
          type: original.type,
          direction: reversedDirection,
          category: original.category,
          amountMinor: original.amountMinor,
          currency: original.currency,
          date: sql`now()`,
          referenceType: original.referenceType,
          referenceId: original.referenceId,
          paymentMethod: original.paymentMethod,
          status: 'posted',
          reversalOf: original.id,
          notes: `Reversal of ${original.transactionNumber}. Reason: ${dto.reason}`,
          createdBy: actorId,
        })
        .returning();

      // 2. Mark original transaction as reversed
      const [updatedOriginal] = await tx
        .update(financialTransactions)
        .set({ status: 'reversed' })
        .where(eq(financialTransactions.id, original.id))
        .returning();

      return {
        original: this.serializeTransaction(updatedOriginal),
        reversal: this.serializeTransaction(reversalRow),
      };
    });
  }

  // ==========================================
  // 5. REVENUE RECOGNITION AT DELIVERY (PRD R.2, R.3, R.4)
  // ==========================================
  async recordOrderDeliveredRevenue(
    tenantId: string,
    orderId: string,
    actorId: string
  ) {
    return withSystem(async (tx) => {
      // 1. Check idempotency: check if already recognized
      const existing = await tx
        .select({ id: financialTransactions.id })
        .from(financialTransactions)
        .where(
          and(
            eq(financialTransactions.tenantId, tenantId),
            eq(financialTransactions.referenceType, 'order'),
            eq(financialTransactions.referenceId, orderId),
            eq(financialTransactions.type, 'sale')
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Already recorded
        return { recorded: false, message: 'Revenue already recognized for this order' };
      }

      // 2. Fetch order and line items
      const order = (
        await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      const items = await tx
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.orderId, orderId), eq(orderItems.tenantId, tenantId)));

      // 3. Compute amounts in paisa
      const productSubtotalMinor = BigInt(order.subtotalMinor || 0);
      const discountMinor = BigInt(order.discountMinor || 0);
      const netProductSalesMinor = productSubtotalMinor > discountMinor ? productSubtotalMinor - discountMinor : 0n;

      // Calculate COGS across items
      let totalCogsMinor = 0n;
      for (const it of items) {
        const qty = BigInt(it.quantity || 1);
        const costPerUnit = it.unitCostMinor != null && BigInt(it.unitCostMinor) > 0n
          ? BigInt(it.unitCostMinor)
          : (BigInt(it.unitPriceMinor || 0) * 60n) / 100n; // fallback 60% if not set
        totalCogsMinor += costPerUnit * qty;
      }

      const courierChargeMinor = BigInt(order.deliveryChargeMinor || 0);
      // Standard packaging cost ৳20 (2000 paisa) per parcel as default
      const packagingCostMinor = 2000n;

      const createdEntries = [];

      // Entry A: Recognized Product Sales (Net Revenue)
      if (netProductSalesMinor > 0n) {
        const [saleTx] = await tx
          .insert(financialTransactions)
          .values({
            tenantId,
            transactionNumber: `TXN-SALE-${order.orderNumber}`,
            type: 'sale',
            direction: 'in',
            category: 'revenue',
            amountMinor: netProductSalesMinor,
            currency: 'BDT',
            date: sql`now()`,
            referenceType: 'order',
            referenceId: order.id,
            paymentMethod: order.paymentMethod || 'cash',
            status: 'posted',
            notes: `Delivered sales revenue for order #${order.orderNumber}`,
            createdBy: actorId,
          })
          .returning();
        createdEntries.push(saleTx);
      }

      // Entry B: Cost of Goods Sold (COGS)
      if (totalCogsMinor > 0n) {
        const [cogsTx] = await tx
          .insert(financialTransactions)
          .values({
            tenantId,
            transactionNumber: `TXN-COGS-${order.orderNumber}`,
            type: 'cogs',
            direction: 'out',
            category: 'cogs',
            amountMinor: totalCogsMinor,
            currency: 'BDT',
            date: sql`now()`,
            referenceType: 'order',
            referenceId: order.id,
            status: 'posted',
            notes: `COGS recognized at delivery for order #${order.orderNumber}`,
            createdBy: actorId,
          })
          .returning();
        createdEntries.push(cogsTx);
      }

      // Entry C: Courier Shipping Cost
      if (courierChargeMinor > 0n) {
        const [courierTx] = await tx
          .insert(financialTransactions)
          .values({
            tenantId,
            transactionNumber: `TXN-COURIER-${order.orderNumber}`,
            type: 'courier_fee',
            direction: 'out',
            category: 'order_cost',
            amountMinor: courierChargeMinor,
            currency: 'BDT',
            date: sql`now()`,
            referenceType: 'order',
            referenceId: order.id,
            status: 'posted',
            notes: `Courier shipping fee for order #${order.orderNumber}`,
            createdBy: actorId,
          })
          .returning();
        createdEntries.push(courierTx);
      }

      // Entry D: Packaging Cost
      if (packagingCostMinor > 0n) {
        const [packTx] = await tx
          .insert(financialTransactions)
          .values({
            tenantId,
            transactionNumber: `TXN-PACK-${order.orderNumber}`,
            type: 'packaging_cost',
            direction: 'out',
            category: 'order_cost',
            amountMinor: packagingCostMinor,
            currency: 'BDT',
            date: sql`now()`,
            referenceType: 'order',
            referenceId: order.id,
            status: 'posted',
            notes: `Packaging materials cost for order #${order.orderNumber}`,
            createdBy: actorId,
          })
          .returning();
        createdEntries.push(packTx);
      }

      return {
        recorded: true,
        entriesCount: createdEntries.length,
        entries: createdEntries.map((e) => this.serializeTransaction(e)),
      };
    });
  }

  // ==========================================
  // 6. PROFIT & LOSS STATEMENT (P&L REPORT)
  // ==========================================
  async getPnLReport(tenantId: string, filter?: { startDate?: string; endDate?: string }) {
    return withSystem(async (tx) => {
      const conditions: any[] = [eq(financialTransactions.tenantId, tenantId)];

      if (filter?.startDate) {
        conditions.push(gte(financialTransactions.date, filter.startDate));
      }
      if (filter?.endDate) {
        conditions.push(lte(financialTransactions.date, filter.endDate));
      }

      const rows = await tx
        .select()
        .from(financialTransactions)
        .where(and(...conditions));

      // Separate into components
      let grossSalesMinor = 0n;
      let salesReversalsMinor = 0n;
      let cogsMinor = 0n;
      let cogsReversalsMinor = 0n;
      let courierCostsMinor = 0n;
      let packagingCostsMinor = 0n;
      let codFeesMinor = 0n;
      let returnCostsMinor = 0n;
      let operatingExpensesMinor = 0n;
      let totalInflowsMinor = 0n;
      let totalOutflowsMinor = 0n;

      for (const row of rows) {
        const amt = BigInt(row.amountMinor || 0);

        if (row.direction === 'in') {
          totalInflowsMinor += amt;
        } else {
          totalOutflowsMinor += amt;
        }

        const isReversal = row.reversalOf != null || row.transactionNumber.startsWith('REV-');

        if (row.type === 'sale') {
          if (isReversal) {
            salesReversalsMinor += amt;
          } else {
            grossSalesMinor += amt;
          }
        } else if (row.type === 'cogs') {
          if (isReversal) {
            cogsReversalsMinor += amt;
          } else {
            cogsMinor += amt;
          }
        } else if (row.type === 'courier_fee') {
          courierCostsMinor += isReversal ? -amt : amt;
        } else if (row.type === 'packaging_cost') {
          packagingCostsMinor += isReversal ? -amt : amt;
        } else if (row.type === 'cod_fee') {
          codFeesMinor += isReversal ? -amt : amt;
        } else if (row.type === 'return_cost') {
          returnCostsMinor += isReversal ? -amt : amt;
        } else if (row.type === 'expense' || row.category === 'operating_expense') {
          operatingExpensesMinor += isReversal ? -amt : amt;
        }
      }

      const netProductSalesMinor = grossSalesMinor > salesReversalsMinor ? grossSalesMinor - salesReversalsMinor : 0n;
      const netCogsMinor = cogsMinor > cogsReversalsMinor ? cogsMinor - cogsReversalsMinor : 0n;
      const grossProfitMinor = netProductSalesMinor - netCogsMinor;

      const directOrderCostsMinor =
        courierCostsMinor + packagingCostsMinor + codFeesMinor + returnCostsMinor;

      const contributionMarginMinor = grossProfitMinor - directOrderCostsMinor;

      const operatingProfitMinor = calculateOperatingProfit(
        grossProfitMinor,
        operatingExpensesMinor
      );

      const netCashMovementMinor = calculateNetCashMovement(
        totalInflowsMinor,
        totalOutflowsMinor
      );

      const grossMarginPercent = calculateMarginPercent(grossProfitMinor, netProductSalesMinor);
      const operatingMarginPercent = calculateMarginPercent(operatingProfitMinor, netProductSalesMinor);

      return {
        period: {
          startDate: filter?.startDate ?? null,
          endDate: filter?.endDate ?? null,
        },
        revenue: {
          grossSalesMinor: Number(grossSalesMinor),
          salesReversalsMinor: Number(salesReversalsMinor),
          netProductSalesMinor: Number(netProductSalesMinor),
        },
        cogs: {
          totalCogsMinor: Number(netCogsMinor),
        },
        profit: {
          grossProfitMinor: Number(grossProfitMinor),
          grossMarginPercent,
        },
        directOrderCosts: {
          courierCostsMinor: Number(courierCostsMinor),
          packagingCostsMinor: Number(packagingCostsMinor),
          codFeesMinor: Number(codFeesMinor),
          returnCostsMinor: Number(returnCostsMinor),
          totalDirectOrderCostsMinor: Number(directOrderCostsMinor),
          contributionMarginMinor: Number(contributionMarginMinor),
        },
        operatingExpenses: {
          totalOperatingExpensesMinor: Number(operatingExpensesMinor),
        },
        bottomLine: {
          operatingProfitMinor: Number(operatingProfitMinor),
          operatingMarginPercent,
          netCashMovementMinor: Number(netCashMovementMinor),
        },
        transactionsCount: rows.length,
      };
    });
  }

  // ==========================================
  // 7. DASHBOARD METRICS & TIME-SERIES CHARTS
  // ==========================================
  async getDashboardMetrics(tenantId: string, range: string = '30d') {
    return withSystem(async (tx) => {
      // Calculate date boundary
      const now = new Date();
      let days = 30;
      if (range === 'today') days = 1;
      else if (range === '7d') days = 7;
      else if (range === '90d') days = 90;

      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

      // Get P&L for this period
      const pnl = await this.getPnLReport(tenantId, { startDate });

      // Daily trend series
      const txRows = await tx
        .select()
        .from(financialTransactions)
        .where(
          and(
            eq(financialTransactions.tenantId, tenantId),
            gte(financialTransactions.date, startDate)
          )
        )
        .orderBy(financialTransactions.date);

      // Bucket by day (YYYY-MM-DD)
      const dayMap: Record<string, { date: string; revenue: number; expense: number; profit: number }> = {};

      for (let i = 0; i <= days; i++) {
        const d = new Date(now.getTime() - (days - i) * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0]!;
        dayMap[key] = { date: key, revenue: 0, expense: 0, profit: 0 };
      }

      for (const row of txRows) {
        const dayKey = row.date.split('T')[0]!;
        if (!dayMap[dayKey]) {
          dayMap[dayKey] = { date: dayKey, revenue: 0, expense: 0, profit: 0 };
        }
        const amt = Number(row.amountMinor) / 100; // convert to taka for chart
        if (row.type === 'sale' && row.direction === 'in') {
          dayMap[dayKey].revenue += amt;
        } else if (row.type === 'cogs' || row.type === 'courier_fee' || row.type === 'packaging_cost' || row.type === 'expense') {
          dayMap[dayKey].expense += amt;
        }
      }

      const dailyTrends = Object.values(dayMap).map((d) => ({
        ...d,
        profit: Math.round(d.revenue - d.expense),
      }));

      // Order counts & averages
      const orderStats = await tx
        .select({
          totalOrders: sql<number>`count(*)::int`,
          deliveredOrders: sql<number>`count(case when order_status = 'delivered' then 1 end)::int`,
          cancelledOrders: sql<number>`count(case when order_status = 'cancelled' then 1 end)::int`,
          returnedOrders: sql<number>`count(case when order_status = 'returned' then 1 end)::int`,
          totalSales: sql<number>`coalesce(sum(case when order_status = 'delivered' then total_amount_minor else 0 end), 0)::bigint`,
        })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, startDate)));

      const totalDelivered = orderStats[0]?.deliveredOrders || 0;
      const totalSalesMinor = Number(orderStats[0]?.totalSales || 0);
      const averageOrderValueMinor = totalDelivered > 0 ? Math.round(totalSalesMinor / totalDelivered) : 0;

      return {
        summary: {
          netRevenueMinor: pnl.revenue.netProductSalesMinor,
          grossProfitMinor: pnl.profit.grossProfitMinor,
          operatingProfitMinor: pnl.bottomLine.operatingProfitMinor,
          grossMarginPercent: pnl.profit.grossMarginPercent,
          operatingMarginPercent: pnl.bottomLine.operatingMarginPercent,
          totalDeliveredOrders: totalDelivered,
          averageOrderValueMinor,
          cancelledOrdersCount: orderStats[0]?.cancelledOrders || 0,
          returnedOrdersCount: orderStats[0]?.returnedOrders || 0,
        },
        pnl,
        dailyTrends,
      };
    });
  }
}
