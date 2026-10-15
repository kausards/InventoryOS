import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(() => {
    authService = {
      signup: vi.fn(),
      getMe: vi.fn(),
      switchTenant: vi.fn(),
    } as unknown as AuthService;

    controller = new AuthController(authService);
  });

  it('signup calls authService.signup with dto and requestId', async () => {
    const dto = {
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'owner@example.com',
      fullName: 'Store Owner',
      organizationName: 'Fashion Hub',
      timezone: 'Asia/Dhaka',
      currency: 'BDT',
    };
    const req = { headers: { 'x-request-id': 'req-abc' } };

    const expected = {
      tenant: { id: 't-1', name: 'Fashion Hub', slug: 'fashion-hub' },
      user: { id: dto.userId, email: dto.email, fullName: dto.fullName },
      role: 'Owner',
    };
    vi.mocked(authService.signup).mockResolvedValue(expected as any);

    const result = await controller.signup(dto, req);
    expect(authService.signup).toHaveBeenCalledWith(dto, 'req-abc');
    expect(result).toEqual(expected);
  });

  it('getMe extracts context from authenticated request', async () => {
    const req = {
      user: { id: 'u-1', email: 'u@example.com' },
      activeTenant: { id: 't-1', name: 'Fashion Hub' },
      role: { id: 'r-1', name: 'Owner', isSystem: true },
      permissions: ['orders.view', 'settings.view'],
      memberships: [{ tenantId: 't-1', tenantName: 'Fashion Hub', roleName: 'Owner' }],
    };

    const result = await controller.getMe(req);
    expect(result.user).toEqual(req.user);
    expect(result.activeTenant).toEqual(req.activeTenant);
    expect(result.permissions).toContain('orders.view');
  });

  it('switchTenant calls authService.switchTenant', async () => {
    const req = { user: { id: 'u-1' } };
    const dto = { tenantId: '22222222-2222-2222-2222-222222222222' };

    const expected = {
      user: { id: 'u-1' },
      activeTenant: { id: dto.tenantId },
    };
    vi.mocked(authService.switchTenant).mockResolvedValue(expected as any);

    const result = await controller.switchTenant(dto, req);
    expect(authService.switchTenant).toHaveBeenCalledWith('u-1', dto.tenantId);
    expect(result).toEqual(expected);
  });
});
