import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CouriersService, ReconcileShipmentInput } from './couriers.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import {
  createCourierAccountSchema,
  updateCourierAccountSchema,
  sendToCourierSchema,
  createSettlementSchema,
  CreateCourierAccountInput,
  UpdateCourierAccountInput,
  SendToCourierInput,
  CreateSettlementInput,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('couriers')
@UseGuards(AuthGuard, PermissionsGuard)
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  // ==========================================
  // COURIER ACCOUNTS
  // ==========================================

  @Get('accounts')
  @RequirePermissions(PERMISSIONS.COURIERS_VIEW)
  async getAccounts(@Req() req: any) {
    return this.couriersService.getAccounts(req.tenantId);
  }

  @Get('accounts/:id')
  @RequirePermissions(PERMISSIONS.COURIERS_VIEW)
  async getAccountById(@Req() req: any, @Param('id') id: string) {
    return this.couriersService.getAccountById(req.tenantId, id);
  }

  @Post('accounts')
  @RequirePermissions(PERMISSIONS.COURIERS_MANAGE)
  async createAccount(
    @Req() req: any,
    @Body(new ZodValidationPipe(createCourierAccountSchema)) input: CreateCourierAccountInput
  ) {
    return this.couriersService.createAccount(req.tenantId, input);
  }

  @Put('accounts/:id')
  @RequirePermissions(PERMISSIONS.COURIERS_MANAGE)
  async updateAccount(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCourierAccountSchema)) input: UpdateCourierAccountInput
  ) {
    return this.couriersService.updateAccount(req.tenantId, id, input);
  }

  @Post('accounts/:id/test')
  @RequirePermissions(PERMISSIONS.COURIERS_MANAGE)
  async testConnection(@Req() req: any, @Param('id') id: string) {
    return this.couriersService.testConnection(req.tenantId, id);
  }

  @Get('accounts/:id/balance')
  @RequirePermissions(PERMISSIONS.COURIERS_VIEW)
  async getBalance(@Req() req: any, @Param('id') id: string) {
    return this.couriersService.getBalance(req.tenantId, id);
  }

  // ==========================================
  // DISPATCH & SHIPMENTS
  // ==========================================

  @Post('shipments/dispatch')
  @RequirePermissions(PERMISSIONS.SHIPMENTS_CREATE)
  async dispatchShipment(
    @Req() req: any,
    @Body(new ZodValidationPipe(sendToCourierSchema)) input: SendToCourierInput
  ) {
    return this.couriersService.sendOrderToCourier(req.tenantId, req.user?.id, input);
  }

  @Get('shipments')
  @RequirePermissions(PERMISSIONS.SHIPMENTS_VIEW)
  async getShipments(@Req() req: any, @Query('orderId') orderId?: string) {
    return this.couriersService.getShipments(req.tenantId, orderId);
  }

  @Get('shipments/:id/track')
  @RequirePermissions(PERMISSIONS.SHIPMENTS_VIEW)
  async trackShipment(@Req() req: any, @Param('id') id: string) {
    return this.couriersService.trackShipment(req.tenantId, id);
  }

  @Get('shipments/:id/events')
  @RequirePermissions(PERMISSIONS.SHIPMENTS_VIEW)
  async getShipmentEvents(@Req() req: any, @Param('id') id: string) {
    return this.couriersService.getShipmentEvents(req.tenantId, id);
  }

  @Post('shipments/:id/reconcile')
  @RequirePermissions(PERMISSIONS.SHIPMENTS_CREATE)
  async reconcileShipment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ReconcileShipmentInput
  ) {
    return this.couriersService.reconcileShipment(req.tenantId, req.user?.id, id, body);
  }

  // ==========================================
  // FRAUD CHECK (GATE 3)
  // ==========================================

  @Get('fraud-check')
  @RequirePermissions(PERMISSIONS.RISK_VIEW)
  async checkCustomerRisk(@Req() req: any, @Query('phone') phone: string) {
    return this.couriersService.checkCustomerRisk(req.tenantId, phone);
  }

  // ==========================================
  // COD SETTLEMENTS
  // ==========================================

  @Get('settlements')
  @RequirePermissions(PERMISSIONS.SETTLEMENTS_VIEW)
  async listSettlements(@Req() req: any) {
    return this.couriersService.listSettlements(req.tenantId);
  }

  @Get('settlements/:id')
  @RequirePermissions(PERMISSIONS.SETTLEMENTS_VIEW)
  async getSettlement(@Req() req: any, @Param('id') id: string) {
    return this.couriersService.getSettlement(req.tenantId, id);
  }

  @Post('settlements')
  @RequirePermissions(PERMISSIONS.SETTLEMENTS_MANAGE)
  async createSettlement(
    @Req() req: any,
    @Body(new ZodValidationPipe(createSettlementSchema)) input: CreateSettlementInput
  ) {
    return this.couriersService.createSettlement(req.tenantId, req.user?.id, input);
  }
}
