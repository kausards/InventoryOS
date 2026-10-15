import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeamService } from '../../src/team/team.service';
import * as dbModule from '@growthomic/db';

describe('TeamService - Last-Owner & Staff Protection', () => {
  let service: TeamService;

  beforeEach(() => {
    service = new TeamService();
    vi.restoreAllMocks();
  });

  it('throws BadRequestException when attempting to demote the sole remaining Owner', async () => {
    const mockTx = {
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      insert: vi.fn(),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Fetch current membership: user is currently 'Owner'
    const membershipSelectMock = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          membership: { id: 'm-1', tenantId: 't-1', roleId: 'role-owner', status: 'active' },
          roleName: 'Owner',
        },
      ]),
    };

    // 2. Target role: Admin (not Owner)
    const targetRoleSelectMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 'role-admin', name: 'Admin', isSystem: true },
      ]),
    };

    // 3. Count active owners: returns ownerRole then count = 1
    const ownerRoleLookupMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'role-owner' }]),
    };

    const countMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    };

    mockTx.select
      .mockReturnValueOnce(membershipSelectMock)
      .mockReturnValueOnce(targetRoleSelectMock)
      .mockReturnValueOnce(ownerRoleLookupMock)
      .mockReturnValueOnce(countMock);

    await expect(
      service.updateMemberRole('t-1', 'actor-1', 'm-1', { roleId: 'role-admin' })
    ).rejects.toThrow(BadRequestException);
  });

  it('allows demoting an Owner if there is more than 1 active Owner', async () => {
    const mockTx = {
      select: vi.fn(),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      }),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const membershipSelectMock = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          membership: { id: 'm-1', tenantId: 't-1', roleId: 'role-owner', status: 'active' },
          roleName: 'Owner',
        },
      ]),
    };

    const targetRoleSelectMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 'role-admin', name: 'Admin', isSystem: true },
      ]),
    };

    const ownerRoleLookupMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'role-owner' }]),
    };

    const countMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 2 }]), // 2 owners present!
    };

    mockTx.select
      .mockReturnValueOnce(membershipSelectMock)
      .mockReturnValueOnce(targetRoleSelectMock)
      .mockReturnValueOnce(ownerRoleLookupMock)
      .mockReturnValueOnce(countMock);

    const result = await service.updateMemberRole('t-1', 'actor-1', 'm-1', { roleId: 'role-admin' });
    expect(result.roleName).toBe('Admin');
    expect(mockTx.update).toHaveBeenCalled();
  });

  it('throws BadRequestException when attempting to remove the last remaining Owner', async () => {
    const mockTx = {
      select: vi.fn(),
      delete: vi.fn(),
      insert: vi.fn(),
    };

    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    const membershipSelectMock = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          membership: { id: 'm-1', tenantId: 't-1', roleId: 'role-owner', status: 'active' },
          roleName: 'Owner',
        },
      ]),
    };

    const ownerRoleLookupMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'role-owner' }]),
    };

    const countMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]), // Only 1 owner
    };

    mockTx.select
      .mockReturnValueOnce(membershipSelectMock)
      .mockReturnValueOnce(ownerRoleLookupMock)
      .mockReturnValueOnce(countMock);

    await expect(
      service.removeMember('t-1', 'actor-1', 'm-1')
    ).rejects.toThrow(BadRequestException);
  });

  it('allows removing an Owner when multiple active Owners exist', async () => {
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

    const membershipSelectMock = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          membership: { id: 'm-1', tenantId: 't-1', roleId: 'role-owner', status: 'active' },
          roleName: 'Owner',
        },
      ]),
    };

    const ownerRoleLookupMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'role-owner' }]),
    };

    const countMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 2 }]),
    };

    mockTx.select
      .mockReturnValueOnce(membershipSelectMock)
      .mockReturnValueOnce(ownerRoleLookupMock)
      .mockReturnValueOnce(countMock);

    const result = await service.removeMember('t-1', 'actor-1', 'm-1');
    expect(result).toEqual({ success: true });
    expect(mockTx.delete).toHaveBeenCalled();
  });

  it('inviteMember rejects if target role does not exist', async () => {
    const mockTx = {
      select: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    await expect(
      service.inviteMember('t-1', 'actor-1', {
        email: 'staff@example.com',
        fullName: 'Staff Name',
        roleId: 'non-existent',
      })
    ).rejects.toThrow(NotFoundException);
  });

  it('inviteMember rejects if user already belongs to the organization', async () => {
    const mockTx = {
      select: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Role exists
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'role-1', name: 'Order Staff' }]),
    });

    // 2. User exists
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'u-1', email: 'existing@example.com' }]),
    });

    // 3. Existing membership found!
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'mem-1' }]),
    });

    await expect(
      service.inviteMember('t-1', 'actor-1', {
        email: 'existing@example.com',
        fullName: 'Existing Staff',
        roleId: 'role-1',
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('inviteMember successfully creates membership and audit log', async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Role exists
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'role-1', name: 'Order Staff' }]),
    });

    // 2. User exists
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'u-2', email: 'new@example.com', fullName: 'New Staff' }]),
    });

    // 3. No existing membership
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    // 4. Insert membership
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          { id: 'mem-2', status: 'active' },
        ]),
      }),
    });

    // 5. Insert audit log
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    const res = await service.inviteMember('t-1', 'actor-1', {
      email: 'new@example.com',
      fullName: 'New Staff',
      roleId: 'role-1',
    });

    expect(res.membershipId).toBe('mem-2');
    expect(res.email).toBe('new@example.com');
    expect(res.roleName).toBe('Order Staff');
  });
});
