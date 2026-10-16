import { Injectable, NotFoundException } from '@nestjs/common';
import {
  withSystem,
  tenants,
  warehouses,
  courierAccounts,
  products,
  productVariants,
  warehouseStockBalances,
  inventoryMovements,
  auditLogs,
} from '@growthomic/db';
import { eq, and, sql } from 'drizzle-orm';
import {
  encryptCourierCredentials,
  cleanImportCell,
} from '@growthomic/shared';
import type {
  StoreProfileInput,
  FirstWarehouseInput,
  InitialCourierInput,
  InitialProductInput,
} from '@growthomic/shared';

@Injectable()
export class OnboardingService {
  /**
   * Retrieves tenant onboarding completion status, steps, and basic counters
   */
  async getStatus(tenantId: string) {
    return withSystem(async (tx) => {
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      const [whCountRes] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(warehouses)
        .where(eq(warehouses.tenantId, tenantId));

      const [courierCountRes] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(courierAccounts)
        .where(eq(courierAccounts.tenantId, tenantId));

      const [prodCountRes] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(eq(products.tenantId, tenantId));

      const meta = (tenant.metadata as Record<string, any>) || {};
      const warehousesCount = whCountRes?.count ?? 0;
      const couriersCount = courierCountRes?.count ?? 0;
      const productsCount = prodCountRes?.count ?? 0;

      // Determine step
      let currentStep = Number(meta['onboardingStep']) || 1;
      if (tenant.onboardingCompleted) {
        currentStep = 5;
      }

      return {
        completed: tenant.onboardingCompleted ?? false,
        currentStep,
        storeName: tenant.name,
        metadata: meta,
        stats: {
          warehousesCount,
          couriersCount,
          productsCount,
        },
      };
    });
  }

  /**
   * Step 1: Save store profile
   */
  async saveStoreProfile(
    tenantId: string,
    userId: string,
    dto: StoreProfileInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) throw new NotFoundException('Tenant not found');

      const currentMeta = (tenant.metadata as Record<string, any>) || {};
      const newMeta = {
        ...currentMeta,
        storeProfile: dto,
        onboardingStep: Math.max(Number(currentMeta['onboardingStep']) || 1, 2),
      };

      const [updated] = await tx
        .update(tenants)
        .set({
          name: dto.organizationName,
          metadata: newMeta,
        })
        .where(eq(tenants.id, tenantId))
        .returning();

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'ONBOARDING_STORE_PROFILE_SAVED',
        entityType: 'tenant',
        entityId: tenantId,
        requestId,
        after: { storeProfile: dto },
      });

      return {
        success: true,
        step: 2,
        tenant: updated,
      };
    });
  }

  /**
   * Step 2: Configure First Warehouse
   */
  async saveWarehouse(
    tenantId: string,
    userId: string,
    dto: FirstWarehouseInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) throw new NotFoundException('Tenant not found');

      // Check if existing warehouse exists
      const [existingWh] = await tx
        .select()
        .from(warehouses)
        .where(eq(warehouses.tenantId, tenantId))
        .limit(1);

      let wh = existingWh;
      if (!wh) {
        const [newWh] = await tx
          .insert(warehouses)
          .values({
            tenantId,
            name: dto.name,
            code: 'WH-01',
            address: `${dto.streetAddress}, ${dto.district}, ${dto.division}`,
            isDefault: true,
            status: 'active',
          })
          .returning();
        wh = newWh;
      } else {
        const [updatedWh] = await tx
          .update(warehouses)
          .set({
            name: dto.name,
            address: `${dto.streetAddress}, ${dto.district}, ${dto.division}`,
            updatedAt: new Date().toISOString(),
          })
          .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.id, existingWh!.id)))
          .returning();
        wh = updatedWh;
      }

      const currentMeta = (tenant.metadata as Record<string, any>) || {};
      await tx
        .update(tenants)
        .set({
          metadata: {
            ...currentMeta,
            warehouseConfigured: true,
            onboardingStep: Math.max(Number(currentMeta['onboardingStep']) || 1, 3),
          },
        })
        .where(eq(tenants.id, tenantId));

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'ONBOARDING_WAREHOUSE_CONFIGURED',
        entityType: 'warehouse',
        entityId: wh!.id,
        requestId,
        after: { warehouse: dto },
      });

      return {
        success: true,
        step: 3,
        warehouse: wh,
      };
    });
  }

  /**
   * Step 3: Configure Courier Credentials
   */
  async saveCourier(
    tenantId: string,
    userId: string,
    dto: InitialCourierInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) throw new NotFoundException('Tenant not found');

      const encryptedCredentials = encryptCourierCredentials(
        JSON.stringify({
          apiKey: dto.apiKey,
          secretKey: dto.secretKey,
        })
      );

      const [existingAccount] = await tx
        .select()
        .from(courierAccounts)
        .where(and(eq(courierAccounts.tenantId, tenantId), eq(courierAccounts.courierCode, dto.courierName)))
        .limit(1);

      let courierAcc = existingAccount;
      if (!courierAcc) {
        const [created] = await tx
          .insert(courierAccounts)
          .values({
            tenantId,
            courierCode: dto.courierName,
            accountName: `${dto.courierName === 'steadfast' ? 'Steadfast Courier' : 'Pathao Courier'} (Primary)`,
            encryptedCredentials,
            isActive: true,
            isDefault: true,
          })
          .returning();
        courierAcc = created;
      } else {
        const [updated] = await tx
          .update(courierAccounts)
          .set({
            encryptedCredentials,
            isActive: true,
            updatedAt: new Date().toISOString(),
          })
          .where(and(eq(courierAccounts.tenantId, tenantId), eq(courierAccounts.id, existingAccount!.id)))
          .returning();
        courierAcc = updated;
      }

      const currentMeta = (tenant.metadata as Record<string, any>) || {};
      await tx
        .update(tenants)
        .set({
          metadata: {
            ...currentMeta,
            courierConfigured: true,
            onboardingStep: Math.max(Number(currentMeta['onboardingStep']) || 1, 4),
          },
        })
        .where(eq(tenants.id, tenantId));

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'ONBOARDING_COURIER_CONFIGURED',
        entityType: 'courier_account',
        entityId: courierAcc!.id,
        requestId,
        after: { courierCode: dto.courierName },
      });

      return {
        success: true,
        step: 4,
        courierCode: dto.courierName,
      };
    });
  }

  /**
   * Step 4: Add Initial Product & Stock
   */
  async saveInitialProduct(
    tenantId: string,
    userId: string,
    dto: InitialProductInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) throw new NotFoundException('Tenant not found');

      // Resolve warehouse
      let [wh] = await tx
        .select()
        .from(warehouses)
        .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.status, 'active')))
        .limit(1);

      if (!wh) {
        const [newWh] = await tx
          .insert(warehouses)
          .values({
            tenantId,
            name: 'Main Warehouse',
            code: 'WH-MAIN',
            address: 'Dhaka, Bangladesh',
            isDefault: true,
            status: 'active',
          })
          .returning();
        wh = newWh!;
      }

      const slug = `${cleanImportCell(dto.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

      const [product] = await tx
        .insert(products)
        .values({
          tenantId,
          name: cleanImportCell(dto.name),
          slug,
          status: 'active',
        })
        .returning();

      const [variant] = await tx
        .insert(productVariants)
        .values({
          tenantId,
          productId: product!.id,
          sku: cleanImportCell(dto.sku),
          name: 'Default',
          retailPrice: BigInt(Math.round(dto.retailPrice * 100)),
          purchaseCost: BigInt(0),
          status: 'active',
        })
        .returning();

      if (dto.stockQuantity > 0) {
        await tx.insert(warehouseStockBalances).values({
          tenantId,
          warehouseId: wh.id,
          variantId: variant!.id,
          onHand: dto.stockQuantity,
          available: dto.stockQuantity,
          reserved: 0,
        });

        await tx.insert(inventoryMovements).values({
          tenantId,
          warehouseId: wh.id,
          variantId: variant!.id,
          type: 'opening',
          quantity: dto.stockQuantity,
          referenceType: 'manual',
          actorId: userId,
          note: 'Setup Wizard Initial Inventory',
        });
      }

      const currentMeta = (tenant.metadata as Record<string, any>) || {};
      await tx
        .update(tenants)
        .set({
          metadata: {
            ...currentMeta,
            productAdded: true,
            onboardingStep: Math.max(Number(currentMeta['onboardingStep']) || 1, 5),
          },
        })
        .where(eq(tenants.id, tenantId));

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'ONBOARDING_PRODUCT_CREATED',
        entityType: 'product',
        entityId: product!.id,
        requestId,
        after: { sku: dto.sku, stock: dto.stockQuantity },
      });

      return {
        success: true,
        step: 5,
        product,
        variant,
      };
    });
  }

  /**
   * Step 5: Mark Onboarding Completed
   */
  async completeOnboarding(tenantId: string, userId: string, requestId?: string) {
    return withSystem(async (tx) => {
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) throw new NotFoundException('Tenant not found');

      const currentMeta = (tenant.metadata as Record<string, any>) || {};
      const [updated] = await tx
        .update(tenants)
        .set({
          onboardingCompleted: true,
          metadata: {
            ...currentMeta,
            onboardingStep: 5,
            completedAt: new Date().toISOString(),
          },
        })
        .where(eq(tenants.id, tenantId))
        .returning();

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'ONBOARDING_COMPLETED',
        entityType: 'tenant',
        entityId: tenantId,
        requestId,
        after: { completedAt: new Date().toISOString() },
      });

      return {
        success: true,
        message: 'Onboarding completed successfully. Welcome to Shopeers!',
        tenant: updated,
      };
    });
  }
}
