import { Controller, Get, Patch, Body, Req, UseGuards, UsePipes } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PERMISSIONS, updateTenantSchema, type UpdateTenantInput } from '@growthomic/shared';

@Controller('tenants')
@UseGuards(AuthGuard, PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async getCurrentTenant(@Req() req: any) {
    return this.tenantsService.getCurrentTenant(req.tenantId);
  }

  @Patch('current')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  @UsePipes(new ZodValidationPipe(updateTenantSchema))
  async updateSettings(@Body() dto: UpdateTenantInput, @Req() req: any) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.tenantsService.updateSettings(req.tenantId, req.user.id, dto, requestId);
  }
}
