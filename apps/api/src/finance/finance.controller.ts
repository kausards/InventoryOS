import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import {
  PERMISSIONS,
  createFinancialTransactionSchema,
  reverseFinancialTransactionSchema,
  CreateFinancialTransactionInput,
  ReverseFinancialTransactionInput,
  FinancialReportFilter,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('finance')
@UseGuards(AuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('transactions')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async listTransactions(
    @Req() req: any,
    @Query() query: any
  ) {
    const filter: FinancialReportFilter = {
      startDate: query.startDate,
      endDate: query.endDate,
      type: query.type,
      category: query.category,
      direction: query.direction,
      referenceType: query.referenceType,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    };
    return this.financeService.listTransactions(req.tenantId, filter);
  }

  @Get('transactions/:id')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async getTransactionById(@Req() req: any, @Param('id') id: string) {
    return this.financeService.getTransactionById(req.tenantId, id);
  }

  @Post('transactions')
  @RequirePermissions(PERMISSIONS.FINANCE_MANAGE)
  async createTransaction(
    @Req() req: any,
    @Body(new ZodValidationPipe(createFinancialTransactionSchema))
    dto: CreateFinancialTransactionInput
  ) {
    const actorId = req.user?.id || req.userId;
    return this.financeService.createTransaction(req.tenantId, actorId, dto);
  }

  @Post('transactions/:id/reverse')
  @RequirePermissions(PERMISSIONS.FINANCE_MANAGE)
  async reverseTransaction(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reverseFinancialTransactionSchema))
    dto: ReverseFinancialTransactionInput
  ) {
    const actorId = req.user?.id || req.userId;
    return this.financeService.reverseTransaction(req.tenantId, actorId, id, dto);
  }

  @Get('pnl')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async getPnLReport(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const filter: { startDate?: string; endDate?: string } = {};
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;
    return this.financeService.getPnLReport(req.tenantId, filter);
  }

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async getDashboardMetrics(
    @Req() req: any,
    @Query('range') range?: string
  ) {
    return this.financeService.getDashboardMetrics(req.tenantId, range);
  }

  @Post('orders/:id/recognize-revenue')
  @RequirePermissions(PERMISSIONS.FINANCE_MANAGE)
  async recognizeOrderRevenue(@Req() req: any, @Param('id') id: string) {
    const actorId = req.user?.id || req.userId;
    return this.financeService.recordOrderDeliveredRevenue(req.tenantId, id, actorId);
  }
}
