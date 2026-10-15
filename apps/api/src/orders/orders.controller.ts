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
import { OrdersService } from './orders.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import {
  createOrderSchema,
  transitionOrderStatusSchema,
  cancelOrderSchema,
  holdOrderSchema,
  bulkOrderActionSchema,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('orders')
@UseGuards(AuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  async listOrders(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const options: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      source?: string;
      customerId?: string;
      startDate?: string;
      endDate?: string;
    } = {};
    if (page) options.page = Number(page);
    if (limit) options.limit = Number(limit);
    if (search) options.search = search;
    if (status) options.status = status;
    if (source) options.source = source;
    if (customerId) options.customerId = customerId;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    return this.ordersService.listOrders(req.tenantId, options);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  async getOrderSummary(@Req() req: any) {
    return this.ordersService.getOrderSummary(req.tenantId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  async getOrder(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.getOrderById(req.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORDERS_CREATE)
  async createOrder(
    @Req() req: any,
    @Body(new ZodValidationPipe(createOrderSchema)) body: any
  ) {
    return this.ordersService.createOrder(
      req.tenantId,
      req.user.id,
      body,
      req.headers['x-request-id']
    );
  }

  @Post(':id/transition')
  @RequirePermissions(PERMISSIONS.ORDERS_EDIT)
  async transitionStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(transitionOrderStatusSchema)) body: any
  ) {
    return this.ordersService.transitionStatus(
      req.tenantId,
      req.user.id,
      id,
      body,
      req.headers['x-request-id']
    );
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.ORDERS_CANCEL)
  async cancelOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelOrderSchema)) body: any
  ) {
    return this.ordersService.cancelOrder(
      req.tenantId,
      req.user.id,
      id,
      body,
      req.headers['x-request-id']
    );
  }

  @Post(':id/hold')
  @RequirePermissions(PERMISSIONS.ORDERS_HOLD)
  async holdOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(holdOrderSchema)) body: any
  ) {
    return this.ordersService.holdOrder(
      req.tenantId,
      req.user.id,
      id,
      body,
      req.headers['x-request-id']
    );
  }

  @Post('bulk')
  @RequirePermissions(PERMISSIONS.ORDERS_BULK_ACTION)
  async bulkActions(
    @Req() req: any,
    @Body(new ZodValidationPipe(bulkOrderActionSchema)) body: any
  ) {
    return this.ordersService.bulkActions(
      req.tenantId,
      req.user.id,
      body,
      req.headers['x-request-id']
    );
  }
}
