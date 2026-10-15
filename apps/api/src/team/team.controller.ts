import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, UsePipes } from '@nestjs/common';
import { TeamService } from './team.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  PERMISSIONS,
  inviteMemberSchema,
  updateMemberRoleSchema,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from '@growthomic/shared';

@Controller('team')
@UseGuards(AuthGuard, PermissionsGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TEAM_VIEW)
  async listMembers(@Req() req: any) {
    return this.teamService.listMembers(req.tenantId);
  }

  @Post('invite')
  @RequirePermissions(PERMISSIONS.TEAM_INVITE)
  @UsePipes(new ZodValidationPipe(inviteMemberSchema))
  async inviteMember(@Body() dto: InviteMemberInput, @Req() req: any) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.teamService.inviteMember(req.tenantId, req.user.id, dto, requestId);
  }

  @Patch(':id/role')
  @RequirePermissions(PERMISSIONS.TEAM_CHANGE_ROLE)
  @UsePipes(new ZodValidationPipe(updateMemberRoleSchema))
  async updateMemberRole(
    @Param('id') id: string,
    @Body() dto: UpdateMemberRoleInput,
    @Req() req: any
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.teamService.updateMemberRole(req.tenantId, req.user.id, id, dto, requestId);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TEAM_REMOVE)
  async removeMember(@Param('id') id: string, @Req() req: any) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.teamService.removeMember(req.tenantId, req.user.id, id, requestId);
  }
}
