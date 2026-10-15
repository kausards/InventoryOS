import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException('Authentication token cannot be empty');
    }

    const verified = await this.authService.verifySupabaseToken(token);
    const tenantHeader = request.headers['x-tenant-id'] as string | undefined;

    const me = await this.authService.getMe(verified.id, tenantHeader);

    request.user = me.user;
    request.tenantId = me.activeTenant?.id ?? null;
    request.activeTenant = me.activeTenant;
    request.role = me.role;
    request.permissions = me.permissions;
    request.memberships = me.memberships;

    return true;
  }
}
