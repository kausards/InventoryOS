import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  withSystem,
  orders,
  orderItems,
  orderStatusHistory,
  orderSequences,
  customers,
  customerAddresses,
  warehouses,
  productVariants,
  products,
  auditLogs,
} from '@growthomic/db';
import { eq, and, sql, or, ilike, desc } from 'drizzle-orm';
import {
  normalizeBdPhone,
  canTransition,
  OrderStatus,
} from '@growthomic/shared';
import type {
  CreateOrderInput,
  TransitionOrderStatusInput,
  CancelOrderInput,
  HoldOrderInput,
  BulkOrderActionInput,
} from '@growthomic/shared';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrdersService {
  constructor(private readonly inventoryService: InventoryService) {}

  async listOrders(
    tenantId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      source?: string;
      customerId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    return withSystem(async (tx) => {
      const page = Math.max(1, query.page ? Number(query.page) : 1);
      const limit = Math.max(1, Math.min(100, query.limit ? Number(query.limit) : 20));
      const offset = (page - 1) * limit;

      const conditions: any[] = [eq(orders.tenantId, tenantId)];

      if (query.status && query.status !== 'all') {
        conditions.push(eq(orders.orderStatus, query.status));
      }

      if (query.source && query.source !== 'all') {
        conditions.push(eq(orders.source, query.source));
      }

      if (query.customerId) {
        conditions.push(eq(orders.customerId, query.customerId));
      }

      if (query.startDate) {
        conditions.push(sql`${orders.createdAt} >= ${query.startDate}`);
      }

      if (query.endDate) {
        conditions.push(sql`${orders.createdAt} <= ${query.endDate}`);
      }

      if (query.search?.trim()) {
        const searchTerm = `%${query.search.trim()}%`;
        conditions.push(
          or(
            ilike(orders.orderNumber, searchTerm),
            ilike(customers.name, searchTerm),
            ilike(customers.phone, searchTerm),
            ilike(customers.normalizedPhone, searchTerm)
          )
        );
      }

      const rows = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          orderSequence: orders.orderSequence,
          customerId: orders.customerId,
          warehouseId: orders.warehouseId,
          source: orders.source,
          sourceReference: orders.sourceReference,
          orderStatus: orders.orderStatus,
          paymentStatus: orders.paymentStatus,
          shipmentStatus: orders.shipmentStatus,
          subtotalMinor: orders.subtotalMinor,
          discountMinor: orders.discountMinor,
          deliveryChargeMinor: orders.deliveryChargeMinor,
          totalAmountMinor: orders.totalAmountMinor,
          currency: orders.currency,
          paymentMethod: orders.paymentMethod,
          isDuplicateWarning: orders.isDuplicateWarning,
          createdAt: orders.createdAt,
          customerName: customers.name,
          customerPhone: customers.phone,
        })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset);

      const totalRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .where(and(...conditions));

      const total = totalRes[0]?.count ?? 0;

      // Fetch item summaries for the orders
      const orderIds = rows.map((r) => r.id);
      const items = orderIds.length > 0
        ? await tx
            .select({
              orderId: orderItems.orderId,
              productName: orderItems.productName,
              variantName: orderItems.variantName,
              quantity: orderItems.quantity,
            })
            .from(orderItems)
            .where(
              and(
                eq(orderItems.tenantId, tenantId),
                sql`${orderItems.orderId} IN ${orderIds}`
              )
            )
        : [];

      const enriched = rows.map((o) => {
        const ordItems = items.filter((i) => i.orderId === o.id);
        const itemCount = ordItems.reduce((acc, curr) => acc + curr.quantity, 0);
        const itemSummary = ordItems.map((i) => `${i.productName} (${i.quantity})`).join(', ');

        return {
          ...o,
          subtotalMinor: o.subtotalMinor.toString(),
          discountMinor: o.discountMinor.toString(),
          deliveryChargeMinor: o.deliveryChargeMinor.toString(),
          totalAmountMinor: o.totalAmountMinor.toString(),
          itemCount,
          itemSummary,
        };
      });

      return {
        items: enriched,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async getOrderSummary(tenantId: string) {
    return withSystem(async (tx) => {
      const summaryRows = await tx
        .select({
          status: orders.orderStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(eq(orders.tenantId, tenantId))
        .groupBy(orders.orderStatus);

      const counts: Record<string, number> = {
        all: 0,
        pending: 0,
        confirmed: 0,
        processing: 0,
        ready_to_ship: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        on_hold: 0,
        returned: 0,
      };

      let totalAll = 0;
      for (const row of summaryRows) {
        counts[row.status] = row.count;
        totalAll += row.count;
      }
      counts['all'] = totalAll;

      return counts;
    });
  }

  async getOrderById(tenantId: string, orderId: string) {
    return withSystem(async (tx) => {
      const orderRow = (
        await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!orderRow) {
        throw new NotFoundException('Order not found');
      }

      // Customer and address details
      const customer = (
        await tx
          .select()
          .from(customers)
          .where(eq(customers.id, orderRow.customerId))
          .limit(1)
      )[0];

      const address = (
        await tx
          .select()
          .from(customerAddresses)
          .where(eq(customerAddresses.customerId, orderRow.customerId))
          .limit(1)
      )[0];

      // Items
      const items = await tx
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, orderId)));

      // Status Timeline History
      const timeline = await tx
        .select()
        .from(orderStatusHistory)
        .where(and(eq(orderStatusHistory.tenantId, tenantId), eq(orderStatusHistory.orderId, orderId)))
        .orderBy(desc(orderStatusHistory.createdAt));

      return {
        ...orderRow,
        subtotalMinor: orderRow.subtotalMinor.toString(),
        discountMinor: orderRow.discountMinor.toString(),
        deliveryChargeMinor: orderRow.deliveryChargeMinor.toString(),
        totalAmountMinor: orderRow.totalAmountMinor.toString(),
        customer: customer
          ? {
              ...customer,
              totalSpentMinor: customer.totalSpentMinor.toString(),
              address: address ?? null,
            }
          : null,
        items: items.map((i) => ({
          ...i,
          unitPriceMinor: i.unitPriceMinor.toString(),
          totalPriceMinor: i.totalPriceMinor.toString(),
          unitCostMinor: i.unitCostMinor.toString(),
        })),
        timeline,
      };
    });
  }

  async createOrder(
    tenantId: string,
    actorId: string,
    dto: CreateOrderInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      // 1. Resolve Warehouse (use provided or default)
      let warehouseId = dto.warehouseId;
      if (!warehouseId) {
        const defaultWh = (
          await tx
            .select({ id: warehouses.id })
            .from(warehouses)
            .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.isDefault, true)))
            .limit(1)
        )[0];
        if (!defaultWh) {
          throw new BadRequestException('No default warehouse configured for tenant');
        }
        warehouseId = defaultWh.id;
      }

      // 2. Resolve Customer (lookup existing or create new)
      let customerId = dto.customerId;
      let customerNormalizedPhone = '';

      if (dto.customer) {
        const norm = normalizeBdPhone(dto.customer.phone);
        customerNormalizedPhone = norm.isValid ? norm.e164 : dto.customer.phone.trim();

        // Check if customer already exists by phone
        const existingCust = (
          await tx
            .select()
            .from(customers)
            .where(
              and(
                eq(customers.tenantId, tenantId),
                eq(customers.normalizedPhone, customerNormalizedPhone)
              )
            )
            .limit(1)
        )[0];

        if (existingCust) {
          customerId = existingCust.id;
          // Optionally update name if blank
          if (!existingCust.name && dto.customer.name) {
            await tx
              .update(customers)
              .set({ name: dto.customer.name })
              .where(eq(customers.id, existingCust.id));
          }
        } else {
          // Create new customer
          const newCust = (
            await tx
              .insert(customers)
              .values({
                tenantId,
                name: dto.customer.name,
                phone: dto.customer.phone,
                normalizedPhone: customerNormalizedPhone,
              })
              .returning()
          )[0]!;
          customerId = newCust.id;

          // Add address
          if (dto.customer.address) {
            await tx.insert(customerAddresses).values({
              tenantId,
              customerId: newCust.id,
              label: dto.customer.address.label ?? 'Home',
              division: dto.customer.address.division,
              district: dto.customer.address.district,
              upazilaThana: dto.customer.address.upazilaThana ?? null,
              area: dto.customer.address.area ?? null,
              streetAddress: dto.customer.address.streetAddress,
              isDefault: true,
            });
          }
        }
      } else if (customerId) {
        const existingCust = (
          await tx
            .select()
            .from(customers)
            .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
            .limit(1)
        )[0];
        if (!existingCust) {
          throw new NotFoundException('Specified customer not found');
        }
        customerNormalizedPhone = existingCust.normalizedPhone;
      }

      if (!customerId) {
        throw new BadRequestException('Could not resolve or create customer');
      }

      // 3. Duplicate Order Detection (same normalized phone within 24 hours)
      let isDuplicateWarning = false;
      let duplicateOfOrderId: string | null = null;

      if (customerNormalizedPhone) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recentOrders = await tx
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
          })
          .from(orders)
          .innerJoin(customers, eq(orders.customerId, customers.id))
          .where(
            and(
              eq(orders.tenantId, tenantId),
              eq(customers.normalizedPhone, customerNormalizedPhone),
              sql`${orders.createdAt} >= ${twentyFourHoursAgo}`,
              or(
                eq(orders.orderStatus, 'pending'),
                eq(orders.orderStatus, 'confirmed'),
                eq(orders.orderStatus, 'processing')
              )
            )
          )
          .limit(1);

        if (recentOrders[0]) {
          isDuplicateWarning = true;
          duplicateOfOrderId = recentOrders[0].id;
        }
      }

      // 4. Generate Order Number (Atomic Sequence)
      let seq = (
        await tx
          .select()
          .from(orderSequences)
          .where(eq(orderSequences.tenantId, tenantId))
          .for('update')
          .limit(1)
      )[0];

      let nextSequenceNumber = 1001;
      let prefix = 'ORD-';

      if (!seq) {
        seq = (
          await tx
            .insert(orderSequences)
            .values({
              tenantId,
              prefix: 'ORD-',
              lastNumber: 1001,
            })
            .returning()
        )[0]!;
      } else {
        nextSequenceNumber = seq.lastNumber + 1;
        prefix = seq.prefix;
        await tx
          .update(orderSequences)
          .set({
            lastNumber: nextSequenceNumber,
            updatedAt: sql`now()`,
          })
          .where(eq(orderSequences.tenantId, tenantId));
      }

      const orderNumber = `${prefix}${nextSequenceNumber}`;

      // 5. Calculate Financials and Snapshot Item Costs
      let subtotalMinor = BigInt(0);
      const itemsToInsert: any[] = [];

      for (const item of dto.items) {
        // Fetch variant details
        const variantRow = (
          await tx
            .select({
              id: productVariants.id,
              name: productVariants.name,
              sku: productVariants.sku,
              retailPrice: productVariants.retailPrice,
              purchaseCost: productVariants.purchaseCost,
              productId: productVariants.productId,
              productName: products.name,
            })
            .from(productVariants)
            .innerJoin(products, eq(productVariants.productId, products.id))
            .where(
              and(
                eq(productVariants.id, item.variantId),
                eq(productVariants.tenantId, tenantId)
              )
            )
            .limit(1)
        )[0];

        if (!variantRow) {
          throw new NotFoundException(`Variant with ID ${item.variantId} not found`);
        }

        const unitPriceMinor = BigInt(item.unitPrice);
        const totalPriceMinor = unitPriceMinor * BigInt(item.quantity);
        subtotalMinor += totalPriceMinor;

        itemsToInsert.push({
          tenantId,
          productId: variantRow.productId,
          variantId: variantRow.id,
          productName: variantRow.productName,
          variantName: variantRow.name,
          sku: variantRow.sku,
          quantity: item.quantity,
          unitPriceMinor,
          totalPriceMinor,
          unitCostMinor: variantRow.purchaseCost ?? BigInt(0), // snapshot
        });
      }

      const discountMinor = BigInt(dto.discount ?? 0);
      const deliveryChargeMinor = BigInt(dto.deliveryCharge ?? 0);
      const totalAmountMinor = subtotalMinor - discountMinor + deliveryChargeMinor;

      const initialStatus: OrderStatus = dto.confirmImmediately ? 'confirmed' : 'pending';

      // 6. Insert Order
      const newOrder = (
        await tx
          .insert(orders)
          .values({
            tenantId,
            orderNumber,
            orderSequence: nextSequenceNumber,
            customerId,
            warehouseId,
            source: dto.source ?? 'manual',
            sourceReference: dto.sourceReference ?? null,
            orderStatus: initialStatus,
            paymentStatus: 'unpaid',
            shipmentStatus: 'unfulfilled',
            subtotalMinor,
            discountMinor,
            deliveryChargeMinor,
            totalAmountMinor,
            currency: 'BDT',
            paymentMethod: dto.paymentMethod ?? 'cod',
            customerNotes: dto.customerNotes ?? null,
            internalNotes: dto.internalNotes ?? null,
            isDuplicateWarning,
            duplicateOfOrderId,
            confirmedAt: dto.confirmImmediately ? sql`now()` : null,
          })
          .returning()
      )[0]!;

      // 7. Insert Order Items
      for (const item of itemsToInsert) {
        await tx.insert(orderItems).values({
          ...item,
          orderId: newOrder.id,
        });
      }

      // 8. Order Status History Timeline
      await tx.insert(orderStatusHistory).values({
        tenantId,
        orderId: newOrder.id,
        fromStatus: 'none',
        toStatus: initialStatus,
        actorType: 'user',
        actorId,
        reason: dto.confirmImmediately ? 'Auto-confirmed on creation' : 'Order placed',
        notes: null,
      });

      // 9. Update Customer aggregates
      await tx
        .update(customers)
        .set({
          totalOrders: sql`${customers.totalOrders} + 1`,
          totalSpentMinor: sql`${customers.totalSpentMinor} + ${totalAmountMinor}`,
          updatedAt: sql`now()`,
        })
        .where(eq(customers.id, customerId));

      // 10. Audit Log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'order.create',
        entityType: 'order',
        entityId: newOrder.id,
        after: {
          orderNumber,
          totalAmount: totalAmountMinor.toString(),
          itemsCount: dto.items.length,
          isDuplicateWarning,
        },
        requestId: requestId ?? null,
      });

      // 11. Reserve Stock if confirmImmediately is true
      if (dto.confirmImmediately) {
        for (const item of dto.items) {
          await this.inventoryService.reserveStock(
            tenantId,
            actorId,
            {
              warehouseId,
              variantId: item.variantId,
              quantity: item.quantity,
              referenceType: 'order',
              referenceId: newOrder.id,
            },
            requestId
          );
        }
      }

      return {
        ...newOrder,
        subtotalMinor: newOrder.subtotalMinor.toString(),
        discountMinor: newOrder.discountMinor.toString(),
        deliveryChargeMinor: newOrder.deliveryChargeMinor.toString(),
        totalAmountMinor: newOrder.totalAmountMinor.toString(),
      };
    });
  }

  async transitionStatus(
    tenantId: string,
    actorId: string,
    orderId: string,
    dto: TransitionOrderStatusInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const orderRow = (
        await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
          .for('update')
          .limit(1)
      )[0];

      if (!orderRow) {
        throw new NotFoundException('Order not found');
      }

      const currentStatus = orderRow.orderStatus as OrderStatus;
      const targetStatus = dto.toStatus as OrderStatus;

      if (!canTransition(currentStatus, targetStatus)) {
        throw new BadRequestException(
          `Invalid state transition: Cannot transition order ${orderRow.orderNumber} from '${currentStatus}' to '${targetStatus}'`
        );
      }

      // Fetch items for stock reservation or release
      const items = await tx
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, orderId)));

      const updateData: any = {
        orderStatus: targetStatus,
        updatedAt: sql`now()`,
      };

      if (dto.reason) {
        if (targetStatus === 'cancelled') updateData.cancelReason = dto.reason;
        if (targetStatus === 'on_hold') updateData.holdReason = dto.reason;
      }

      if (targetStatus === 'confirmed') {
        updateData.confirmedAt = sql`now()`;
        // Reserve stock
        for (const item of items) {
          await this.inventoryService.reserveStock(
            tenantId,
            actorId,
            {
              warehouseId: orderRow.warehouseId,
              variantId: item.variantId,
              quantity: item.quantity,
              referenceType: 'order',
              referenceId: orderId,
            },
            requestId
          );
        }
      } else if (targetStatus === 'cancelled') {
        updateData.cancelledAt = sql`now()`;
        // Release reservation if stock was previously reserved
        if (['confirmed', 'processing', 'ready_to_ship'].includes(currentStatus)) {
          for (const item of items) {
            await this.inventoryService.releaseReservation(
              tenantId,
              actorId,
              {
                warehouseId: orderRow.warehouseId,
                variantId: item.variantId,
                quantity: item.quantity,
                referenceType: 'order',
                referenceId: orderId,
              },
              requestId
            );
          }
        }
        // Increment customer cancelled count
        await tx
          .update(customers)
          .set({ cancelledOrders: sql`${customers.cancelledOrders} + 1` })
          .where(eq(customers.id, orderRow.customerId));
      } else if (targetStatus === 'delivered') {
        updateData.deliveredAt = sql`now()`;
        updateData.paymentStatus = 'paid';
        updateData.shipmentStatus = 'delivered';
        // Increment customer delivered count
        await tx
          .update(customers)
          .set({ deliveredOrders: sql`${customers.deliveredOrders} + 1` })
          .where(eq(customers.id, orderRow.customerId));
      } else if (targetStatus === 'shipped') {
        updateData.shippedAt = sql`now()`;
        updateData.shipmentStatus = 'in_transit';
      }

      // Update Order
      const updated = (
        await tx
          .update(orders)
          .set(updateData)
          .where(eq(orders.id, orderId))
          .returning()
      )[0]!;

      // Record Timeline Entry
      await tx.insert(orderStatusHistory).values({
        tenantId,
        orderId,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        actorType: 'user',
        actorId,
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
      });

      // Audit Log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'order.status_transition',
        entityType: 'order',
        entityId: orderId,
        before: { orderStatus: currentStatus },
        after: { orderStatus: targetStatus, reason: dto.reason },
        requestId: requestId ?? null,
      });

      return {
        ...updated,
        subtotalMinor: updated.subtotalMinor.toString(),
        discountMinor: updated.discountMinor.toString(),
        deliveryChargeMinor: updated.deliveryChargeMinor.toString(),
        totalAmountMinor: updated.totalAmountMinor.toString(),
      };
    });
  }

  async cancelOrder(
    tenantId: string,
    actorId: string,
    orderId: string,
    dto: CancelOrderInput,
    requestId?: string
  ) {
    return this.transitionStatus(
      tenantId,
      actorId,
      orderId,
      {
        toStatus: 'cancelled',
        reason: dto.reason,
        notes: dto.notes,
      },
      requestId
    );
  }

  async holdOrder(
    tenantId: string,
    actorId: string,
    orderId: string,
    dto: HoldOrderInput,
    requestId?: string
  ) {
    return this.transitionStatus(
      tenantId,
      actorId,
      orderId,
      {
        toStatus: 'on_hold',
        reason: dto.reason,
        notes: dto.notes,
      },
      requestId
    );
  }

  async bulkActions(
    tenantId: string,
    actorId: string,
    dto: BulkOrderActionInput,
    requestId?: string
  ) {
    const results: Array<{ orderId: string; success: boolean; error?: string }> = [];

    const targetStatusMap: Record<string, OrderStatus> = {
      confirm: 'confirmed',
      hold: 'on_hold',
      cancel: 'cancelled',
    };

    const targetStatus = targetStatusMap[dto.action];
    if (!targetStatus) {
      throw new BadRequestException(`Unsupported bulk action: ${dto.action}`);
    }

    for (const orderId of dto.orderIds) {
      try {
        await this.transitionStatus(
          tenantId,
          actorId,
          orderId,
          {
            toStatus: targetStatus,
            reason: dto.reason ?? `Bulk ${dto.action}`,
          },
          requestId
        );
        results.push({ orderId, success: true });
      } catch (err: any) {
        results.push({ orderId, success: false, error: err.message });
      }
    }

    return {
      action: dto.action,
      processed: results.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    };
  }
}
