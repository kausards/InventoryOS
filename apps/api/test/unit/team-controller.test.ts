import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamController } from '../../src/team/team.controller';
import { TeamService } from '../../src/team/team.service';

describe('TeamController', () => {
  let controller: TeamController;
  let service: TeamService;

  beforeEach(() => {
    service = {
      listMembers: vi.fn(),
      inviteMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
    } as unknown as TeamService;

    controller = new TeamController(service);
  });

  it('listMembers calls service with tenantId', async () => {
    const req = { tenantId: 't-1' };
    const members = [{ membershipId: 'm-1', email: 'user@example.com', roleName: 'Admin' }];
    vi.mocked(service.listMembers).mockResolvedValue(members as any);

    const result = await controller.listMembers(req);
    expect(service.listMembers).toHaveBeenCalledWith('t-1');
    expect(result).toEqual(members);
  });

  it('inviteMember forwards payload with requestId', async () => {
    const req = { tenantId: 't-1', user: { id: 'u-1' }, headers: { 'x-request-id': 'req-99' } };
    const dto = { email: 'new@example.com', fullName: 'New Member', roleId: 'r-staff' };
    const created = { membershipId: 'm-2', email: dto.email };
    vi.mocked(service.inviteMember).mockResolvedValue(created as any);

    const result = await controller.inviteMember(dto, req);
    expect(service.inviteMember).toHaveBeenCalledWith('t-1', 'u-1', dto, 'req-99');
    expect(result).toEqual(created);
  });

  it('updateMemberRole forwards payload', async () => {
    const req = { tenantId: 't-1', user: { id: 'u-1' }, headers: {} };
    const dto = { roleId: 'r-admin' };
    vi.mocked(service.updateMemberRole).mockResolvedValue({ membershipId: 'm-1', roleId: 'r-admin', roleName: 'Admin' });

    const result = await controller.updateMemberRole('m-1', dto, req);
    expect(service.updateMemberRole).toHaveBeenCalledWith('t-1', 'u-1', 'm-1', dto, undefined);
    expect(result.roleName).toBe('Admin');
  });

  it('removeMember forwards call', async () => {
    const req = { tenantId: 't-1', user: { id: 'u-1' }, headers: {} };
    vi.mocked(service.removeMember).mockResolvedValue({ success: true });

    const result = await controller.removeMember('m-1', req);
    expect(service.removeMember).toHaveBeenCalledWith('t-1', 'u-1', 'm-1', undefined);
    expect(result).toEqual({ success: true });
  });
});
