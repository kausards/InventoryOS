import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  withSystem,
  customers,
  customerAddresses,
  customerTags,
  customerTagAssignments,
  orders,
  auditLogs,
} from '@growthomic/db';
import { eq, and, sql, ilike, or, desc } from 'drizzle-orm';
import { normalizeBdPhone } from '@growthomic/shared';
import type { CreateCustomerInput, UpdateCustomerInput, CreateCustomerTagInput } from '@growthomic/shared';

@Injectable()
export class CustomersService {
  async listCustomers(
    tenantId: string,
    query: { page?: number; limit?: number; search?: string; tagId?: string }
  ) {
    return withSystem(async (tx) => {
      const page = Math.max(1, query.page ? Number(query.page) : 1);
      const limit = Math.max(1, Math.min(100, query.limit ? Number(query.limit) : 20));
      const offset = (page - 1) * limit;

      const conditions: any[] = [eq(customers.tenantId, tenantId)];

      if (query.search?.trim()) {
        const searchTerm = `%${query.search.trim()}%`;
        conditions.push(
          or(
            ilike(customers.name, searchTerm),
            ilike(customers.phone, searchTerm),
            ilike(customers.normalizedPhone, searchTerm)
          )
        );
      }

      if (query.tagId) {
        const taggedCustomers = await tx
          .select({ customerId: customerTagAssignments.customerId })
          .from(customerTagAssignments)
          .where(
            and(
              eq(customerTagAssignments.tenantId, tenantId),
              eq(customerTagAssignments.tagId, query.tagId)
            )
          );
        const customerIds = taggedCustomers.map((t) => t.customerId);
        if (customerIds.length === 0) {
          return {
            items: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          };
        }
        conditions.push(sql`${customers.id} IN ${customerIds}`);
      }

      const rows = await tx
        .select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.createdAt))
        .limit(limit)
        .offset(offset);

      const totalRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(and(...conditions));

      const total = totalRes[0]?.count ?? 0;

      // Enrich with tags & default address
      const customerIds = rows.map((c) => c.id);
      const addresses = customerIds.length > 0
        ? await tx
            .select()
            .from(customerAddresses)
            .where(
              and(
                eq(customerAddresses.tenantId, tenantId),
                sql`${customerAddresses.customerId} IN ${customerIds}`
              )
            )
        : [];

      const tagAssignments = customerIds.length > 0
        ? await tx
            .select({
              customerId: customerTagAssignments.customerId,
              tagId: customerTags.id,
              name: customerTags.name,
              color: customerTags.color,
            })
            .from(customerTagAssignments)
            .innerJoin(customerTags, eq(customerTagAssignments.tagId, customerTags.id))
            .where(
              and(
                eq(customerTagAssignments.tenantId, tenantId),
                sql`${customerTagAssignments.customerId} IN ${customerIds}`
              )
            )
        : [];

      const items = rows.map((c) => {
        const custAddresses = addresses.filter((a) => a.customerId === c.id);
        const defaultAddress = custAddresses.find((a) => a.isDefault) ?? custAddresses[0] ?? null;
        const custTags = tagAssignments.filter((t) => t.customerId === c.id);
        return {
          ...c,
          totalSpentMinor: c.totalSpentMinor.toString(),
          defaultAddress,
          tags: custTags,
        };
      });

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async getCustomerById(tenantId: string, customerId: string) {
    return withSystem(async (tx) => {
      const customerRow = (
        await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!customerRow) {
        throw new NotFoundException('Customer not found');
      }

      const addresses = await tx
        .select()
        .from(customerAddresses)
        .where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, customerId)));

      const tags = await tx
        .select({
          id: customerTags.id,
          name: customerTags.name,
          color: customerTags.color,
        })
        .from(customerTagAssignments)
        .innerJoin(customerTags, eq(customerTagAssignments.tagId, customerTags.id))
        .where(
          and(
            eq(customerTagAssignments.tenantId, tenantId),
            eq(customerTagAssignments.customerId, customerId)
          )
        );

      const recentOrders = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          orderStatus: orders.orderStatus,
          paymentStatus: orders.paymentStatus,
          totalAmountMinor: orders.totalAmountMinor,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId)))
        .orderBy(desc(orders.createdAt))
        .limit(10);

      return {
        ...customerRow,
        totalSpentMinor: customerRow.totalSpentMinor.toString(),
        addresses,
        tags,
        recentOrders: recentOrders.map((o) => ({
          ...o,
          totalAmountMinor: o.totalAmountMinor.toString(),
        })),
      };
    });
  }

  async lookupCustomerByPhone(tenantId: string, rawPhone: string) {
    return withSystem(async (tx) => {
      const normResult = normalizeBdPhone(rawPhone);
      const normalizedPhone = normResult.isValid ? normResult.e164 : rawPhone.trim();

      const customerRow = (
        await tx
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              or(
                eq(customers.normalizedPhone, normalizedPhone),
                eq(customers.phone, rawPhone.trim())
              )
            )
          )
          .limit(1)
      )[0];

      if (!customerRow) {
        return null;
      }

      const addresses = await tx
        .select()
        .from(customerAddresses)
        .where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, customerRow.id)));

      const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;

      return {
        ...customerRow,
        totalSpentMinor: customerRow.totalSpentMinor.toString(),
        defaultAddress,
        addresses,
      };
    });
  }

  async createCustomer(
    tenantId: string,
    actorId: string,
    dto: CreateCustomerInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const normResult = normalizeBdPhone(dto.phone);
      const normalizedPhone = normResult.isValid ? normResult.e164 : dto.phone.trim();

      // Check if existing customer with this normalized phone exists in tenant
      const existing = (
        await tx
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              eq(customers.normalizedPhone, normalizedPhone)
            )
          )
          .limit(1)
      )[0];

      if (existing) {
        throw new BadRequestException(`Customer with phone ${dto.phone} already exists in this tenant`);
      }

      const insertedCustomer = (
        await tx
          .insert(customers)
          .values({
            tenantId,
            name: dto.name,
            phone: dto.phone,
            normalizedPhone,
            email: dto.email ?? null,
            notes: dto.notes ?? null,
          })
          .returning()
      )[0]!;

      let addressRow = null;
      if (dto.address) {
        addressRow = (
          await tx
            .insert(customerAddresses)
            .values({
              tenantId,
              customerId: insertedCustomer.id,
              label: dto.address.label ?? 'Home',
              division: dto.address.division,
              district: dto.address.district,
              upazilaThana: dto.address.upazilaThana ?? null,
              area: dto.address.area ?? null,
              streetAddress: dto.address.streetAddress,
              isDefault: true,
            })
            .returning()
        )[0];
      }

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'customer.create',
        entityType: 'customer',
        entityId: insertedCustomer.id,
        after: { name: insertedCustomer.name, phone: insertedCustomer.normalizedPhone },
        requestId: requestId ?? null,
      });

      return {
        ...insertedCustomer,
        totalSpentMinor: insertedCustomer.totalSpentMinor.toString(),
        defaultAddress: addressRow,
      };
    });
  }

  async updateCustomer(
    tenantId: string,
    actorId: string,
    customerId: string,
    dto: UpdateCustomerInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!existing) {
        throw new NotFoundException('Customer not found');
      }

      const updateData: any = { updatedAt: sql`now()` };
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.email !== undefined) updateData.email = dto.email;
      if (dto.notes !== undefined) updateData.notes = dto.notes;
      if (dto.phone !== undefined) {
        updateData.phone = dto.phone;
        const norm = normalizeBdPhone(dto.phone);
        updateData.normalizedPhone = norm.isValid ? norm.e164 : dto.phone.trim();
      }

      const updated = (
        await tx
          .update(customers)
          .set(updateData)
          .where(eq(customers.id, customerId))
          .returning()
      )[0]!;

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'customer.update',
        entityType: 'customer',
        entityId: customerId,
        after: updateData,
        requestId: requestId ?? null,
      });

      return {
        ...updated,
        totalSpentMinor: updated.totalSpentMinor.toString(),
      };
    });
  }

  // Tags Management
  async listTags(tenantId: string) {
    return withSystem(async (tx) => {
      return tx
        .select()
        .from(customerTags)
        .where(eq(customerTags.tenantId, tenantId))
        .orderBy(customerTags.name);
    });
  }

  async createTag(tenantId: string, dto: CreateCustomerTagInput) {
    return withSystem(async (tx) => {
      const inserted = await tx
        .insert(customerTags)
        .values({
          tenantId,
          name: dto.name,
          color: dto.color ?? '#2563EB',
        })
        .returning();
      return inserted[0]!;
    });
  }

  async assignTag(tenantId: string, customerId: string, tagId: string) {
    return withSystem(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(customerTagAssignments)
          .where(
            and(
              eq(customerTagAssignments.tenantId, tenantId),
              eq(customerTagAssignments.customerId, customerId),
              eq(customerTagAssignments.tagId, tagId)
            )
          )
          .limit(1)
      )[0];

      if (existing) return existing;

      const inserted = await tx
        .insert(customerTagAssignments)
        .values({ tenantId, customerId, tagId })
        .returning();
      return inserted[0]!;
    });
  }

  async removeTag(tenantId: string, customerId: string, tagId: string) {
    return withSystem(async (tx) => {
      await tx
        .delete(customerTagAssignments)
        .where(
          and(
            eq(customerTagAssignments.tenantId, tenantId),
            eq(customerTagAssignments.customerId, customerId),
            eq(customerTagAssignments.tagId, tagId)
          )
        );
      return { success: true };
    });
  }
}
