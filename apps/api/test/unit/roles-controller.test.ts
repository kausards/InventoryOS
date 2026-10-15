import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RolesController } from '../../src/roles/roles.controller';
import { RolesService } from '../../src/roles/roles.service';

describe('RolesController', () => {
  let controller: RolesController;
  let service: RolesService;

  beforeEach(() => {
    service = {
      listRoles: vi.fn(),
      createCustomRole: vi.fn(),
      updateCustomRole: vi.fn(),
      deleteCustomRole: vi.fn(),
    } as unknown as RolesService;

    controller = new RolesController(service);
  });

  it('listRoles returns roles for the active tenant', async () => {
    const req = { tenantId: 't-1' };
    const mockRoles = [
      { id: 'r-1', name: 'Owner', isSystem: true, permissions: ['orders.view'] },
      { id: 'r-2', name: 'Support Lead', isSystem: false, permissions: ['orders.view'] },
    ];
    vi.mocked(service.listRoles).mockResolvedValue(mockRoles as any);

    const result = await controller.listRoles(req);
    expect(service.listRoles).toHaveBeenCalledWith('t-1');
    expect(result).toHaveLength(2);
  });

  it('createCustomRole forwards to service', async () => {
    const req = { tenantId: 't-1', user: { id: 'u-1' }, headers: { 'x-request-id': 'req-1' } };
    const dto = { name: 'Support Lead', permissionKeys: ['orders.view'] };

    const expected = { id: 'r-new', name: 'Support Lead', isSystem: false, permissions: ['orders.view'] };
    vi.mocked(service.createCustomRole).mockResolvedValue(expected as any);

    const result = await controller.createCustomRole(dto, req);
    expect(service.createCustomRole).toHaveBeenCalledWith('t-1', 'u-1', dto, 'req-1');
    expect(result).toEqual(expected);
  });
});
