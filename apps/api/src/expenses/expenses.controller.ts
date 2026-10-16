import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import {
  PERMISSIONS,
  createExpenseSchema,
  updateExpenseSchema,
  CreateExpenseInput,
  UpdateExpenseInput,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('expenses')
@UseGuards(AuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EXPENSES_VIEW)
  async listExpenses(
    @Req() req: any,
    @Query('category') category?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.expensesService.listExpenses(req.tenantId, {
      category,
      paymentStatus,
      startDate,
      endDate,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.EXPENSES_VIEW)
  async getCategorySummary(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const filter: { startDate?: string; endDate?: string } = {};
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;
    return this.expensesService.getCategorySummary(req.tenantId, filter);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EXPENSES_VIEW)
  async getExpenseById(@Req() req: any, @Param('id') id: string) {
    return this.expensesService.getExpenseById(req.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXPENSES_CREATE)
  async createExpense(
    @Req() req: any,
    @Body(new ZodValidationPipe(createExpenseSchema)) dto: CreateExpenseInput
  ) {
    const actorId = req.user?.id || req.userId;
    return this.expensesService.createExpense(req.tenantId, actorId, dto);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.EXPENSES_CREATE)
  async updateExpense(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExpenseSchema)) dto: UpdateExpenseInput
  ) {
    return this.expensesService.updateExpense(req.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EXPENSES_CREATE)
  async deleteExpense(@Req() req: any, @Param('id') id: string) {
    return this.expensesService.deleteExpense(req.tenantId, id);
  }
}
