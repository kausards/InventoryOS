import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from '../../src/common/guards/permissions.guard';
import { PERMISSIONS } from '@growthomic/shared';

describe('PermissionsGuard', () => {
  it('allows access if no permissions are required', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ permissions: [] }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access if user has all required permissions', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_CREATE]),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          permissions: [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_CREATE, PERMISSIONS.CUSTOMERS_VIEW],
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException if user is missing a permission', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([PERMISSIONS.SETTINGS_BILLING]),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          permissions: [PERMISSIONS.ORDERS_VIEW],
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
