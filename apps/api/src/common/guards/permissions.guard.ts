import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userPermissions: string[] = request.permissions || [];

    const hasAll = requiredPermissions.every((perm) => userPermissions.includes(perm));
    if (!hasAll) {
      const missing = requiredPermissions.filter((perm) => !userPermissions.includes(perm));
      throw new ForbiddenException(`Insufficient permissions: missing [${missing.join(', ')}]`);
    }

    return true;
  }
}
