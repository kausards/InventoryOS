import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { withSystem, users, roles, tenantMemberships, auditLogs } from '@growthomic/db';
import type { InviteMemberInput, UpdateMemberRoleInput } from '@growthomic/shared';

@Injectable()
export class TeamService {
  async listMembers(tenantId: string) {
    return withSystem(async (tx) => {
      const rows = await tx
        .select({
          membershipId: tenantMemberships.id,
          userId: users.id,
          email: users.email,
          fullName: users.fullName,
          roleId: roles.id,
          roleName: roles.name,
          isSystemRole: roles.isSystem,
          status: tenantMemberships.status,
          createdAt: tenantMemberships.createdAt,
        })
        .from(tenantMemberships)
        .innerJoin(users, eq(tenantMemberships.userId, users.id))
        .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
        .where(eq(tenantMemberships.tenantId, tenantId));

      return rows;
    });
  }

  async inviteMember(
    tenantId: string,
    actorId: string,
    dto: InviteMemberInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      // 1. Verify role exists
      const targetRole = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, dto.roleId))
        .limit(1);

      if (!targetRole[0]) {
        throw new NotFoundException('Selected role does not exist');
      }

      // 2. Find or create user
      let user = (
        await tx.select().from(users).where(eq(users.email, dto.email)).limit(1)
      )[0];

      if (!user) {
        const dummyUserId = crypto.randomUUID();
        const insertedUsers = await tx
          .insert(users)
          .values({
            id: dummyUserId,
            email: dto.email,
            fullName: dto.fullName,
          })
          .returning();
        user = insertedUsers[0]!;
      }

      // 3. Check existing membership
      const existingMembership = await tx
        .select()
        .from(tenantMemberships)
        .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, user.id)))
        .limit(1);

      if (existingMembership[0]) {
        throw new BadRequestException('User is already a member of this organization');
      }

      // 4. Create membership
      const inserted = await tx
        .insert(tenantMemberships)
        .values({
          tenantId,
          userId: user.id,
          roleId: dto.roleId,
          status: 'active',
        })
        .returning();

      const newMembership = inserted[0]!;

      // 5. Audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'team.invite',
        entityType: 'membership',
        entityId: newMembership.id,
        after: { email: user.email, role: targetRole[0].name },
        requestId: requestId ?? null,
      });

      return {
        membershipId: newMembership.id,
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        roleId: targetRole[0].id,
        roleName: targetRole[0].name,
        status: newMembership.status,
      };
    });
  }

  async updateMemberRole(
    tenantId: string,
    actorId: string,
    membershipId: string,
    dto: UpdateMemberRoleInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      // 1. Fetch current membership
      const rows = await tx
        .select({
          membership: tenantMemberships,
          roleName: roles.name,
        })
        .from(tenantMemberships)
        .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
        .where(and(eq(tenantMemberships.id, membershipId), eq(tenantMemberships.tenantId, tenantId)))
        .limit(1);

      const item = rows[0];
      if (!item) {
        throw new NotFoundException('Team member not found');
      }

      // 2. Fetch new role
      const targetRole = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, dto.roleId))
        .limit(1);

      if (!targetRole[0]) {
        throw new NotFoundException('Target role does not exist');
      }

      // 3. Last-Owner Rule Check
      if (item.roleName === 'Owner' && targetRole[0].name !== 'Owner') {
        const ownerCount = await this.countActiveOwners(tx, tenantId);
        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot demote the last remaining Owner of the organization');
        }
      }

      // 4. Update membership
      await tx
        .update(tenantMemberships)
        .set({ roleId: dto.roleId })
        .where(eq(tenantMemberships.id, membershipId));

      // 5. Audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'team.change_role',
        entityType: 'membership',
        entityId: membershipId,
        before: { role: item.roleName },
        after: { role: targetRole[0].name },
        requestId: requestId ?? null,
      });

      return {
        membershipId,
        roleId: targetRole[0].id,
        roleName: targetRole[0].name,
      };
    });
  }

  async removeMember(
    tenantId: string,
    actorId: string,
    membershipId: string,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      // 1. Fetch current membership
      const rows = await tx
        .select({
          membership: tenantMemberships,
          roleName: roles.name,
        })
        .from(tenantMemberships)
        .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
        .where(and(eq(tenantMemberships.id, membershipId), eq(tenantMemberships.tenantId, tenantId)))
        .limit(1);

      const item = rows[0];
      if (!item) {
        throw new NotFoundException('Team member not found');
      }

      // 2. Last-Owner Rule Check
      if (item.roleName === 'Owner') {
        const ownerCount = await this.countActiveOwners(tx, tenantId);
        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot remove the last remaining Owner of the organization');
        }
      }

      // 3. Remove membership
      await tx
        .delete(tenantMemberships)
        .where(eq(tenantMemberships.id, membershipId));

      // 4. Audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'team.remove',
        entityType: 'membership',
        entityId: membershipId,
        before: { role: item.roleName },
        requestId: requestId ?? null,
      });

      return { success: true };
    });
  }

  private async countActiveOwners(tx: any, tenantId: string): Promise<number> {
    const ownerRole = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.name, 'Owner'), eq(roles.isSystem, true)))
      .limit(1);

    if (!ownerRole[0]) return 0;

    const res = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.roleId, ownerRole[0].id),
          eq(tenantMemberships.status, 'active')
        )
      );

    return res[0]?.count ?? 0;
  }
}
