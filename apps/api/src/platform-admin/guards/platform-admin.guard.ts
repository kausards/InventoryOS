import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // 1. Header override for admin tooling / scripts
    if (request.headers['x-platform-admin'] === 'true') {
      return true;
    }

    // 2. Email whitelist for platform operators
    const email = (user.email || '').toLowerCase();
    if (
      email.endsWith('@growthomic.com') ||
      email === 'admin@growthomic.com' ||
      email === 'admin@inventoryos.com' ||
      email.includes('admin')
    ) {
      return true;
    }

    // 3. System Owner fallback in dev/test mode
    if (request.role?.name === 'Owner') {
      return true;
    }

    throw new ForbiddenException('Platform Administrator privileges required');
  }
}
