import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  withSystem,
  orders,
  orderItems,
  customers,
  customerAddresses,
  tenants,
  printLogs,
  documents,
  productVariants,
  products,
} from '@growthomic/db';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import {
  GenerateDocumentSignedUrlInput,
  CreatePrintLogInput,
  DocumentType,
  PrintFormat,
} from '@growthomic/shared';

@Injectable()
export class DocumentsService {
  private readonly signingSecret: string;

  constructor() {
    this.signingSecret = process.env['JWT_SECRET'] || 'growthomic-documents-signing-secret-key-32b';
  }

  /**
   * Generates a signed, time-limited URL for secure, tenant-scoped document rendering.
   */
  async generateSignedUrl(
    tenantId: string,
    actorId: string | undefined,
    input: GenerateDocumentSignedUrlInput
  ) {
    const expiresInMinutes = input.expiresInMinutes || 30;
    const expires = Date.now() + expiresInMinutes * 60 * 1000;
    const expiresAt = new Date(expires).toISOString();

    const signature = this.createHmacSignature({
      tenantId,
      documentType: input.documentType,
      referenceId: input.referenceId,
      format: input.format,
      expires,
    });

    const token = `${signature}.${expires}`;

    // Record document generation in documents table
    await withSystem(async (tx) => {
      await tx.insert(documents).values({
        tenantId,
        documentType: input.documentType,
        title: `${input.documentType.toUpperCase()} - ${input.referenceId} (${input.format})`,
        referenceId: input.referenceId,
        storagePath: `/${tenantId}/documents/${input.documentType}/${input.referenceId}.${input.format}`,
        expiresAt,
        createdBy: actorId,
      });
    });

    const queryParams = new URLSearchParams({
      token,
      expires: String(expires),
      tenantId,
      documentType: input.documentType,
      referenceId: input.referenceId,
      format: input.format,
      lang: input.lang || 'en',
    });

    return {
      url: `/api/v1/documents/render?${queryParams.toString()}`,
      token,
      expiresAt,
      tenantId,
      referenceId: input.referenceId,
      documentType: input.documentType,
      format: input.format,
    };
  }

  /**
   * Verifies signed URL HMAC signature and checks expiration.
   * Throws ForbiddenException if token is expired or altered.
   */
  verifySignedToken(query: {
    token: string;
    expires: number;
    tenantId: string;
    documentType: string;
    referenceId: string;
    format: string;
  }) {
    if (!query.token || !query.expires) {
      throw new ForbiddenException('Missing signed document access token');
    }

    const now = Date.now();
    if (now > Number(query.expires)) {
      throw new ForbiddenException('Signed document URL has expired');
    }

    const expectedSignature = this.createHmacSignature({
      tenantId: query.tenantId,
      documentType: query.documentType,
      referenceId: query.referenceId,
      format: query.format,
      expires: Number(query.expires),
    });

    const providedSignature = query.token.split('.')[0] || '';

    // Constant-time comparison
    if (
      providedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))
    ) {
      throw new ForbiddenException('Invalid document access signature or cross-tenant scope violation');
    }

    return true;
  }

  private createHmacSignature(params: {
    tenantId: string;
    documentType: string;
    referenceId: string;
    format: string;
    expires: number;
  }): string {
    const data = `${params.tenantId}:${params.documentType}:${params.referenceId}:${params.format}:${params.expires}`;
    return crypto.createHmac('sha256', this.signingSecret).update(data).digest('hex');
  }

  /**
   * Renders bilingual document data scoped to tenantId.
   */
  async renderDocumentData(
    tenantId: string,
    documentType: string,
    referenceId: string,
    format: string,
    lang: 'en' | 'bn' = 'en'
  ) {
    return withSystem(async (tx) => {
      // 1. Fetch Tenant details
      const tenantRow = (
        await tx
          .select({
            id: tenants.id,
            name: tenants.name,
            currency: tenants.currency,
            timezone: tenants.timezone,
          })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1)
      )[0];

      if (!tenantRow) {
        throw new NotFoundException('Tenant not found');
      }

      // Handle Single Order Invoice or Packing Slip
      if (documentType === 'invoice' || documentType === 'packing_slip') {
        const orderRow = (
          await tx
            .select()
            .from(orders)
            .where(and(eq(orders.id, referenceId), eq(orders.tenantId, tenantId)))
            .limit(1)
        )[0];

        if (!orderRow) {
          throw new NotFoundException('Order not found or cross-tenant access denied');
        }

        const items = await tx
          .select({
            item: orderItems,
            variant: productVariants,
            product: products,
          })
          .from(orderItems)
          .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
          .leftJoin(products, eq(productVariants.productId, products.id))
          .where(eq(orderItems.orderId, orderRow.id));

        const customer = (
          await tx
            .select()
            .from(customers)
            .where(and(eq(customers.id, orderRow.customerId), eq(customers.tenantId, tenantId)))
            .limit(1)
        )[0];

        const address = (
          await tx
            .select()
            .from(customerAddresses)
            .where(and(eq(customerAddresses.customerId, orderRow.customerId), eq(customerAddresses.tenantId, tenantId)))
            .limit(1)
        )[0];

        return {
          documentType,
          format,
          lang,
          tenant: tenantRow,
          order: {
            id: orderRow.id,
            orderNumber: orderRow.orderNumber,
            date: orderRow.createdAt,
            paymentStatus: orderRow.paymentStatus,
            paymentMethod: orderRow.paymentMethod,
            subtotalMinor: Number(orderRow.subtotalMinor),
            deliveryChargeMinor: Number(orderRow.deliveryChargeMinor),
            discountMinor: Number(orderRow.discountMinor),
            totalAmountMinor: Number(orderRow.totalAmountMinor),
            internalNotes: orderRow.internalNotes,
            customerNotes: orderRow.customerNotes,
          },
          customer: {
            name: customer?.name || 'Walk-in Customer',
            phone: customer?.phone || '—',
            email: customer?.email,
            address: address
              ? {
                  division: address.division,
                  district: address.district,
                  thana: address.upazilaThana,
                  street: address.streetAddress,
                }
              : null,
          },
          items: items.map((i) => ({
            id: i.item.id,
            name: i.product?.name || 'Product Item',
            variantName: i.variant?.name || 'Standard',
            sku: i.item.sku,
            quantity: i.item.quantity,
            unitPriceMinor: Number(i.item.unitPriceMinor),
            totalPriceMinor: Number(i.item.totalPriceMinor),
          })),
        };
      }

      // Handle Bulk Batch Invoices
      if (documentType === 'bulk_batch') {
        const orderIds = referenceId.split(',').map((id) => id.trim()).filter(Boolean);
        if (orderIds.length === 0) {
          throw new BadRequestException('No order IDs provided for bulk batch');
        }

        const ordersList = await tx
          .select()
          .from(orders)
          .where(and(inArray(orders.id, orderIds), eq(orders.tenantId, tenantId)));

        const renderedOrders: any[] = [];
        for (const ord of ordersList) {
          const items = await tx
            .select({
              item: orderItems,
              variant: productVariants,
              product: products,
            })
            .from(orderItems)
            .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
            .leftJoin(products, eq(productVariants.productId, products.id))
            .where(eq(orderItems.orderId, ord.id));

          const customer = (
            await tx
              .select()
              .from(customers)
              .where(eq(customers.id, ord.customerId))
              .limit(1)
          )[0];

          renderedOrders.push({
            order: {
              id: ord.id,
              orderNumber: ord.orderNumber,
              date: ord.createdAt,
              paymentStatus: ord.paymentStatus,
              paymentMethod: ord.paymentMethod,
              subtotalMinor: Number(ord.subtotalMinor),
              deliveryChargeMinor: Number(ord.deliveryChargeMinor),
              discountMinor: Number(ord.discountMinor),
              totalAmountMinor: Number(ord.totalAmountMinor),
            },
            customer: {
              name: customer?.name || 'Customer',
              phone: customer?.phone || '—',
            },
            items: items.map((i) => ({
              id: i.item.id,
              name: i.product?.name || 'Item',
              sku: i.item.sku,
              quantity: i.item.quantity,
              unitPriceMinor: Number(i.item.unitPriceMinor),
              totalPriceMinor: Number(i.item.totalPriceMinor),
            })),
          });
        }

        return {
          documentType: 'bulk_batch',
          format,
          lang,
          tenant: tenantRow,
          orders: renderedOrders,
        };
      }

      throw new BadRequestException(`Unsupported document type: ${documentType}`);
    });
  }

  /**
   * Logs a print event to print_logs table.
   */
  async createPrintLog(
    tenantId: string,
    actorId: string | undefined,
    actorName: string | undefined,
    input: CreatePrintLogInput
  ) {
    return withSystem(async (tx) => {
      const inserted = (
        await tx
          .insert(printLogs)
          .values({
            tenantId,
            documentType: input.documentType,
            orderIds: input.orderIds,
            format: input.format,
            printedBy: actorId,
            printedByName: actorName || 'Staff',
            ipAddress: input.ipAddress,
          })
          .returning()
      )[0];

      return inserted;
    });
  }

  /**
   * Lists print audit logs.
   */
  async listPrintLogs(tenantId: string, limit = 50) {
    return withSystem(async (tx) => {
      return tx
        .select()
        .from(printLogs)
        .where(eq(printLogs.tenantId, tenantId))
        .orderBy(desc(printLogs.createdAt))
        .limit(limit);
    });
  }
}
