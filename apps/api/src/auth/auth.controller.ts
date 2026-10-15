import { Controller, Post, Get, Body, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { signupSchema, switchTenantSchema, type SignupInput, type SwitchTenantInput } from '@growthomic/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UsePipes(new ZodValidationPipe(signupSchema))
  async signup(@Body() dto: SignupInput, @Req() req: any) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.authService.signup(dto, requestId);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: any) {
    return {
      user: req.user,
      activeTenant: req.activeTenant,
      role: req.role,
      permissions: req.permissions,
      memberships: req.memberships,
    };
  }

  @Post('switch-tenant')
  @UseGuards(AuthGuard)
  @UsePipes(new ZodValidationPipe(switchTenantSchema))
  async switchTenant(@Body() dto: SwitchTenantInput, @Req() req: any) {
    return this.authService.switchTenant(req.user.id, dto.tenantId);
  }
}
