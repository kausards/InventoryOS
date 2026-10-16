import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, sql, desc, gte, lte, like, or } from 'drizzle-orm';
import { withSystem, expenses } from '@growthomic/db';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
} from '@growthomic/shared';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly financeService: FinanceService) {}

  private serializeExpense(e: any) {
    if (!e) return null;
    return {
      ...e,
      amountMinor: e.amountMinor != null ? Number(e.amountMinor) : 0,
    };
  }

  // ==========================================
  // 1. LIST EXPENSES
  // ==========================================
  async listExpenses(
    tenantId: string,
    query: {
      category?: string | undefined;
      paymentStatus?: string | undefined;
      startDate?: string | undefined;
      endDate?: string | undefined;
      search?: string | undefined;
      page?: number | undefined;
      limit?: number | undefined;
    }
  ) {
    return withSystem(async (tx) => {
      const conditions: any[] = [eq(expenses.tenantId, tenantId)];

      if (query.category) {
        conditions.push(eq(expenses.category, query.category));
      }
      if (query.paymentStatus) {
        conditions.push(eq(expenses.paymentStatus, query.paymentStatus));
      }
      if (query.startDate) {
        conditions.push(gte(expenses.expenseDate, query.startDate));
      }
      if (query.endDate) {
        conditions.push(lte(expenses.expenseDate, query.endDate));
      }
      if (query.search) {
        const pattern = `%${query.search}%`;
        conditions.push(or(like(expenses.title, pattern), like(expenses.description, pattern)));
      }

      const page = query.page && query.page > 0 ? query.page : 1;
      const limit = query.limit && query.limit > 0 ? query.limit : 50;
      const offset = (page - 1) * limit;

      const [rows, countResult] = await Promise.all([
        tx
          .select()
          .from(expenses)
          .where(and(...conditions))
          .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
          .limit(limit)
          .offset(offset),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(expenses)
          .where(and(...conditions)),
      ]);

      const total = countResult[0]?.count ?? 0;

      return {
        items: rows.map((r) => this.serializeExpense(r)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }

  // ==========================================
  // 2. GET EXPENSE BY ID
  // ==========================================
  async getExpenseById(tenantId: string, id: string) {
    return withSystem(async (tx) => {
      const row = (
        await tx
          .select()
          .from(expenses)
          .where(and(eq(expenses.id, id), eq(expenses.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!row) {
        throw new NotFoundException(`Expense with ID ${id} not found`);
      }

      return this.serializeExpense(row);
    });
  }

  // ==========================================
  // 3. CREATE EXPENSE
  // ==========================================
  async createExpense(tenantId: string, actorId: string, dto: CreateExpenseInput) {
    return withSystem(async (tx) => {
      const expNumber = `EXP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const [inserted] = await tx
        .insert(expenses)
        .values({
          tenantId,
          expenseNumber: expNumber,
          title: dto.title,
          category: dto.category,
          amountMinor: BigInt(dto.amountMinor),
          currency: dto.currency || 'BDT',
          expenseDate: dto.date || sql`now()`,
          paymentStatus: dto.paymentStatus || 'paid',
          paymentMethod: dto.paymentMethod || 'cash',
          receiptUrl: dto.receiptUrl ?? null,
          description: dto.description ?? null,
          createdBy: actorId,
        })
        .returning();

      if (!inserted) {
        throw new Error('Failed to create expense record');
      }

      // If paid, immediately post to financial ledger
      if (dto.paymentStatus === 'paid') {
        await this.financeService.createTransaction(tenantId, actorId, {
          type: 'expense',
          direction: 'out',
          category: 'operating_expense',
          amountMinor: dto.amountMinor,
          currency: dto.currency || 'BDT',
          date: dto.date,
          referenceType: 'expense',
          referenceId: inserted.id,
          paymentMethod: dto.paymentMethod,
          notes: `Operating expense: ${dto.title}`,
        });
      }

      return this.serializeExpense(inserted);
    });
  }

  // ==========================================
  // 4. UPDATE EXPENSE
  // ==========================================
  async updateExpense(tenantId: string, id: string, dto: UpdateExpenseInput) {
    return withSystem(async (tx) => {
      const updateData: any = {
        updatedAt: sql`now()`,
      };

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.category !== undefined) updateData.category = dto.category;
      if (dto.amountMinor !== undefined) updateData.amountMinor = BigInt(dto.amountMinor);
      if (dto.currency !== undefined) updateData.currency = dto.currency;
      if (dto.date !== undefined) updateData.expenseDate = dto.date;
      if (dto.paymentStatus !== undefined) updateData.paymentStatus = dto.paymentStatus;
      if (dto.paymentMethod !== undefined) updateData.paymentMethod = dto.paymentMethod;
      if (dto.receiptUrl !== undefined) updateData.receiptUrl = dto.receiptUrl;
      if (dto.description !== undefined) updateData.description = dto.description;

      const [updated] = await tx
        .update(expenses)
        .set(updateData)
        .where(and(eq(expenses.id, id), eq(expenses.tenantId, tenantId)))
        .returning();

      if (!updated) {
        throw new NotFoundException(`Expense with ID ${id} not found`);
      }

      return this.serializeExpense(updated);
    });
  }

  // ==========================================
  // 5. DELETE EXPENSE
  // ==========================================
  async deleteExpense(tenantId: string, id: string) {
    return withSystem(async (tx) => {
      const [deleted] = await tx
        .delete(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.tenantId, tenantId)))
        .returning();

      if (!deleted) {
        throw new NotFoundException(`Expense with ID ${id} not found`);
      }

      return { success: true, id: deleted.id };
    });
  }

  // ==========================================
  // 6. CATEGORY SUMMARY
  // ==========================================
  async getCategorySummary(tenantId: string, filter?: { startDate?: string; endDate?: string }) {
    return withSystem(async (tx) => {
      const conditions: any[] = [eq(expenses.tenantId, tenantId)];

      if (filter?.startDate) {
        conditions.push(gte(expenses.expenseDate, filter.startDate));
      }
      if (filter?.endDate) {
        conditions.push(lte(expenses.expenseDate, filter.endDate));
      }

      const rows = await tx
        .select({
          category: expenses.category,
          totalMinor: sql<number>`coalesce(sum(amount_minor), 0)::bigint`,
          count: sql<number>`count(*)::int`,
        })
        .from(expenses)
        .where(and(...conditions))
        .groupBy(expenses.category);

      let grandTotalMinor = 0n;
      for (const r of rows) {
        grandTotalMinor += BigInt(r.totalMinor || 0);
      }

      const grandTotalNum = Number(grandTotalMinor);

      const categories = rows.map((r) => {
        const totalNum = Number(r.totalMinor);
        const percent = grandTotalNum > 0 ? Math.round((totalNum / grandTotalNum) * 1000) / 10 : 0;
        return {
          category: r.category,
          totalMinor: totalNum,
          count: r.count,
          percentage: percent,
        };
      });

      return {
        categories,
        grandTotalMinor: grandTotalNum,
      };
    });
  }
}
