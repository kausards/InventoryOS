import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import * as dbModule from '@growthomic/db';

describe('AuthService - Tenant Onboarding & Context Resolution', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.restoreAllMocks();
  });

  it('verifySupabaseToken handles deterministic test tokens', async () => {
    const res = await service.verifySupabaseToken('test-token:u-123:test@example.com');
    expect(res).toEqual({
      id: 'u-123',
      email: 'test@example.com',
    });
  });

  it('signup creates tenant with unique slug, assigns Owner role, and creates audit log', async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. User check: user does not exist yet
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    // User insert
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    // 2. Slug check: no existing tenant with this slug
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    // 3. Insert tenant
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 't-new-1',
            name: 'Gadget Express BD',
            slug: 'gadget-express-bd',
            timezone: 'Asia/Dhaka',
            currency: 'BDT',
            status: 'active',
          },
        ]),
      }),
    });

    // 4. Find system Owner role
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'role-owner', name: 'Owner', isSystem: true }]),
    });

    // 5. Insert membership
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    // 6. Insert audit log
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    // 7. Starter plan check
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'plan-starter', slug: 'starter' }]),
    });

    // 8. Insert trial subscription
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'sub-trial-1' }]),
      }),
    });

    // 9. Insert initial usage
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    const result = await service.signup({
      userId: 'u-1',
      email: 'owner@gadgetexpress.com',
      fullName: 'Tahmid Hasan',
      organizationName: 'Gadget Express BD',
    });

    expect(result.tenant.id).toBe('t-new-1');
    expect(result.tenant.slug).toBe('gadget-express-bd');
    expect(result.role).toBe('Owner');
    expect(mockTx.insert).toHaveBeenCalledTimes(6); // user, tenant, membership, auditLog, subscription, usage
  });

  it('getMe resolves user, active tenant and active role permissions', async () => {
    const mockTx = {
      select: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Fetch user
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 'u-1', email: 'owner@example.com', fullName: 'Owner User' },
      ]),
    });

    // 2. Fetch memberships
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          id: 'mem-1',
          tenantId: 't-1',
          roleId: 'role-admin',
          status: 'active',
          tenantName: 'Store 1',
          tenantSlug: 'store-1',
          roleName: 'Admin',
          isSystemRole: true,
        },
      ]),
    });

    // 3. Fetch role permissions
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { key: 'orders.view' },
        { key: 'orders.create' },
        { key: 'inventory.view' },
      ]),
    });

    const me = await service.getMe('u-1', 't-1');
    expect(me.user.email).toBe('owner@example.com');
    expect(me.activeTenant?.id).toBe('t-1');
    expect(me.role?.name).toBe('Admin');
    expect(me.permissions).toEqual(['orders.view', 'orders.create', 'inventory.view']);
  });
});
