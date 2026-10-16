import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createCustomerTagSchema,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('customers')
@UseGuards(AuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_VIEW)
  async listCustomers(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('tagId') tagId?: string
  ) {
    const options: { page?: number; limit?: number; search?: string; tagId?: string } = {};
    if (page) options.page = Number(page);
    if (limit) options.limit = Number(limit);
    if (search) options.search = search;
    if (tagId) options.tagId = tagId;
    return this.customersService.listCustomers(req.tenantId, options);
  }

  @Get('lookup')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_VIEW)
  async lookupByPhone(@Req() req: any, @Query('phone') phone: string) {
    return this.customersService.lookupCustomerByPhone(req.tenantId, phone || '');
  }

  @Get('tags')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_VIEW)
  async listTags(@Req() req: any) {
    return this.customersService.listTags(req.tenantId);
  }

  @Post('tags')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_EDIT)
  async createTag(
    @Req() req: any,
    @Body(new ZodValidationPipe(createCustomerTagSchema)) body: any
  ) {
    return this.customersService.createTag(req.tenantId, body);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_VIEW)
  async getCustomer(@Req() req: any, @Param('id') id: string) {
    return this.customersService.getCustomerById(req.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_CREATE)
  async createCustomer(
    @Req() req: any,
    @Body(new ZodValidationPipe(createCustomerSchema)) body: any
  ) {
    return this.customersService.createCustomer(
      req.tenantId,
      req.user.id,
      body,
      req.headers['x-request-id']
    );
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_EDIT)
  async updateCustomer(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: any
  ) {
    return this.customersService.updateCustomer(
      req.tenantId,
      req.user.id,
      id,
      body,
      req.headers['x-request-id']
    );
  }

  @Post(':id/tags/:tagId')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_EDIT)
  async assignTag(
    @Req() req: any,
    @Param('id') customerId: string,
    @Param('tagId') tagId: string
  ) {
    return this.customersService.assignTag(req.tenantId, customerId, tagId);
  }

  @Delete(':id/tags/:tagId')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_EDIT)
  async removeTag(
    @Req() req: any,
    @Param('id') customerId: string,
    @Param('tagId') tagId: string
  ) {
    return this.customersService.removeTag(req.tenantId, customerId, tagId);
  }

  @Post(':id/anonymize')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_EDIT)
  async anonymizeCustomer(@Req() req: any, @Param('id') id: string) {
    return this.customersService.anonymizeCustomer(
      req.tenantId,
      id,
      req.user.id,
      req.headers['x-request-id']
    );
  }
}
