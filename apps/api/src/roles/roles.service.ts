import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, or, isNull } from 'drizzle-orm';
import { withSystem, roles, rolePermissions, tenantMemberships, auditLogs } from '@growthomic/db';
import type { CreateRoleInput, UpdateRoleInput } from '@growthomic/shared';

@Injectable()
export class RolesService {
  async listRoles(tenantId: string) {
    return withSystem(async (tx) => {
      // 1. Fetch system roles + tenant custom roles
      const allRoles = await tx
        .select()
        .from(roles)
        .where(
          or(
            and(eq(roles.isSystem, true), isNull(roles.tenantId)),
            eq(roles.tenantId, tenantId)
          )
        );

      // 2. Fetch all role permissions for these roles
      const roleIds = allRoles.map((r) => r.id);
      const allPerms = roleIds.length > 0
        ? await tx
            .select()
            .from(rolePermissions)
        : [];

      // 3. Map permissions to each role
      return allRoles.map((role) => {
        const perms = allPerms
          .filter((p) => p.roleId === role.id)
          .map((p) => p.permissionKey);

        return {
          id: role.id,
          name: role.name,
          isSystem: role.isSystem,
          tenantId: role.tenantId,
          permissions: perms,
        };
      });
    });
  }

  async createCustomRole(
    tenantId: string,
    actorId: string,
    dto: CreateRoleInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      // 1. Check for name collision in this tenant or with system roles
      const existing = await tx
        .select()
        .from(roles)
        .where(
          or(
            and(eq(roles.name, dto.name), eq(roles.tenantId, tenantId)),
            and(eq(roles.name, dto.name), eq(roles.isSystem, true))
          )
        )
        .limit(1);

      if (existing[0]) {
        throw new BadRequestException(`Role with name "${dto.name}" already exists`);
      }

      // 2. Insert custom role
      const inserted = await tx
        .insert(roles)
        .values({
          tenantId,
          name: dto.name,
          isSystem: false,
        })
        .returning();

      const newRole = inserted[0];
      if (!newRole) {
        throw new BadRequestException('Failed to create custom role');
      }

      // 3. Insert permissions
      if (dto.permissionKeys.length > 0) {
        await tx.insert(rolePermissions).values(
          dto.permissionKeys.map((key) => ({
            roleId: newRole.id,
            permissionKey: key,
          }))
        );
      }

      // 4. Audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'role.create',
        entityType: 'role',
        entityId: newRole.id,
        after: { name: newRole.name, permissions: dto.permissionKeys },
        requestId: requestId ?? null,
      });

      return {
        id: newRole.id,
        name: newRole.name,
        isSystem: false,
        tenantId,
        permissions: dto.permissionKeys,
      };
    });
  }

  async updateCustomRole(
    tenantId: string,
    roleId: string,
    actorId: string,
    dto: UpdateRoleInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const existingRoles = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, roleId))
        .limit(1);

      const role = existingRoles[0];
      if (!role) {
        throw new NotFoundException('Role not found');
      }

      if (role.isSystem || role.tenantId !== tenantId) {
        throw new ForbiddenException('Cannot modify system roles or roles from other organizations');
      }

      // 1. Update name if provided
      if (dto.name && dto.name !== role.name) {
        await tx.update(roles).set({ name: dto.name }).where(eq(roles.id, roleId));
      }

      // 2. Replace permissions
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      if (dto.permissionKeys && dto.permissionKeys.length > 0) {
        await tx.insert(rolePermissions).values(
          dto.permissionKeys.map((key) => ({
            roleId,
            permissionKey: key,
          }))
        );
      }

      // 3. Audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'role.update',
        entityType: 'role',
        entityId: roleId,
        after: { name: dto.name ?? role.name, permissions: dto.permissionKeys },
        requestId: requestId ?? null,
      });

      return {
        id: roleId,
        name: dto.name ?? role.name,
        isSystem: false,
        tenantId,
        permissions: dto.permissionKeys,
      };
    });
  }

  async deleteCustomRole(
    tenantId: string,
    roleId: string,
    actorId: string,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const existingRoles = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, roleId))
        .limit(1);

      const role = existingRoles[0];
      if (!role) {
        throw new NotFoundException('Role not found');
      }

      if (role.isSystem || role.tenantId !== tenantId) {
        throw new ForbiddenException('Cannot delete system roles');
      }

      // Check if any member has this role
      const members = await tx
        .select()
        .from(tenantMemberships)
        .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.roleId, roleId)))
        .limit(1);

      if (members[0]) {
        throw new BadRequestException('Cannot delete role: active team members are assigned to this role');
      }

      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      await tx.delete(roles).where(eq(roles.id, roleId));

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'role.delete',
        entityType: 'role',
        entityId: roleId,
        before: { name: role.name },
        requestId: requestId ?? null,
      });

      return { success: true };
    });
  }
}
