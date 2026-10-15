import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, UsePipes } from '@nestjs/common';
import { RolesService } from './roles.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PERMISSIONS, createRoleSchema, updateRoleSchema, type CreateRoleInput, type UpdateRoleInput } from '@growthomic/shared';

@Controller('roles')
@UseGuards(AuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async listRoles(@Req() req: any) {
    return this.rolesService.listRoles(req.tenantId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TEAM_CHANGE_ROLE)
  @UsePipes(new ZodValidationPipe(createRoleSchema))
  async createCustomRole(@Body() dto: CreateRoleInput, @Req() req: any) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.rolesService.createCustomRole(req.tenantId, req.user.id, dto, requestId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TEAM_CHANGE_ROLE)
  @UsePipes(new ZodValidationPipe(updateRoleSchema))
  async updateCustomRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleInput,
    @Req() req: any
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.rolesService.updateCustomRole(req.tenantId, id, req.user.id, dto, requestId);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TEAM_CHANGE_ROLE)
  async deleteCustomRole(@Param('id') id: string, @Req() req: any) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.rolesService.deleteCustomRole(req.tenantId, id, req.user.id, requestId);
  }
}
