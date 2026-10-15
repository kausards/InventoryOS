import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  withSystem,
  courierAccounts,
  shipments,
  shipmentEvents,
  courierSettlements,
  courierSettlementAllocations,
  orders,
  orderStatusHistory,
  customers,
  customerAddresses,
  auditLogs,
} from '@growthomic/db';
import { eq, and, sql, desc, notInArray } from 'drizzle-orm';
import * as crypto from 'crypto';
import {
  encryptCourierCredentials,
  decryptCourierCredentials,
  maskCourierCredentials,
  canTransitionShipmentStatus,
  NormalizedShipmentStatus,
  CreateCourierAccountInput,
  UpdateCourierAccountInput,
  SendToCourierInput,
  CreateSettlementInput,
  CourierFraudCheckResult,
} from '@growthomic/shared';
import { SteadfastAdapter } from './adapters/steadfast.adapter';
import { PathaoAdapter } from './adapters/pathao.adapter';

export interface ReconcileShipmentInput {
  action: 'confirm_found' | 'mark_cancelled';
  consignmentId?: string;
  trackingCode?: string;
  note?: string;
}

@Injectable()
export class CouriersService {
  /**
   * Helper to initialize appropriate adapter instance for an account.
   */
  private getAdapterForAccount(account: typeof courierAccounts.$inferSelect) {
    const rawCreds = decryptCourierCredentials(account.encryptedCredentials);
    const parsedCreds = JSON.parse(rawCreds);

    switch (account.courierCode) {
      case 'pathao':
        return new PathaoAdapter({
          clientId: parsedCreds.clientId || parsedCreds.apiKey || '',
          clientSecret: parsedCreds.clientSecret || parsedCreds.secretKey || '',
          username: parsedCreds.username || '',
          password: parsedCreds.password || '',
          storeId: parsedCreds.storeId,
          baseUrl: parsedCreds.baseUrl,
          testMode: account.testMode,
        });
      case 'steadfast':
      default:
        return new SteadfastAdapter({
          apiKey: parsedCreds.apiKey,
          secretKey: parsedCreds.secretKey,
          baseUrl: parsedCreds.baseUrl,
        });
    }
  }

  /**
   * Helper to format account with Gate 4 masked credentials.
   */
  private maskAccount(account: typeof courierAccounts.$inferSelect) {
    let masked = { apiKey: '******', secretKey: '******' };
    try {
      const rawCreds = decryptCourierCredentials(account.encryptedCredentials);
      masked = maskCourierCredentials(JSON.parse(rawCreds)) as { apiKey: string; secretKey: string };
    } catch {
      // fallback to masked
    }

    const { encryptedCredentials, ...rest } = account;
    return {
      ...rest,
      maskedCredentials: masked,
    };
  }

  // ==========================================
  // COURIER ACCOUNT MANAGEMENT
  // ==========================================

  async getAccounts(tenantId: string) {
    return withSystem(async (tx) => {
      const rows = await tx
        .select()
        .from(courierAccounts)
        .where(eq(courierAccounts.tenantId, tenantId))
        .orderBy(desc(courierAccounts.isDefault), desc(courierAccounts.createdAt));

      return rows.map((r) => this.maskAccount(r));
    });
  }

  async getAccountById(tenantId: string, id: string) {
    return withSystem(async (tx) => {
      const row = (
        await tx
          .select()
          .from(courierAccounts)
          .where(and(eq(courierAccounts.id, id), eq(courierAccounts.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!row) {
        throw new NotFoundException('Courier account not found');
      }

      return this.maskAccount(row);
    });
  }

  async createAccount(tenantId: string, input: CreateCourierAccountInput) {
    const credentialsToEncrypt = JSON.stringify({
      apiKey: input.apiKey,
      secretKey: input.secretKey,
    });
    const encryptedCredentials = encryptCourierCredentials(credentialsToEncrypt);

    return withSystem(async (tx) => {
      if (input.isDefault) {
        await tx
          .update(courierAccounts)
          .set({ isDefault: false })
          .where(eq(courierAccounts.tenantId, tenantId));
      }

      const inserted = (
        await tx
          .insert(courierAccounts)
          .values({
            tenantId,
            courierCode: input.courierCode,
            accountName: input.accountName,
            encryptedCredentials,
            senderName: input.senderName,
            senderPhone: input.senderPhone,
            senderAddress: input.senderAddress,
            isDefault: input.isDefault ?? false,
            testMode: input.testMode ?? false,
            isActive: true,
          })
          .returning()
      )[0];

      if (!inserted) {
        throw new BadRequestException('Failed to create courier account');
      }

      return this.maskAccount(inserted);
    });
  }

  async updateAccount(tenantId: string, id: string, input: UpdateCourierAccountInput) {
    return withSystem(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(courierAccounts)
          .where(and(eq(courierAccounts.id, id), eq(courierAccounts.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!existing) {
        throw new NotFoundException('Courier account not found');
      }

      let encryptedCredentials = existing.encryptedCredentials;
      if (input.apiKey || input.secretKey) {
        let currentCreds: any = {};
        try {
          currentCreds = JSON.parse(decryptCourierCredentials(existing.encryptedCredentials));
        } catch {
          currentCreds = {};
        }

        const updatedCreds = {
          apiKey: input.apiKey ?? currentCreds.apiKey,
          secretKey: input.secretKey ?? currentCreds.secretKey,
        };
        encryptedCredentials = encryptCourierCredentials(JSON.stringify(updatedCreds));
      }

      if (input.isDefault) {
        await tx
          .update(courierAccounts)
          .set({ isDefault: false })
          .where(eq(courierAccounts.tenantId, tenantId));
      }

      const updated = (
        await tx
          .update(courierAccounts)
          .set({
            ...(input.accountName !== undefined && { accountName: input.accountName }),
            ...(input.senderName !== undefined && { senderName: input.senderName }),
            ...(input.senderPhone !== undefined && { senderPhone: input.senderPhone }),
            ...(input.senderAddress !== undefined && { senderAddress: input.senderAddress }),
            ...(input.isActive !== undefined && { isActive: input.isActive }),
            ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
            ...(input.testMode !== undefined && { testMode: input.testMode }),
            encryptedCredentials,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(courierAccounts.id, id))
          .returning()
      )[0];

      if (!updated) {
        throw new NotFoundException('Courier account not found');
      }

      return this.maskAccount(updated);
    });
  }

  async testConnection(tenantId: string, id: string) {
    return withSystem(async (tx) => {
      const account = (
        await tx
          .select()
          .from(courierAccounts)
          .where(and(eq(courierAccounts.id, id), eq(courierAccounts.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!account) {
        throw new NotFoundException('Courier account not found');
      }

      const adapter = this.getAdapterForAccount(account);
      const testResult = await adapter.testConnection();

      await tx
        .update(courierAccounts)
        .set({
          lastConnectionTestAt: new Date().toISOString(),
          lastConnectionStatus: testResult.success ? 'connected' : 'failed',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(courierAccounts.id, id));

      return testResult;
    });
  }

  async getBalance(tenantId: string, id: string) {
    return withSystem(async (tx) => {
      const account = (
        await tx
          .select()
          .from(courierAccounts)
          .where(and(eq(courierAccounts.id, id), eq(courierAccounts.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!account) {
        throw new NotFoundException('Courier account not found');
      }

      const adapter = this.getAdapterForAccount(account);
      return adapter.getBalance();
    });
  }

  // ==========================================
  // DISPATCH & SHIPMENT CREATION (GATE 1 SAFETY)
  // ==========================================

  async sendOrderToCourier(tenantId: string, actorId: string, input: SendToCourierInput) {
    return withSystem(async (tx) => {
      // 1. Fetch Order and Customer
      const order = (
        await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.orderStatus === 'cancelled') {
        throw new BadRequestException('Cannot dispatch a cancelled order');
      }

      const customer = (
        await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, order.customerId), eq(customers.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!customer) {
        throw new NotFoundException('Customer details not found for order');
      }

      // 2. Prevent duplicate active shipments
      const activeShipment = (
        await tx
          .select()
          .from(shipments)
          .where(
            and(
              eq(shipments.tenantId, tenantId),
              eq(shipments.orderId, input.orderId),
              notInArray(shipments.shipmentStatus, ['cancelled', 'returned', 'failed'])
            )
          )
          .limit(1)
      )[0];

      if (activeShipment) {
        throw new BadRequestException(
          `An active shipment (${activeShipment.shipmentStatus}) already exists for this order. Tracking Code: ${activeShipment.trackingCode || 'N/A'}. Cancel it before re-dispatching.`
        );
      }

      // 3. Resolve courier account
      const account = (
        await tx
          .select()
          .from(courierAccounts)
          .where(and(eq(courierAccounts.id, input.courierAccountId), eq(courierAccounts.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!account || !account.isActive) {
        throw new BadRequestException('Selected courier account is not active or does not exist');
      }

      const adapter = this.getAdapterForAccount(account);
      const codAmountTaka = Number(order.totalAmountMinor) / 100;

      // Resolve address from customerAddresses table
      const defaultAddr = (
        await tx
          .select()
          .from(customerAddresses)
          .where(and(eq(customerAddresses.customerId, customer.id), eq(customerAddresses.tenantId, tenantId)))
          .orderBy(desc(customerAddresses.isDefault))
          .limit(1)
      )[0];

      const recipientAddress = defaultAddr
        ? `${defaultAddr.streetAddress}, ${defaultAddr.upazilaThana ? defaultAddr.upazilaThana + ', ' : ''}${defaultAddr.district}, ${defaultAddr.division}`
        : 'Dhaka, Bangladesh';

      const operationId = input.operationId || crypto.randomUUID();

      // 4. Dispatch to courier with Gate 1 timeout safety
      const dispatchResult = await adapter.createOrder({
        invoice: order.orderNumber,
        recipientName: customer.name,
        recipientPhone: customer.phone,
        recipientAddress,
        codAmount: codAmountTaka,
        note: input.notes || order.customerNotes || '',
        operationId,
      });

      const now = new Date().toISOString();

      // GATE 1: Handle ambiguous timeout
      if (dispatchResult.isAmbiguousTimeout) {
        const timeoutShipment = (
          await tx
            .insert(shipments)
            .values({
              tenantId,
              orderId: order.id,
              courierAccountId: account.id,
              courierCode: account.courierCode,
              operationId,
              shipmentStatus: 'unknown_pending_reconciliation',
              recipientName: customer.name,
              recipientPhone: customer.phone,
              recipientAddress,
              recipientDivision: defaultAddr?.division,
              recipientDistrict: defaultAddr?.district,
              codAmountMinor: order.totalAmountMinor,
              instructions: input.notes,
              rawResponse: { error: dispatchResult.errorMessage, isAmbiguousTimeout: true },
            })
            .returning()
        )[0];

        if (!timeoutShipment) {
          throw new BadRequestException('Failed to record timeout shipment');
        }

        // Append initial audit event
        await tx.insert(shipmentEvents).values({
          tenantId,
          shipmentId: timeoutShipment.id,
          providerStatus: 'NETWORK_TIMEOUT',
          normalizedStatus: 'unknown_pending_reconciliation',
          note: 'Ambiguous timeout during courier dispatch. Reconciliation required before retry to prevent duplicate consignment.',
          rawData: { errorMessage: dispatchResult.errorMessage },
        });

        // Flag order as unknown_pending_reconciliation
        await tx
          .update(orders)
          .set({
            shipmentStatus: 'unknown_pending_reconciliation',
            updatedAt: now,
          })
          .where(eq(orders.id, order.id));

        return {
          success: false,
          isAmbiguousTimeout: true,
          shipment: timeoutShipment,
          message: 'Courier request timed out ambiguously. Shipment placed in reconciliation state to prevent duplicate delivery.',
        };
      }

      if (!dispatchResult.success) {
        throw new BadRequestException(
          `Courier dispatch failed: ${dispatchResult.errorMessage || 'Unknown provider error'}`
        );
      }

      // 5. Successful dispatch
      const shipment = (
        await tx
          .insert(shipments)
          .values({
            tenantId,
            orderId: order.id,
            courierAccountId: account.id,
            courierCode: account.courierCode,
            consignmentId: dispatchResult.consignmentId,
            trackingCode: dispatchResult.trackingCode,
            operationId,
            shipmentStatus: 'pending',
            recipientName: customer.name,
            recipientPhone: customer.phone,
            recipientAddress,
            recipientDivision: defaultAddr?.division,
            recipientDistrict: defaultAddr?.district,
            codAmountMinor: order.totalAmountMinor,
            instructions: input.notes,
            rawResponse: dispatchResult.rawResponse,
            shippedAt: now,
          })
          .returning()
      )[0];

      if (!shipment) {
        throw new BadRequestException('Failed to record shipment');
      }

      // Append event
      await tx.insert(shipmentEvents).values({
        tenantId,
        shipmentId: shipment.id,
        providerStatus: 'ORDER_CREATED',
        normalizedStatus: 'pending',
        note: `Order dispatched to ${account.courierCode.toUpperCase()} courier. Consignment ID: ${dispatchResult.consignmentId || 'N/A'}, Tracking: ${dispatchResult.trackingCode || 'N/A'}`,
        rawData: dispatchResult.rawResponse,
      });

      // Update Order status
      await tx
        .update(orders)
        .set({
          orderStatus: order.orderStatus === 'pending' ? 'confirmed' : order.orderStatus,
          shipmentStatus: 'in_transit',
          shippedAt: now,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));

      // Append order status history
      await tx.insert(orderStatusHistory).values({
        tenantId,
        orderId: order.id,
        fromStatus: order.orderStatus,
        toStatus: order.orderStatus === 'pending' ? 'confirmed' : order.orderStatus,
        actorType: 'user',
        actorId,
        notes: `Dispatched to courier ${account.courierCode} (${dispatchResult.trackingCode})`,
      });

      // Audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'dispatch_courier',
        entityType: 'shipment',
        entityId: shipment.id,
        after: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          courierCode: account.courierCode,
          consignmentId: dispatchResult.consignmentId,
          trackingCode: dispatchResult.trackingCode,
        },
      });

      return {
        success: true,
        isAmbiguousTimeout: false,
        shipment,
        message: 'Order successfully sent to courier.',
      };
    });
  }

  // ==========================================
  // TRACKING & GATE 2 TERMINAL STATE PROTECT
  // ==========================================

  async trackShipment(tenantId: string, shipmentId: string) {
    return withSystem(async (tx) => {
      const shipment = (
        await tx
          .select()
          .from(shipments)
          .where(and(eq(shipments.id, shipmentId), eq(shipments.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!shipment) {
        throw new NotFoundException('Shipment record not found');
      }

      const account = (
        await tx
          .select()
          .from(courierAccounts)
          .where(and(eq(courierAccounts.id, shipment.courierAccountId), eq(courierAccounts.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!account) {
        throw new NotFoundException('Courier account associated with shipment not found');
      }

      const adapter = this.getAdapterForAccount(account);
      let trackingResult;
      if (shipment.trackingCode) {
        trackingResult = await adapter.trackByTrackingCode(shipment.trackingCode);
      } else if (shipment.consignmentId) {
        trackingResult = await adapter.trackByConsignmentId(shipment.consignmentId);
      } else {
        throw new BadRequestException('Shipment does not have consignmentId or trackingCode');
      }

      const currentStatus = shipment.shipmentStatus as NormalizedShipmentStatus;
      const newStatus = trackingResult.normalizedStatus;
      const now = new Date().toISOString();

      // Gate 2: Terminal State regression check
      const canTransition = canTransitionShipmentStatus(currentStatus, newStatus);

      // Append event unconditionally for full audit trail
      await tx.insert(shipmentEvents).values({
        tenantId,
        shipmentId: shipment.id,
        providerStatus: trackingResult.providerStatus,
        normalizedStatus: newStatus,
        eventTimestamp: trackingResult.statusTimestamp || now,
        note: canTransition
          ? `Status updated: ${newStatus}`
          : `Blocked out-of-order status regression from terminal '${currentStatus}' to '${newStatus}'`,
        rawData: trackingResult.rawResponse,
      });

      if (canTransition && currentStatus !== newStatus) {
        const updateFields: any = {
          shipmentStatus: newStatus,
          updatedAt: now,
        };

        if (newStatus === 'delivered') {
          updateFields.deliveredAt = now;
        } else if (newStatus === 'returned') {
          updateFields.returnedAt = now;
        }

        await tx.update(shipments).set(updateFields).where(eq(shipments.id, shipment.id));

        // Update corresponding order
        const orderShipmentMap: Record<string, string> = {
          delivered: 'delivered',
          partially_delivered: 'delivered',
          returned: 'returned',
          failed: 'failed',
          cancelled: 'cancelled',
          in_transit: 'in_transit',
          out_for_delivery: 'in_transit',
        };

        const mappedOrderShipmentStatus = orderShipmentMap[newStatus];
        if (mappedOrderShipmentStatus) {
          await tx
            .update(orders)
            .set({
              shipmentStatus: mappedOrderShipmentStatus,
              ...(newStatus === 'delivered' && {
                orderStatus: 'delivered',
                deliveredAt: now,
                paymentStatus: 'paid', // Cash on Delivery fulfilled
              }),
              ...(newStatus === 'returned' && { orderStatus: 'returned' }),
              updatedAt: now,
            })
            .where(eq(orders.id, shipment.orderId));
        }
      }

      // Return updated shipment along with events timeline
      const updatedShipment = (
        await tx
          .select()
          .from(shipments)
          .where(eq(shipments.id, shipment.id))
          .limit(1)
      )[0];

      const events = await tx
        .select()
        .from(shipmentEvents)
        .where(eq(shipmentEvents.shipmentId, shipment.id))
        .orderBy(desc(shipmentEvents.eventTimestamp));

      return {
        shipment: updatedShipment,
        events,
        terminalRegressionBlocked: !canTransition,
      };
    });
  }

  // ==========================================
  // GATE 1 RECONCILIATION FOR TIMED-OUT PARCELS
  // ==========================================

  async reconcileShipment(tenantId: string, actorId: string, shipmentId: string, input: ReconcileShipmentInput) {
    return withSystem(async (tx) => {
      const shipment = (
        await tx
          .select()
          .from(shipments)
          .where(and(eq(shipments.id, shipmentId), eq(shipments.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!shipment) {
        throw new NotFoundException('Shipment not found');
      }

      if (shipment.shipmentStatus !== 'unknown_pending_reconciliation') {
        throw new BadRequestException('Only shipments with unknown_pending_reconciliation status can be reconciled');
      }

      const now = new Date().toISOString();

      if (input.action === 'confirm_found') {
        if (!input.consignmentId && !input.trackingCode) {
          throw new BadRequestException('Consignment ID or tracking code is required to confirm found consignment');
        }

        const updated = (
          await tx
            .update(shipments)
            .set({
              consignmentId: input.consignmentId || shipment.consignmentId,
              trackingCode: input.trackingCode || shipment.trackingCode,
              shipmentStatus: 'pending',
              updatedAt: now,
            })
            .where(eq(shipments.id, shipment.id))
            .returning()
        )[0];

        await tx.insert(shipmentEvents).values({
          tenantId,
          shipmentId: shipment.id,
          providerStatus: 'RECONCILED_FOUND',
          normalizedStatus: 'pending',
          note: `Manual reconciliation confirmed parcel exists on courier. ${input.note || ''}`,
        });

        await tx
          .update(orders)
          .set({ shipmentStatus: 'in_transit', updatedAt: now })
          .where(eq(orders.id, shipment.orderId));

        return updated;
      } else {
        // mark_cancelled
        const updated = (
          await tx
            .update(shipments)
            .set({
              shipmentStatus: 'cancelled',
              updatedAt: now,
            })
            .where(eq(shipments.id, shipment.id))
            .returning()
        )[0];

        await tx.insert(shipmentEvents).values({
          tenantId,
          shipmentId: shipment.id,
          providerStatus: 'RECONCILED_CANCELLED',
          normalizedStatus: 'cancelled',
          note: `Manual reconciliation verified parcel was not created. Cancelled safely to allow re-dispatch. ${input.note || ''}`,
        });

        await tx
          .update(orders)
          .set({ shipmentStatus: 'unfulfilled', updatedAt: now })
          .where(eq(orders.id, shipment.orderId));

        return updated;
      }
    });
  }

  // ==========================================
  // FRAUD CHECK INTEGRATION (GATE 3)
  // ==========================================

  async checkCustomerRisk(tenantId: string, phone: string): Promise<CourierFraudCheckResult> {
    return withSystem(async (tx) => {
      // Find default or active courier account
      const account = (
        await tx
          .select()
          .from(courierAccounts)
          .where(and(eq(courierAccounts.tenantId, tenantId), eq(courierAccounts.isActive, true)))
          .orderBy(desc(courierAccounts.isDefault))
          .limit(1)
      )[0];

      if (!account) {
        return {
          provider: 'none',
          phone,
          totalOrders: 0,
          successfulDeliveries: 0,
          returns: 0,
          deliveryRatePercent: 0,
          returnRatePercent: 0,
          riskRating: 'insufficient_data',
          providerUnavailable: false,
        };
      }

      try {
        const adapter = this.getAdapterForAccount(account);
        return await adapter.checkCustomerRisk(phone);
      } catch (err: any) {
        // Gate 3: Provider down or errored -> MUST return 'provider_unavailable', NEVER 'low'
        return {
          provider: account.courierCode,
          phone,
          totalOrders: 0,
          successfulDeliveries: 0,
          returns: 0,
          deliveryRatePercent: 0,
          returnRatePercent: 0,
          riskRating: 'provider_unavailable',
          providerUnavailable: true,
          rawResponse: { error: err.message },
        };
      }
    });
  }

  // ==========================================
  // COD SETTLEMENTS & STATEMENTS
  // ==========================================

  async listSettlements(tenantId: string) {
    return withSystem(async (tx) => {
      const rows = await tx
        .select()
        .from(courierSettlements)
        .where(eq(courierSettlements.tenantId, tenantId))
        .orderBy(desc(courierSettlements.createdAt));

      return rows.map((r) => ({
        ...r,
        totalExpectedCodMinor: Number(r.totalExpectedCodMinor),
        totalSettledMinor: Number(r.totalSettledMinor),
        totalFeeDeductedMinor: Number(r.totalFeeDeductedMinor),
      }));
    });
  }

  async getSettlement(tenantId: string, settlementId: string) {
    return withSystem(async (tx) => {
      const settlement = (
        await tx
          .select()
          .from(courierSettlements)
          .where(and(eq(courierSettlements.id, settlementId), eq(courierSettlements.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!settlement) {
        throw new NotFoundException('Settlement statement not found');
      }

      const allocations = await tx
        .select()
        .from(courierSettlementAllocations)
        .where(eq(courierSettlementAllocations.settlementId, settlement.id));

      return {
        settlement: {
          ...settlement,
          totalExpectedCodMinor: Number(settlement.totalExpectedCodMinor),
          totalSettledMinor: Number(settlement.totalSettledMinor),
          totalFeeDeductedMinor: Number(settlement.totalFeeDeductedMinor),
        },
        allocations: allocations.map((a) => ({
          ...a,
          codAmountMinor: Number(a.codAmountMinor),
          courierFeeMinor: Number(a.courierFeeMinor),
          netSettledMinor: Number(a.netSettledMinor),
        })),
      };
    });
  }

  async createSettlement(tenantId: string, actorId: string, input: CreateSettlementInput) {
    return withSystem(async (tx) => {
      const account = (
        await tx
          .select()
          .from(courierAccounts)
          .where(and(eq(courierAccounts.id, input.courierAccountId), eq(courierAccounts.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!account) {
        throw new NotFoundException('Courier account not found');
      }

      let totalExpectedCod = 0;
      let totalSettled = 0;
      let totalFee = 0;

      for (const item of input.items) {
        totalExpectedCod += item.codAmount;
        totalSettled += item.netSettled;
        totalFee += item.courierFee;
      }

      const totalExpectedCodMinor = BigInt(Math.round(totalExpectedCod * 100));
      const totalSettledMinor = BigInt(Math.round(totalSettled * 100));
      const totalFeeMinor = BigInt(Math.round(totalFee * 100));

      const settlement = (
        await tx
          .insert(courierSettlements)
          .values({
            tenantId,
            courierAccountId: account.id,
            statementReference: input.statementReference,
            statementDate: input.statementDate || new Date().toISOString(),
            totalExpectedCodMinor,
            totalSettledMinor,
            totalFeeDeductedMinor: totalFeeMinor,
            settlementStatus: 'settled',
            importedBy: actorId,
          })
          .returning()
      )[0];

      if (!settlement) {
        throw new BadRequestException('Failed to create settlement record');
      }

      // Process allocations
      for (const item of input.items) {
        // Try matching shipment by consignmentId or orderNumber
        let matchedShipment = (
          await tx
            .select()
            .from(shipments)
            .where(and(eq(shipments.tenantId, tenantId), eq(shipments.consignmentId, item.consignmentId)))
            .limit(1)
        )[0];

        if (!matchedShipment && item.orderNumber) {
          const matchedOrder = (
            await tx
              .select()
              .from(orders)
              .where(and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, item.orderNumber)))
              .limit(1)
          )[0];

          if (matchedOrder) {
            matchedShipment = (
              await tx
                .select()
                .from(shipments)
                .where(and(eq(shipments.tenantId, tenantId), eq(shipments.orderId, matchedOrder.id)))
                .limit(1)
            )[0];
          }
        }

        const netSettledMinor = BigInt(Math.round(item.netSettled * 100));
        const codAmountMinor = BigInt(Math.round(item.codAmount * 100));
        const courierFeeMinor = BigInt(Math.round(item.courierFee * 100));

        await tx.insert(courierSettlementAllocations).values({
          tenantId,
          settlementId: settlement.id,
          shipmentId: matchedShipment?.id,
          orderId: matchedShipment?.orderId,
          consignmentId: item.consignmentId,
          codAmountMinor,
          courierFeeMinor,
          netSettledMinor,
          disputeNote: item.disputeNote,
        });

        if (matchedShipment) {
          await tx
            .update(shipments)
            .set({
              actualSettledMinor: netSettledMinor,
              codFeeMinor: courierFeeMinor,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(shipments.id, matchedShipment.id));
        }
      }

      return {
        ...settlement,
        totalExpectedCodMinor: Number(settlement.totalExpectedCodMinor),
        totalSettledMinor: Number(settlement.totalSettledMinor),
        totalFeeDeductedMinor: Number(settlement.totalFeeDeductedMinor),
      };
    });
  }

  async getShipments(tenantId: string, orderId?: string) {
    return withSystem(async (tx) => {
      const conditions = [eq(shipments.tenantId, tenantId)];
      if (orderId) {
        conditions.push(eq(shipments.orderId, orderId));
      }

      const rows = await tx
        .select()
        .from(shipments)
        .where(and(...conditions))
        .orderBy(desc(shipments.createdAt));

      return rows.map((s) => ({
        ...s,
        codAmountMinor: Number(s.codAmountMinor),
        deliveryChargeMinor: Number(s.deliveryChargeMinor),
        codFeeMinor: Number(s.codFeeMinor),
        actualSettledMinor: s.actualSettledMinor !== null ? Number(s.actualSettledMinor) : null,
      }));
    });
  }

  async getShipmentEvents(tenantId: string, shipmentId: string) {
    return withSystem(async (tx) => {
      return tx
        .select()
        .from(shipmentEvents)
        .where(and(eq(shipmentEvents.tenantId, tenantId), eq(shipmentEvents.shipmentId, shipmentId)))
        .orderBy(desc(shipmentEvents.eventTimestamp));
    });
  }
}
