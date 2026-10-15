import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import {
  PERMISSIONS,
  createReturnSchema,
  inspectReturnSchema,
  receiveReturnSchema,
  completeReturnSchema,
  returnReportFilterSchema,
  CreateReturnInput,
  InspectReturnInput,
  ReceiveReturnInput,
  CompleteReturnInput,
  ReturnReportFilter,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('returns')
@UseGuards(AuthGuard, PermissionsGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.RETURNS_VIEW)
  async listReturns(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('returnType') returnType?: string,
    @Query('orderId') orderId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.returnsService.listReturns(req.tenantId, {
      status,
      returnType,
      orderId,
      search,
      page,
      limit,
    });
  }

  @Get('reports')
  @RequirePermissions(PERMISSIONS.RETURNS_VIEW)
  async getReturnReports(@Req() req: any, @Query() filter: ReturnReportFilter) {
    return this.returnsService.getReturnReports(req.tenantId, filter);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.RETURNS_VIEW)
  async getReturn(@Req() req: any, @Param('id') id: string) {
    return this.returnsService.getReturn(req.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.RETURNS_CREATE)
  async createReturn(
    @Req() req: any,
    @Body(new ZodValidationPipe(createReturnSchema)) input: CreateReturnInput
  ) {
    return this.returnsService.createReturn(req.tenantId, req.user?.id || req.userId, input);
  }

  @Post(':id/receive')
  @RequirePermissions(PERMISSIONS.RETURNS_INSPECT)
  async receiveReturn(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(receiveReturnSchema)) input: ReceiveReturnInput
  ) {
    return this.returnsService.receiveReturn(req.tenantId, req.user?.id || req.userId, id, input);
  }

  @Post(':id/inspect')
  @RequirePermissions(PERMISSIONS.RETURNS_INSPECT)
  async inspectReturn(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(inspectReturnSchema)) input: InspectReturnInput
  ) {
    return this.returnsService.inspectReturn(req.tenantId, req.user?.id || req.userId, id, input);
  }

  @Post(':id/complete')
  @RequirePermissions(PERMISSIONS.RETURNS_INSPECT)
  async completeReturn(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(completeReturnSchema)) input: CompleteReturnInput
  ) {
    return this.returnsService.completeReturn(req.tenantId, req.user?.id || req.userId, id, input);
  }
}
