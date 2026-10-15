import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import {
  withSystem,
  warehouses,
  productVariants,
  products,
  warehouseStockBalances,
  inventoryMovements,
  stockAdjustments,
  users,
  auditLogs,
} from '@growthomic/db';
import type {
  StockAdjustmentInput,
  StockReservationInput,
  StockReleaseInput,
} from '@growthomic/shared';

@Injectable()
export class InventoryService {
  async getWarehouseStock(tenantId: string, warehouseId?: string) {
    return withSystem(async (tx) => {
      const conditions = [eq(warehouseStockBalances.tenantId, tenantId)];
      if (warehouseId) {
        conditions.push(eq(warehouseStockBalances.warehouseId, warehouseId));
      }

      const rows = await tx
        .select({
          id: warehouseStockBalances.id,
          warehouseId: warehouseStockBalances.warehouseId,
          warehouseName: warehouses.name,
          variantId: warehouseStockBalances.variantId,
          sku: productVariants.sku,
          variantName: productVariants.name,
          barcode: productVariants.barcode,
          productId: productVariants.productId,
          productName: products.name,
          retailPrice: productVariants.retailPrice,
          purchaseCost: productVariants.purchaseCost,
          lowStockThreshold: productVariants.lowStockThreshold,
          onHand: warehouseStockBalances.onHand,
          reserved: warehouseStockBalances.reserved,
          available: warehouseStockBalances.available,
          updatedAt: warehouseStockBalances.updatedAt,
        })
        .from(warehouseStockBalances)
        .innerJoin(warehouses, eq(warehouseStockBalances.warehouseId, warehouses.id))
        .innerJoin(productVariants, eq(warehouseStockBalances.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(...conditions))
        .orderBy(desc(warehouseStockBalances.updatedAt));

      return rows.map((r) => ({
        ...r,
        retailPrice: Number(r.retailPrice),
        purchaseCost: Number(r.purchaseCost),
        valuation: Number(r.purchaseCost) * r.onHand,
        isLowStock: r.available <= r.lowStockThreshold,
      }));
    });
  }

  async getStockMovements(
    tenantId: string,
    params: {
      variantId?: string;
      warehouseId?: string;
      type?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    return withSystem(async (tx) => {
      const page = Math.max(1, params.page ?? 1);
      const limit = Math.min(100, Math.max(1, params.limit ?? 25));
      const offset = (page - 1) * limit;

      const conditions = [eq(inventoryMovements.tenantId, tenantId)];
      if (params.variantId) conditions.push(eq(inventoryMovements.variantId, params.variantId));
      if (params.warehouseId) conditions.push(eq(inventoryMovements.warehouseId, params.warehouseId));
      if (params.type) conditions.push(eq(inventoryMovements.type, params.type));

      const rows = await tx
        .select({
          id: inventoryMovements.id,
          type: inventoryMovements.type,
          quantity: inventoryMovements.quantity,
          referenceType: inventoryMovements.referenceType,
          referenceId: inventoryMovements.referenceId,
          reason: inventoryMovements.reason,
          note: inventoryMovements.note,
          unitCost: inventoryMovements.unitCost,
          createdAt: inventoryMovements.createdAt,
          warehouseName: warehouses.name,
          sku: productVariants.sku,
          variantName: productVariants.name,
          actorName: users.fullName,
          actorEmail: users.email,
        })
        .from(inventoryMovements)
        .innerJoin(warehouses, eq(inventoryMovements.warehouseId, warehouses.id))
        .innerJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
        .innerJoin(users, eq(inventoryMovements.actorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(inventoryMovements.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryMovements)
        .where(and(...conditions));

      const total = totalCount[0]?.count ?? 0;

      return {
        items: rows.map((r) => ({
          ...r,
          unitCost: Number(r.unitCost),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async adjustStock(
    tenantId: string,
    actorId: string,
    dto: StockAdjustmentInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      // 1. Fetch current stock balance
      const balanceRow = (
        await tx
          .select()
          .from(warehouseStockBalances)
          .where(
            and(
              eq(warehouseStockBalances.tenantId, tenantId),
              eq(warehouseStockBalances.warehouseId, dto.warehouseId),
              eq(warehouseStockBalances.variantId, dto.variantId)
            )
          )
          .limit(1)
      )[0];

      if (!balanceRow) {
        throw new NotFoundException('Stock balance record not found for this warehouse and variant');
      }

      const currentOnHand = balanceRow.onHand;
      const delta = dto.countedQuantity - currentOnHand;

      if (delta === 0) {
        throw new BadRequestException('Counted quantity equals current on-hand stock; no adjustment necessary');
      }

      const newOnHand = dto.countedQuantity;
      const newAvailable = newOnHand - balanceRow.reserved;

      if (newAvailable < 0) {
        throw new BadRequestException(
          `Cannot reduce on-hand to ${newOnHand}: ${balanceRow.reserved} units are currently reserved for pending orders`
        );
      }

      // 2. Fetch variant cost for ledger valuation
      const variant = (
        await tx
          .select({ purchaseCost: productVariants.purchaseCost, sku: productVariants.sku })
          .from(productVariants)
          .where(eq(productVariants.id, dto.variantId))
          .limit(1)
      )[0];

      // 3. Update warehouse_stock_balances
      await tx
        .update(warehouseStockBalances)
        .set({
          onHand: newOnHand,
          available: newAvailable,
          updatedAt: sql`now()`,
        })
        .where(eq(warehouseStockBalances.id, balanceRow.id));

      // 4. Create stock_adjustments entry
      const insertedAdj = await tx
        .insert(stockAdjustments)
        .values({
          tenantId,
          warehouseId: dto.warehouseId,
          variantId: dto.variantId,
          systemQuantity: currentOnHand,
          countedQuantity: dto.countedQuantity,
          deltaQuantity: delta,
          reason: dto.reason,
          note: dto.note ?? null,
          status: 'approved',
          actorId,
        })
        .returning();

      const adjustment = insertedAdj[0]!;

      // 5. Append to immutable inventory_movements ledger
      await tx.insert(inventoryMovements).values({
        tenantId,
        warehouseId: dto.warehouseId,
        variantId: dto.variantId,
        type: 'adjustment',
        quantity: delta,
        referenceType: 'adjustment',
        referenceId: adjustment.id,
        reason: dto.reason,
        note: dto.note ?? null,
        unitCost: variant?.purchaseCost ?? BigInt(0),
        actorId,
      });

      // 6. Write audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'inventory.adjust',
        entityType: 'stock_balance',
        entityId: balanceRow.id,
        before: { onHand: currentOnHand, available: balanceRow.available },
        after: { onHand: newOnHand, available: newAvailable, delta, reason: dto.reason },
        requestId: requestId ?? null,
      });

      return {
        adjustmentId: adjustment.id,
        variantId: dto.variantId,
        previousOnHand: currentOnHand,
        newOnHand,
        delta,
        reserved: balanceRow.reserved,
        available: newAvailable,
      };
    });
  }

  async reserveStock(
    tenantId: string,
    actorId: string,
    dto: StockReservationInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      // 1. Fetch balance with explicit lock (FOR UPDATE)
      const balanceRow = (
        await tx
          .select()
          .from(warehouseStockBalances)
          .where(
            and(
              eq(warehouseStockBalances.tenantId, tenantId),
              eq(warehouseStockBalances.warehouseId, dto.warehouseId),
              eq(warehouseStockBalances.variantId, dto.variantId)
            )
          )
          .for('update')
          .limit(1)
      )[0];

      if (!balanceRow) {
        throw new NotFoundException('Stock balance record not found');
      }

      if (balanceRow.available < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock available for reservation. Requested: ${dto.quantity}, Available: ${balanceRow.available}`
        );
      }

      const newReserved = balanceRow.reserved + dto.quantity;
      const newAvailable = balanceRow.onHand - newReserved;

      // 2. Update balance
      await tx
        .update(warehouseStockBalances)
        .set({
          reserved: newReserved,
          available: newAvailable,
          updatedAt: sql`now()`,
        })
        .where(eq(warehouseStockBalances.id, balanceRow.id));

      // 3. Append to immutable ledger
      await tx.insert(inventoryMovements).values({
        tenantId,
        warehouseId: dto.warehouseId,
        variantId: dto.variantId,
        type: 'reservation',
        quantity: dto.quantity,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        reason: 'Order stock reservation',
        actorId,
      });

      return {
        variantId: dto.variantId,
        onHand: balanceRow.onHand,
        reserved: newReserved,
        available: newAvailable,
      };
    });
  }

  async releaseReservation(
    tenantId: string,
    actorId: string,
    dto: StockReleaseInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const balanceRow = (
        await tx
          .select()
          .from(warehouseStockBalances)
          .where(
            and(
              eq(warehouseStockBalances.tenantId, tenantId),
              eq(warehouseStockBalances.warehouseId, dto.warehouseId),
              eq(warehouseStockBalances.variantId, dto.variantId)
            )
          )
          .limit(1)
      )[0];

      if (!balanceRow) {
        throw new NotFoundException('Stock balance record not found');
      }

      const newReserved = Math.max(0, balanceRow.reserved - dto.quantity);
      const newAvailable = balanceRow.onHand - newReserved;

      await tx
        .update(warehouseStockBalances)
        .set({
          reserved: newReserved,
          available: newAvailable,
          updatedAt: sql`now()`,
        })
        .where(eq(warehouseStockBalances.id, balanceRow.id));

      await tx.insert(inventoryMovements).values({
        tenantId,
        warehouseId: dto.warehouseId,
        variantId: dto.variantId,
        type: 'reservation_release',
        quantity: -dto.quantity,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        reason: 'Order reservation release',
        actorId,
      });

      return {
        variantId: dto.variantId,
        onHand: balanceRow.onHand,
        reserved: newReserved,
        available: newAvailable,
      };
    });
  }

  async getLowStockItems(tenantId: string) {
    return withSystem(async (tx) => {
      const rows = await tx
        .select({
          variantId: productVariants.id,
          sku: productVariants.sku,
          name: productVariants.name,
          productId: products.id,
          productName: products.name,
          warehouseName: warehouses.name,
          onHand: warehouseStockBalances.onHand,
          reserved: warehouseStockBalances.reserved,
          available: warehouseStockBalances.available,
          lowStockThreshold: productVariants.lowStockThreshold,
        })
        .from(warehouseStockBalances)
        .innerJoin(productVariants, eq(warehouseStockBalances.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .innerJoin(warehouses, eq(warehouseStockBalances.warehouseId, warehouses.id))
        .where(
          and(
            eq(warehouseStockBalances.tenantId, tenantId),
            sql`${warehouseStockBalances.available} <= ${productVariants.lowStockThreshold}`
          )
        )
        .orderBy(warehouseStockBalances.available);

      return rows;
    });
  }

  async getInventorySummary(tenantId: string) {
    return withSystem(async (tx) => {
      const balances = await tx
        .select({
          onHand: warehouseStockBalances.onHand,
          reserved: warehouseStockBalances.reserved,
          available: warehouseStockBalances.available,
          purchaseCost: productVariants.purchaseCost,
          lowStockThreshold: productVariants.lowStockThreshold,
        })
        .from(warehouseStockBalances)
        .innerJoin(productVariants, eq(warehouseStockBalances.variantId, productVariants.id))
        .where(eq(warehouseStockBalances.tenantId, tenantId));

      const totalSkus = balances.length;
      let totalOnHand = 0;
      let totalReserved = 0;
      let totalAvailable = 0;
      let totalValuation = BigInt(0);
      let lowStockCount = 0;

      for (const b of balances) {
        totalOnHand += b.onHand;
        totalReserved += b.reserved;
        totalAvailable += b.available;
        totalValuation += BigInt(b.onHand) * b.purchaseCost;
        if (b.available <= b.lowStockThreshold) {
          lowStockCount++;
        }
      }

      return {
        totalSkus,
        totalOnHand,
        totalReserved,
        totalAvailable,
        totalValuation: Number(totalValuation), // in paisa
        lowStockCount,
      };
    });
  }

  /**
   * Reconciles the immutable ledger against current cached on_hand balances.
   * Required for M2 Acceptance Gate ("Ledger sum = balance").
   */
  async reconcileLedger(tenantId: string, warehouseId: string, variantId: string) {
    return withSystem(async (tx) => {
      // 1. Fetch balance
      const balance = (
        await tx
          .select({ onHand: warehouseStockBalances.onHand })
          .from(warehouseStockBalances)
          .where(
            and(
              eq(warehouseStockBalances.tenantId, tenantId),
              eq(warehouseStockBalances.warehouseId, warehouseId),
              eq(warehouseStockBalances.variantId, variantId)
            )
          )
          .limit(1)
      )[0];

      if (!balance) {
        throw new NotFoundException('Balance not found for reconciliation');
      }

      // 2. Sum ledger movements that affect physical on-hand stock
      // (ignoring reservation & reservation_release which affect available/reserved, not physical on_hand)
      const physicalTypes = [
        'opening',
        'purchase_receipt',
        'fulfillment_deduction',
        'customer_return_receipt',
        'supplier_return',
        'adjustment',
        'damaged',
        'transfer_out',
        'transfer_in',
      ];

      const sumRes = await tx
        .select({
          total: sql<number>`COALESCE(SUM(${inventoryMovements.quantity}), 0)::int`,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.tenantId, tenantId),
            eq(inventoryMovements.warehouseId, warehouseId),
            eq(inventoryMovements.variantId, variantId),
            inArray(inventoryMovements.type, physicalTypes)
          )
        );

      const ledgerSum = sumRes[0]?.total ?? 0;
      const isBalanced = balance.onHand === ledgerSum;

      return {
        variantId,
        warehouseId,
        onHand: balance.onHand,
        ledgerSum,
        drift: balance.onHand - ledgerSum,
        isBalanced,
      };
    });
  }
}
