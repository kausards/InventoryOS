import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import {
  stockAdjustmentSchema,
  stockReservationSchema,
  stockReleaseSchema,
} from '@growthomic/shared';

@Controller('inventory')
@UseGuards(AuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  async getStock(@Req() req: any, @Query('warehouseId') warehouseId?: string) {
    return this.inventoryService.getWarehouseStock(req.tenantId, warehouseId);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  async getSummary(@Req() req: any) {
    return this.inventoryService.getInventorySummary(req.tenantId);
  }

  @Get('low-stock')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  async getLowStock(@Req() req: any) {
    return this.inventoryService.getLowStockItems(req.tenantId);
  }

  @Get('ledger')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  async getLedger(@Req() req: any, @Query() query: any) {
    return this.inventoryService.getStockMovements(req.tenantId, {
      variantId: query.variantId,
      warehouseId: query.warehouseId,
      type: query.type,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 25,
    });
  }

  @Post('adjust')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  async adjustStock(@Req() req: any, @Body() body: any) {
    const validated = stockAdjustmentSchema.parse(body);
    const requestId = req.headers['x-request-id'];
    return this.inventoryService.adjustStock(req.tenantId, req.user.id, validated, requestId);
  }

  @Post('reserve')
  @RequirePermissions(PERMISSIONS.ORDERS_CREATE)
  async reserveStock(@Req() req: any, @Body() body: any) {
    const validated = stockReservationSchema.parse(body);
    const requestId = req.headers['x-request-id'];
    return this.inventoryService.reserveStock(req.tenantId, req.user.id, validated, requestId);
  }

  @Post('release')
  @RequirePermissions(PERMISSIONS.ORDERS_EDIT)
  async releaseStock(@Req() req: any, @Body() body: any) {
    const validated = stockReleaseSchema.parse(body);
    const requestId = req.headers['x-request-id'];
    return this.inventoryService.releaseReservation(req.tenantId, req.user.id, validated, requestId);
  }

  @Get('reconcile/:warehouseId/:variantId')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  async reconcile(
    @Req() req: any,
    @Param('warehouseId') warehouseId: string,
    @Param('variantId') variantId: string
  ) {
    return this.inventoryService.reconcileLedger(req.tenantId, warehouseId, variantId);
  }
}
