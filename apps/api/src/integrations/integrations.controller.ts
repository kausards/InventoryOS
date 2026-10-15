import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import { IntegrationsService } from './integrations.service';
import type {
  ConnectStoreInput,
  UpdateStoreInput,
  MapProductVariantInput,
  PushStockInput,
} from '@growthomic/shared';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('stores')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async listStores(@Req() req: any) {
    return this.integrationsService.listStores(req.user.tenantId);
  }

  @Post('stores')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async connectStore(@Req() req: any, @Body() dto: ConnectStoreInput) {
    return this.integrationsService.connectStore(req.user.tenantId, req.user.userId, dto);
  }

  @Get('stores/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async getStore(@Req() req: any, @Param('id') storeId: string) {
    return this.integrationsService.getStore(req.user.tenantId, storeId);
  }

  @Patch('stores/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async updateStore(
    @Req() req: any,
    @Param('id') storeId: string,
    @Body() dto: UpdateStoreInput
  ) {
    return this.integrationsService.updateStore(req.user.tenantId, storeId, dto);
  }

  @Post('stores/:id/test')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async testStoreConnection(@Req() req: any, @Param('id') storeId: string) {
    return this.integrationsService.testStoreConnection(req.user.tenantId, storeId);
  }

  @Post('stores/:id/disconnect')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async disconnectStore(@Req() req: any, @Param('id') storeId: string) {
    return this.integrationsService.disconnectStore(req.user.tenantId, storeId, req.user.userId);
  }

  @Post('stores/:id/sync-products')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async syncProducts(@Req() req: any, @Param('id') storeId: string) {
    return this.integrationsService.syncProducts(req.user.tenantId, storeId);
  }

  @Get('stores/:id/mappings')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async listProductMappings(
    @Req() req: any,
    @Param('id') storeId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.integrationsService.listProductMappings(req.user.tenantId, storeId, {
      ...(status ? { status } : {}),
      ...(search ? { search } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }

  @Put('stores/:id/mappings/:mappingId')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async mapProductVariant(
    @Req() req: any,
    @Param('mappingId') mappingId: string,
    @Body() dto: MapProductVariantInput
  ) {
    return this.integrationsService.mapProductVariant(req.user.tenantId, mappingId, dto);
  }

  @Post('stores/:id/reconcile')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async reconcileOrders(
    @Req() req: any,
    @Param('id') storeId: string,
    @Query('days') days?: number,
    @Query('force') force?: string
  ) {
    return this.integrationsService.reconcileOrders(
      req.user.tenantId,
      storeId,
      days ? Number(days) : 7,
      force === 'true'
    );
  }

  @Post('stores/:id/push-stock')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async pushStock(
    @Req() req: any,
    @Param('id') storeId: string,
    @Body() dto: { variantId: string; quantity: number }
  ) {
    return this.integrationsService.pushStockToStore(
      req.user.tenantId,
      storeId,
      dto.variantId,
      dto.quantity
    );
  }

  @Get('stores/:id/events')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_INTEGRATIONS)
  async listEvents(
    @Req() req: any,
    @Param('id') storeId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.integrationsService.listEvents(req.user.tenantId, storeId, {
      ...(status ? { status } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }

  /**
   * Public Webhook Ingestion endpoint for WooCommerce webhooks.
   * Authenticates using x-wc-webhook-signature HMAC-SHA256 header.
   */
  @Post('webhook/:storeId')
  async handleWebhook(
    @Param('storeId') storeId: string,
    @Headers('x-wc-webhook-signature') signature: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Body() body: any
  ) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    const eventTopic = topic || body?.action || 'woocommerce.order.created';

    return this.integrationsService.handleWebhook(
      storeId,
      rawBody,
      signature,
      eventTopic,
      typeof body === 'string' ? JSON.parse(body) : body
    );
  }
}
