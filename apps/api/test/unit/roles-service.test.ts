import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesService } from '../../src/roles/roles.service';
import * as dbModule from '@growthomic/db';

describe('RolesService - Custom Roles & Tenant Isolation', () => {
  let service: RolesService;

  beforeEach(() => {
    service = new RolesService();
    vi.restoreAllMocks();
  });

  it('createCustomRole rejects if role name collides with existing system or tenant role', async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // Collision check returns existing role
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'existing-role', name: 'Admin', isSystem: true }]),
    });

    await expect(
      service.createCustomRole('t-1', 'actor-1', {
        name: 'Admin',
        permissionKeys: ['orders.view'],
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('createCustomRole successfully creates custom role with permissions and audit log', async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Collision check returns empty
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    // 2. Insert custom role
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          { id: 'custom-role-1', name: 'Custom Dispatcher', tenantId: 't-1', isSystem: false },
        ]),
      }),
    });

    // 3. Insert role_permissions
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    // 4. Insert audit_log
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    const res = await service.createCustomRole('t-1', 'actor-1', {
      name: 'Custom Dispatcher',
      permissionKeys: ['orders.view', 'orders.update'],
    });

    expect(res.name).toBe('Custom Dispatcher');
    expect(res.permissions).toEqual(['orders.view', 'orders.update']);
    expect(res.tenantId).toBe('t-1');
  });

  it('updateCustomRole forbids editing system roles', async () => {
    const mockTx = {
      select: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 'sys-role-1', name: 'Owner', isSystem: true, tenantId: null },
      ]),
    });

    await expect(
      service.updateCustomRole('t-1', 'sys-role-1', 'actor-1', {
        name: 'Super Owner',
        permissionKeys: ['orders.view'],
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateCustomRole forbids editing another tenant custom role (cross-tenant isolation)', async () => {
    const mockTx = {
      select: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // Role belongs to tenant 't-2', while requester is 't-1'
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 'role-t2', name: 'Tenant 2 Lead', isSystem: false, tenantId: 't-2' },
      ]),
    });

    await expect(
      service.updateCustomRole('t-1', 'role-t2', 'actor-1', {
        name: 'Hacked Role',
        permissionKeys: ['orders.view'],
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it('deleteCustomRole throws BadRequestException if active members are currently assigned', async () => {
    const mockTx = {
      select: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Existing role
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 'custom-role-1', name: 'Custom Manager', isSystem: false, tenantId: 't-1' },
      ]),
    });

    // 2. Members check has active assigned member
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'mem-1' }]),
    });

    await expect(
      service.deleteCustomRole('t-1', 'custom-role-1', 'actor-1')
    ).rejects.toThrow(BadRequestException);
  });

  it('deleteCustomRole succeeds when no members are assigned', async () => {
    const mockTx = {
      select: vi.fn(),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      }),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Role lookup
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 'custom-role-1', name: 'Custom Manager', isSystem: false, tenantId: 't-1' },
      ]),
    });

    // 2. Members check: empty
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    const result = await service.deleteCustomRole('t-1', 'custom-role-1', 'actor-1');
    expect(result).toEqual({ success: true });
    expect(mockTx.delete).toHaveBeenCalledTimes(2); // deletes rolePermissions and role
  });
});
