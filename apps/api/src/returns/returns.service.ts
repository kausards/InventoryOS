import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, sql, desc, inArray, like, or } from 'drizzle-orm';
import {
  withSystem,
  returns,
  returnItems,
  returnStatusHistory,
  orders,
  orderItems,
  customers,
  warehouses,
  productVariants,
  products,
  inventoryMovements,
  warehouseStockBalances,
  shipments,
  customerAddresses,
} from '@growthomic/db';
import type {
  CreateReturnInput,
  InspectReturnInput,
  ReceiveReturnInput,
  CompleteReturnInput,
  ReturnReportFilter,
} from '@growthomic/shared';

@Injectable()
export class ReturnsService {
  /**
   * Helper to serialize BigInts to Number for Fastify JSON serialization.
   */
  private serializeReturn(r: any) {
    if (!r) return null;
    return {
      ...r,
      shippingCostMinor: r.shippingCostMinor != null ? Number(r.shippingCostMinor) : 0,
      refundAmountMinor: r.refundAmountMinor != null ? Number(r.refundAmountMinor) : 0,
    };
  }

  private serializeReturnItem(item: any) {
    if (!item) return null;
    return {
      ...item,
      unitPriceMinor: item.unitPriceMinor != null ? Number(item.unitPriceMinor) : 0,
    };
  }

  // ==========================================
  // LIST & GET RETURNS
  // ==========================================

  async listReturns(
    tenantId: string,
    query: {
      status?: string | undefined;
      returnType?: string | undefined;
      orderId?: string | undefined;
      search?: string | undefined;
      page?: number | undefined;
      limit?: number | undefined;
    }
  ) {
    return withSystem(async (tx) => {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
      const offset = (page - 1) * limit;

      const conditions: any[] = [eq(returns.tenantId, tenantId)];

      if (query.status) {
        conditions.push(eq(returns.status, query.status));
      }
      if (query.returnType) {
        conditions.push(eq(returns.returnType, query.returnType));
      }
      if (query.orderId) {
        conditions.push(eq(returns.orderId, query.orderId));
      }
      if (query.search) {
        conditions.push(like(returns.returnNumber, `%${query.search}%`));
      }

      const rows = await tx
        .select({
          id: returns.id,
          returnNumber: returns.returnNumber,
          orderId: returns.orderId,
          orderInvoiceNumber: orders.orderNumber,
          customerId: returns.customerId,
          customerName: customers.name,
          customerPhone: customers.phone,
          warehouseId: returns.warehouseId,
          warehouseName: warehouses.name,
          returnType: returns.returnType,
          status: returns.status,
          reason: returns.reason,
          notes: returns.notes,
          shippingCostMinor: returns.shippingCostMinor,
          customerDeliveryChargeRefunded: returns.customerDeliveryChargeRefunded,
          refundAmountMinor: returns.refundAmountMinor,
          refundStatus: returns.refundStatus,
          exchangeOrderId: returns.exchangeOrderId,
          requestedAt: returns.requestedAt,
          receivedAt: returns.receivedAt,
          completedAt: returns.completedAt,
          createdAt: returns.createdAt,
        })
        .from(returns)
        .innerJoin(orders, eq(returns.orderId, orders.id))
        .innerJoin(customers, eq(returns.customerId, customers.id))
        .innerJoin(warehouses, eq(returns.warehouseId, warehouses.id))
        .where(and(...conditions))
        .orderBy(desc(returns.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(returns)
        .where(and(...conditions));

      const total = countResult[0]?.count ?? 0;

      return {
        items: rows.map((r) => this.serializeReturn(r)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async getReturn(tenantId: string, returnId: string) {
    return withSystem(async (tx) => {
      const returnRows = await tx
        .select({
          id: returns.id,
          tenantId: returns.tenantId,
          returnNumber: returns.returnNumber,
          orderId: returns.orderId,
          orderInvoiceNumber: orders.orderNumber,
          customerId: returns.customerId,
          customerName: customers.name,
          customerPhone: customers.phone,
          warehouseId: returns.warehouseId,
          warehouseName: warehouses.name,
          returnType: returns.returnType,
          status: returns.status,
          reason: returns.reason,
          notes: returns.notes,
          shippingCostMinor: returns.shippingCostMinor,
          customerDeliveryChargeRefunded: returns.customerDeliveryChargeRefunded,
          refundAmountMinor: returns.refundAmountMinor,
          refundStatus: returns.refundStatus,
          exchangeOrderId: returns.exchangeOrderId,
          requestedAt: returns.requestedAt,
          receivedAt: returns.receivedAt,
          completedAt: returns.completedAt,
          createdAt: returns.createdAt,
          updatedAt: returns.updatedAt,
        })
        .from(returns)
        .innerJoin(orders, eq(returns.orderId, orders.id))
        .innerJoin(customers, eq(returns.customerId, customers.id))
        .innerJoin(warehouses, eq(returns.warehouseId, warehouses.id))
        .where(and(eq(returns.id, returnId), eq(returns.tenantId, tenantId)))
        .limit(1);

      const returnHead = returnRows[0];
      if (!returnHead) {
        throw new NotFoundException(`Return ${returnId} not found`);
      }

      const returnRecord = this.serializeReturn(returnHead);

      // Fetch items
      const items = await tx
        .select({
          id: returnItems.id,
          orderItemId: returnItems.orderItemId,
          productVariantId: returnItems.productVariantId,
          variantSku: productVariants.sku,
          variantName: productVariants.name,
          productName: products.name,
          quantity: returnItems.quantity,
          condition: returnItems.condition,
          disposition: returnItems.disposition,
          exchangeVariantId: returnItems.exchangeVariantId,
          exchangeQuantity: returnItems.exchangeQuantity,
          unitPriceMinor: returnItems.unitPriceMinor,
          notes: returnItems.notes,
          inspectedAt: returnItems.inspectedAt,
          restockedAt: returnItems.restockedAt,
          createdAt: returnItems.createdAt,
        })
        .from(returnItems)
        .innerJoin(productVariants, eq(returnItems.productVariantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(eq(returnItems.returnId, returnId), eq(returnItems.tenantId, tenantId)));

      // Fetch timeline history
      const history = await tx
        .select()
        .from(returnStatusHistory)
        .where(and(eq(returnStatusHistory.returnId, returnId), eq(returnStatusHistory.tenantId, tenantId)))
        .orderBy(desc(returnStatusHistory.createdAt));

      return {
        ...returnRecord,
        items: items.map((i) => this.serializeReturnItem(i)),
        history,
      };
    });
  }

  // ==========================================
  // CREATE RETURN
  // ==========================================

  async createReturn(tenantId: string, actorId: string, input: CreateReturnInput) {
    return withSystem(async (tx) => {
      // 1. Verify order exists
      const orderRows = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, tenantId)))
        .limit(1);

      const order = orderRows[0];
      if (!order) {
        throw new NotFoundException(`Order ${input.orderId} not found`);
      }

      // 2. Generate unique return number
      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(returns)
        .where(eq(returns.tenantId, tenantId));
      const seq = (countRes[0]?.count ?? 0) + 1;
      const returnNumber = `RET-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

      // 3. Insert return
      const newReturnRows = await tx
        .insert(returns)
        .values({
          tenantId,
          returnNumber,
          orderId: input.orderId,
          customerId: order.customerId,
          warehouseId: input.warehouseId,
          returnType: input.returnType,
          status: 'requested',
          reason: input.reason,
          notes: input.notes,
          shippingCostMinor: sql`${input.shippingCostMinor}::bigint`,
          customerDeliveryChargeRefunded: input.customerDeliveryChargeRefunded ?? false,
          refundAmountMinor: sql`0::bigint`,
          refundStatus: 'none',
          processedBy: actorId,
        })
        .returning();

      const newReturn = newReturnRows[0];
      if (!newReturn) {
        throw new BadRequestException('Failed to create return record');
      }

      // 4. Insert items
      const createdItems = [];
      for (const item of input.items) {
        const [insertedItem] = await tx
          .insert(returnItems)
          .values({
            tenantId,
            returnId: newReturn.id,
            orderItemId: item.orderItemId ?? null,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            condition: 'unknown',
            disposition: 'pending',
            exchangeVariantId: item.exchangeVariantId ?? null,
            exchangeQuantity: item.exchangeQuantity ?? 0,
            unitPriceMinor: sql`${item.unitPriceMinor}::bigint`,
            notes: item.notes ?? null,
          })
          .returning();
        createdItems.push(this.serializeReturnItem(insertedItem));
      }

      // 5. Audit history
      await tx.insert(returnStatusHistory).values({
        tenantId,
        returnId: newReturn.id,
        fromStatus: 'none',
        toStatus: 'requested',
        actorType: 'user',
        actorId,
        notes: input.notes || `Return created: ${input.returnType}`,
      });

      return {
        ...this.serializeReturn(newReturn),
        items: createdItems,
      };
    });
  }

  // ==========================================
  // RECEIVE RETURN
  // ==========================================

  async receiveReturn(tenantId: string, actorId: string, returnId: string, input: ReceiveReturnInput) {
    return withSystem(async (tx) => {
      const returnRows = await tx
        .select()
        .from(returns)
        .where(and(eq(returns.id, returnId), eq(returns.tenantId, tenantId)))
        .limit(1);

      const ret = returnRows[0];
      if (!ret) {
        throw new NotFoundException(`Return ${returnId} not found`);
      }

      const prevStatus = ret.status;

      const [updated] = await tx
        .update(returns)
        .set({
          status: 'received',
          receivedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(returns.id, returnId))
        .returning();

      await tx.insert(returnStatusHistory).values({
        tenantId,
        returnId,
        fromStatus: prevStatus,
        toStatus: 'received',
        actorType: 'user',
        actorId,
        notes: input.notes || 'Parcel received at warehouse',
      });

      return this.serializeReturn(updated);
    });
  }

  // ==========================================
  // INSPECT RETURN (GATES 1 & 2)
  // ==========================================

  async inspectReturn(tenantId: string, actorId: string, returnId: string, input: InspectReturnInput) {
    return withSystem(async (tx) => {
      const returnRows = await tx
        .select()
        .from(returns)
        .where(and(eq(returns.id, returnId), eq(returns.tenantId, tenantId)))
        .limit(1);

      const ret = returnRows[0];
      if (!ret) {
        throw new NotFoundException(`Return ${returnId} not found`);
      }

      const warehouseId = ret.warehouseId;
      const inspectedItemsResult = [];

      for (const itemInput of input.items) {
        const itemRows = await tx
          .select()
          .from(returnItems)
          .where(and(eq(returnItems.id, itemInput.itemId), eq(returnItems.tenantId, tenantId)))
          .limit(1);

        const existingItem = itemRows[0];
        if (!existingItem) {
          throw new NotFoundException(`Return item ${itemInput.itemId} not found`);
        }

        // ==========================================
        // GATE 1 SAFEGUARD: Damaged return creates NO restock movement into sellable inventory
        // ==========================================
        if (itemInput.condition === 'damaged' && itemInput.disposition === 'restock') {
          throw new BadRequestException(
            `Gate 1 Violation: Damaged item (${existingItem.productVariantId}) cannot be restocked into sellable inventory. Choose 'damage_writeoff' or 'return_to_customer'.`
          );
        }

        let isRestocked = false;

        if (itemInput.disposition === 'restock' && itemInput.condition !== 'damaged') {
          // 1. Increment onHand and available stock in warehouse
          const balanceRows = await tx
            .select()
            .from(warehouseStockBalances)
            .where(
              and(
                eq(warehouseStockBalances.tenantId, tenantId),
                eq(warehouseStockBalances.warehouseId, warehouseId),
                eq(warehouseStockBalances.variantId, existingItem.productVariantId)
              )
            )
            .limit(1);

          const b = balanceRows[0];
          if (b) {
            await tx
              .update(warehouseStockBalances)
              .set({
                onHand: b.onHand + existingItem.quantity,
                available: b.available + existingItem.quantity,
                updatedAt: sql`now()`,
              })
              .where(eq(warehouseStockBalances.id, b.id));
          } else {
            await tx.insert(warehouseStockBalances).values({
              tenantId,
              warehouseId,
              variantId: existingItem.productVariantId,
              onHand: existingItem.quantity,
              reserved: 0,
              available: existingItem.quantity,
            });
          }

          // 2. Ledger movement for customer return restock
          await tx.insert(inventoryMovements).values({
            tenantId,
            warehouseId,
            variantId: existingItem.productVariantId,
            type: 'customer_return_receipt',
            quantity: existingItem.quantity,
            referenceType: 'return',
            referenceId: returnId,
            reason: 'Inspected return restocked to sellable inventory',
            actorId,
          });

          isRestocked = true;
        } else if (itemInput.disposition === 'damage_writeoff') {
          // Gate 1: Damaged items create NO restock movement into sellable inventory.
          await tx.insert(inventoryMovements).values({
            tenantId,
            warehouseId,
            variantId: existingItem.productVariantId,
            type: 'damaged',
            quantity: 0, // NO increase to sellable inventory
            referenceType: 'return',
            referenceId: returnId,
            reason: `Damaged item written off (${itemInput.condition})`,
            actorId,
          });
        }

        // ==========================================
        // GATE 2 SAFEGUARD: Exchange creates balanced inventory movements
        // (Decrement new variant, increment returned variant if restocked)
        // ==========================================
        const exchangeVariantId = itemInput.exchangeVariantId || existingItem.exchangeVariantId;
        const exchangeQty = itemInput.exchangeQuantity ?? existingItem.exchangeQuantity;

        if (exchangeVariantId && exchangeQty > 0) {
          // Decrement replacement variant stock from warehouse
          const exBalanceRows = await tx
            .select()
            .from(warehouseStockBalances)
            .where(
              and(
                eq(warehouseStockBalances.tenantId, tenantId),
                eq(warehouseStockBalances.warehouseId, warehouseId),
                eq(warehouseStockBalances.variantId, exchangeVariantId)
              )
            )
            .limit(1);

          const eb = exBalanceRows[0];
          if (eb) {
            await tx
              .update(warehouseStockBalances)
              .set({
                onHand: eb.onHand - exchangeQty,
                available: eb.available - exchangeQty,
                updatedAt: sql`now()`,
              })
              .where(eq(warehouseStockBalances.id, eb.id));
          } else {
            await tx.insert(warehouseStockBalances).values({
              tenantId,
              warehouseId,
              variantId: exchangeVariantId,
              onHand: -exchangeQty,
              reserved: 0,
              available: -exchangeQty,
            });
          }

          // Ledger movement for replacement variant dispatch
          await tx.insert(inventoryMovements).values({
            tenantId,
            warehouseId,
            variantId: exchangeVariantId,
            type: 'fulfillment_deduction',
            quantity: -exchangeQty, // Decrement
            referenceType: 'exchange',
            referenceId: returnId,
            reason: 'Exchange replacement variant dispatched',
            actorId,
          });
        }

        // Update return item record
        const [updatedItem] = await tx
          .update(returnItems)
          .set({
            condition: itemInput.condition,
            disposition: itemInput.disposition,
            notes: itemInput.notes ?? existingItem.notes,
            exchangeVariantId: exchangeVariantId ?? null,
            exchangeQuantity: exchangeQty,
            inspectedAt: sql`now()`,
            restockedAt: isRestocked ? sql`now()` : null,
            updatedAt: sql`now()`,
          })
          .where(eq(returnItems.id, existingItem.id))
          .returning();

        inspectedItemsResult.push(this.serializeReturnItem(updatedItem));
      }

      // Update return status to inspecting
      const prevStatus = ret.status;
      const [updatedReturn] = await tx
        .update(returns)
        .set({
          status: 'inspecting',
          updatedAt: sql`now()`,
        })
        .where(eq(returns.id, returnId))
        .returning();

      await tx.insert(returnStatusHistory).values({
        tenantId,
        returnId,
        fromStatus: prevStatus,
        toStatus: 'inspecting',
        actorType: 'user',
        actorId,
        notes: input.notes || 'Inspection completed for return items',
      });

      return {
        ...this.serializeReturn(updatedReturn),
        items: inspectedItemsResult,
      };
    });
  }

  // ==========================================
  // COMPLETE RETURN
  // ==========================================

  async completeReturn(tenantId: string, actorId: string, returnId: string, input: CompleteReturnInput) {
    return withSystem(async (tx) => {
      const returnRows = await tx
        .select()
        .from(returns)
        .where(and(eq(returns.id, returnId), eq(returns.tenantId, tenantId)))
        .limit(1);

      const ret = returnRows[0];
      if (!ret) {
        throw new NotFoundException(`Return ${returnId} not found`);
      }

      const prevStatus = ret.status;

      const [completed] = await tx
        .update(returns)
        .set({
          status: 'completed',
          completedAt: sql`now()`,
          refundAmountMinor: sql`${input.refundAmountMinor}::bigint`,
          refundStatus: input.refundStatus,
          customerDeliveryChargeRefunded: input.customerDeliveryChargeRefunded ?? ret.customerDeliveryChargeRefunded,
          notes: input.notes ?? ret.notes,
          updatedAt: sql`now()`,
        })
        .where(eq(returns.id, returnId))
        .returning();

      await tx.insert(returnStatusHistory).values({
        tenantId,
        returnId,
        fromStatus: prevStatus,
        toStatus: 'completed',
        actorType: 'user',
        actorId,
        notes: input.notes || `Return completed with refund status: ${input.refundStatus}`,
      });

      return this.serializeReturn(completed);
    });
  }

  // ==========================================
  // REPORTS & RETURN RATES
  // ==========================================

  async getReturnReports(tenantId: string, filter?: ReturnReportFilter) {
    return withSystem(async (tx) => {
      // 1. Overall stats
      const allReturns = await tx
        .select({
          id: returns.id,
          returnType: returns.returnType,
          status: returns.status,
          shippingCostMinor: returns.shippingCostMinor,
          refundAmountMinor: returns.refundAmountMinor,
        })
        .from(returns)
        .where(eq(returns.tenantId, tenantId));

      const totalReturns = allReturns.length;
      const totalShippingCostMinor = allReturns.reduce((sum, r) => sum + Number(r.shippingCostMinor || 0), 0);
      const totalRefundAmountMinor = allReturns.reduce((sum, r) => sum + Number(r.refundAmountMinor || 0), 0);

      // 2. Returns by SKU / Variant
      const skuStats = await tx
        .select({
          variantId: returnItems.productVariantId,
          sku: productVariants.sku,
          variantName: productVariants.name,
          productName: products.name,
          totalReturnedQuantity: sql<number>`sum(${returnItems.quantity})::int`,
          totalRestockedQuantity: sql<number>`sum(case when ${returnItems.disposition} = 'restock' then ${returnItems.quantity} else 0 end)::int`,
          totalDamagedQuantity: sql<number>`sum(case when ${returnItems.disposition} = 'damage_writeoff' then ${returnItems.quantity} else 0 end)::int`,
        })
        .from(returnItems)
        .innerJoin(productVariants, eq(returnItems.productVariantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(returnItems.tenantId, tenantId))
        .groupBy(returnItems.productVariantId, productVariants.sku, productVariants.name, products.name);

      // 3. Returns by Courier
      const courierStats = await tx
        .select({
          courierCode: shipments.courierCode,
          totalReturns: sql<number>`count(distinct ${returns.id})::int`,
        })
        .from(returns)
        .innerJoin(shipments, eq(returns.orderId, shipments.orderId))
        .where(eq(returns.tenantId, tenantId))
        .groupBy(shipments.courierCode);

      // Total shipments count per courier for rate calculation
      const totalShipmentsByCourier = await tx
        .select({
          courierCode: shipments.courierCode,
          totalShipments: sql<number>`count(*)::int`,
        })
        .from(shipments)
        .where(eq(shipments.tenantId, tenantId))
        .groupBy(shipments.courierCode);

      const shipmentMap = new Map<string, number>();
      for (const row of totalShipmentsByCourier) {
        shipmentMap.set(row.courierCode, row.totalShipments);
      }

      const courierReport = courierStats.map((c) => {
        const total = shipmentMap.get(c.courierCode) || c.totalReturns;
        const rate = total > 0 ? Math.round((c.totalReturns / total) * 100) : 0;
        return {
          courierCode: c.courierCode,
          totalReturns: c.totalReturns,
          totalShipments: total,
          returnRatePercent: rate,
        };
      });

      // 4. Returns by District
      const districtStats = await tx
        .select({
          district: customerAddresses.district,
          totalReturns: sql<number>`count(distinct ${returns.id})::int`,
        })
        .from(returns)
        .innerJoin(orders, eq(returns.orderId, orders.id))
        .innerJoin(customerAddresses, eq(orders.customerId, customerAddresses.customerId))
        .where(eq(returns.tenantId, tenantId))
        .groupBy(customerAddresses.district)
        .orderBy(desc(sql`count(distinct ${returns.id})`))
        .limit(10);

      return {
        summary: {
          totalReturns,
          totalShippingCostMinor,
          totalRefundAmountMinor,
          totalShippingCostBdt: Math.round(totalShippingCostMinor / 100),
          totalRefundAmountBdt: Math.round(totalRefundAmountMinor / 100),
        },
        bySku: skuStats,
        byCourier: courierReport,
        byDistrict: districtStats,
      };
    });
  }
}
