import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { withSystem, tenants, auditLogs } from '@growthomic/db';
import type { UpdateTenantInput } from '@growthomic/shared';

@Injectable()
export class TenantsService {
  async getCurrentTenant(tenantId: string) {
    return withSystem(async (tx) => {
      const rows = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      const tenant = rows[0];
      if (!tenant) {
        throw new NotFoundException('Organization not found');
      }
      return tenant;
    });
  }

  async updateSettings(
    tenantId: string,
    actorId: string,
    dto: UpdateTenantInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const rows = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      const tenant = rows[0];
      if (!tenant) {
        throw new NotFoundException('Organization not found');
      }

      const updateData: Partial<typeof tenants.$inferInsert> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
      if (dto.currency !== undefined) updateData.currency = dto.currency;

      const updated = await tx
        .update(tenants)
        .set(updateData)
        .where(eq(tenants.id, tenantId))
        .returning();

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'tenant.update_settings',
        entityType: 'tenant',
        entityId: tenantId,
        before: { name: tenant.name, timezone: tenant.timezone, currency: tenant.currency },
        after: updateData,
        requestId: requestId ?? null,
      });

      return updated[0];
    });
  }
}
