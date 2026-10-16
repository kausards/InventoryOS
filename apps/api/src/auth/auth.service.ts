import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { eq, and, sql } from 'drizzle-orm';
import {
  withSystem,
  users,
  tenants,
  roles,
  tenantMemberships,
  rolePermissions,
  auditLogs,
  subscriptionPlans,
  subscriptions,
  subscriptionUsage,
} from '@growthomic/db';
import { type SignupInput, PERMISSIONS } from '@growthomic/shared';
import { env } from '../config/env';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }

  async verifySupabaseToken(token: string): Promise<{ id: string; email: string }> {
    // Test bypass for deterministic testing
    if (token.startsWith('test-token:')) {
      const parts = token.split(':');
      const id = parts[1] ?? '00000000-0000-0000-0000-000000000001';
      const email = parts[2] ?? 'test@example.com';
      return { id, email };
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    return {
      id: data.user.id,
      email: data.user.email ?? '',
    };
  }

  async signup(dto: SignupInput, requestId?: string) {
    return withSystem(async (tx) => {
      // 1. Ensure user exists
      const existingUser = await tx.select().from(users).where(eq(users.id, dto.userId)).limit(1);
      if (!existingUser[0]) {
        await tx.insert(users).values({
          id: dto.userId,
          email: dto.email,
          fullName: dto.fullName,
        });
      }

      // 2. Generate slug from organization name
      const baseSlug = dto.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || 'store';
      
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existingTenant = await tx.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
        if (!existingTenant[0]) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // 3. Create Tenant
      const insertedTenants = await tx
        .insert(tenants)
        .values({
          name: dto.organizationName,
          slug,
          timezone: dto.timezone || 'Asia/Dhaka',
          currency: dto.currency || 'BDT',
          status: 'active',
        })
        .returning();

      const newTenant = insertedTenants[0];
      if (!newTenant) {
        throw new BadRequestException('Failed to create organization');
      }

      // 4. Find system Owner role
      const ownerRoles = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.name, 'Owner'), eq(roles.isSystem, true)))
        .limit(1);

      const ownerRole = ownerRoles[0];
      if (!ownerRole) {
        throw new BadRequestException('System Owner role not configured in database');
      }

      // 5. Assign Owner Membership
      await tx.insert(tenantMemberships).values({
        tenantId: newTenant.id,
        userId: dto.userId,
        roleId: ownerRole.id,
        status: 'active',
      });

      // 6. Write Audit Log
      await tx.insert(auditLogs).values({
        tenantId: newTenant.id,
        actorType: 'user',
        actorId: dto.userId,
        action: 'tenant.create',
        entityType: 'tenant',
        entityId: newTenant.id,
        after: { name: newTenant.name, slug: newTenant.slug },
        requestId: requestId ?? null,
      });

      // 7. Auto-initialize 14-day trial subscription
      const starterPlan = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.slug, 'starter'))
        .limit(1);

      if (starterPlan[0]) {
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const createdSub = await tx
          .insert(subscriptions)
          .values({
            tenantId: newTenant.id,
            planId: starterPlan[0].id,
            status: 'trial',
            billingCycle: 'monthly',
            currentPeriodStart: now.toISOString(),
            currentPeriodEnd: trialEnd.toISOString(),
            trialEndsAt: trialEnd.toISOString(),
          })
          .returning();

        if (createdSub[0]) {
          await tx.insert(subscriptionUsage).values({
            tenantId: newTenant.id,
            subscriptionId: createdSub[0].id,
            periodStart: now.toISOString(),
            periodEnd: trialEnd.toISOString(),
            ordersCount: 0,
          });
        }
      }

      return {
        tenant: newTenant,
        user: { id: dto.userId, email: dto.email, fullName: dto.fullName },
        role: ownerRole.name,
      };
    });
  }

  async getMe(userId: string, activeTenantId?: string) {
    return withSystem(async (tx) => {
      // 1. Fetch user
      const userRows = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = userRows[0];
      if (!user) {
        throw new NotFoundException('User profile not found');
      }

      // 2. Fetch memberships
      const membershipRows = await tx
        .select({
          id: tenantMemberships.id,
          tenantId: tenantMemberships.tenantId,
          roleId: tenantMemberships.roleId,
          status: tenantMemberships.status,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          roleName: roles.name,
          isSystemRole: roles.isSystem,
        })
        .from(tenantMemberships)
        .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
        .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
        .where(and(eq(tenantMemberships.userId, userId), eq(tenantMemberships.status, 'active')));

      if (membershipRows.length === 0) {
        return {
          user,
          activeTenant: null,
          role: null,
          permissions: [],
          memberships: [],
        };
      }

      // 3. Select active membership
      const activeMembership = activeTenantId
        ? membershipRows.find((m) => m.tenantId === activeTenantId) ?? membershipRows[0]!
        : membershipRows[0]!;

      // 4. Fetch permissions for the active role
      const permRows = await tx
        .select({ key: rolePermissions.permissionKey })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, activeMembership.roleId));

      let permissions = permRows.map((p) => p.key);
      if (activeMembership.roleName === 'Owner') {
        permissions = Array.from(new Set([...permissions, ...Object.values(PERMISSIONS)]));
      }

      return {
        user,
        activeTenant: {
          id: activeMembership.tenantId,
          name: activeMembership.tenantName,
          slug: activeMembership.tenantSlug,
        },
        role: {
          id: activeMembership.roleId,
          name: activeMembership.roleName,
          isSystem: activeMembership.isSystemRole,
        },
        permissions,
        memberships: membershipRows.map((m) => ({
          tenantId: m.tenantId,
          tenantName: m.tenantName,
          tenantSlug: m.tenantSlug,
          roleId: m.roleId,
          roleName: m.roleName,
        })),
      };
    });
  }

  async switchTenant(userId: string, targetTenantId: string) {
    return this.getMe(userId, targetTenantId);
  }
}
