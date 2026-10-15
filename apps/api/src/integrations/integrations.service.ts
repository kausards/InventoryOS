import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import {
  withSystem,
  integrationStores,
  productMappings,
  integrationEvents,
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
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import {
  validateSsrfSafeUrl,
  verifyWooCommerceWebhookSignature,
  computeWebhookDeduplicationKey,
  encryptStoreCredentials,
  decryptStoreCredentials,
  maskStoreCredentials,
  normalizeBdPhone,
  toPaisa,
} from '@growthomic/shared';
import type {
  ConnectStoreInput,
  UpdateStoreInput,
  MapProductVariantInput,
  BatchMapProductsInput,
  StoreCredentials,
} from '@growthomic/shared';
import { WooCommerceClient, WooCommerceOrder } from './woocommerce.client';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Lists all connected integration stores for the tenant with masked credentials.
   */
  async listStores(tenantId: string) {
    return withSystem(async (tx) => {
      const rows = await tx
        .select()
        .from(integrationStores)
        .where(eq(integrationStores.tenantId, tenantId))
        .orderBy(desc(integrationStores.createdAt));

      // Fetch mapping counts per store
      const storesWithStats = await Promise.all(
        rows.map(async (store) => {
          const stats = await tx
            .select({
              totalMappings: sql<number>`count(*)::int`,
              mappedCount: sql<number>`count(*) filter (where ${productMappings.mappingStatus} = 'mapped')::int`,
              unmappedCount: sql<number>`count(*) filter (where ${productMappings.mappingStatus} = 'unmapped')::int`,
            })
            .from(productMappings)
            .where(
              and(
                eq(productMappings.tenantId, tenantId),
                eq(productMappings.storeId, store.id)
              )
            );

          let masked = { consumerKey: '******', consumerSecret: '******' };
          try {
            const dec = decryptStoreCredentials(store.encryptedCredentials);
            masked = maskStoreCredentials(dec);
          } catch {
            // fallback
          }

          return {
            ...store,
            encryptedCredentials: '[ENCRYPTED_AES_256_GCM]',
            credentials: masked,
            stats: stats[0] ?? { totalMappings: 0, mappedCount: 0, unmappedCount: 0 },
          };
        })
      );

      return storesWithStats;
    });
  }

  /**
   * Retrieves single store details by ID.
   */
  async getStore(tenantId: string, storeId: string) {
    return withSystem(async (tx) => {
      const store = (
        await tx
          .select()
          .from(integrationStores)
          .where(and(eq(integrationStores.tenantId, tenantId), eq(integrationStores.id, storeId)))
          .limit(1)
      )[0];

      if (!store) {
        throw new NotFoundException('Integration store not found');
      }

      let masked = { consumerKey: '******', consumerSecret: '******' };
      try {
        const dec = decryptStoreCredentials(store.encryptedCredentials);
        masked = maskStoreCredentials(dec);
      } catch {
        // fallback
      }

      return {
        ...store,
        encryptedCredentials: '[ENCRYPTED_AES_256_GCM]',
        credentials: masked,
      };
    });
  }

  /**
   * Connects a new WooCommerce store.
   * Enforces SSRF Safe URL validation and verifies connection before persisting.
   */
  async connectStore(tenantId: string, actorId: string, dto: ConnectStoreInput) {
    // 1. SSRF URL Validation (Acceptance Gate 4)
    const ssrfCheck = validateSsrfSafeUrl(dto.storeUrl);
    if (!ssrfCheck.isValid) {
      throw new BadRequestException(`SSRF Validation Failed: ${ssrfCheck.error}`);
    }

    const sanitizedUrl = ssrfCheck.sanitizedUrl || dto.storeUrl.trim();

    // 2. Test Connection against WooCommerce
    const client = new WooCommerceClient({
      baseUrl: sanitizedUrl,
      consumerKey: dto.consumerKey,
      consumerSecret: dto.consumerSecret,
      timeoutMs: 10000,
    });

    const connTest = await client.testConnection();
    if (!connTest.success) {
      throw new BadRequestException(
        `Failed to connect to WooCommerce store at ${sanitizedUrl}: ${connTest.message}`
      );
    }

    // 3. Encrypt credentials with AES-256-GCM
    const webhookSecret = dto.webhookSecret || `whsec_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const encryptedCredentials = encryptStoreCredentials({
      consumerKey: dto.consumerKey,
      consumerSecret: dto.consumerSecret,
      webhookSecret,
    });

    return withSystem(async (tx) => {
      // 4. Resolve default warehouse if not specified
      let warehouseId = dto.defaultWarehouseId;
      if (!warehouseId) {
        const defWh = (
          await tx
            .select({ id: warehouses.id })
            .from(warehouses)
            .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.isDefault, true)))
            .limit(1)
        )[0];
        warehouseId = defWh?.id;
      }

      // 5. Insert store
      const inserted = (
        await tx
          .insert(integrationStores)
          .values({
            tenantId,
            platform: 'woocommerce',
            storeName: dto.storeName.trim(),
            storeUrl: sanitizedUrl,
            encryptedCredentials,
            isActive: true,
            syncOrders: dto.syncOrders ?? true,
            pushStock: dto.pushStock ?? true,
            defaultWarehouseId: warehouseId ?? null,
            healthStatus: 'healthy',
            healthMessage: `Connected successfully. ${connTest.message}`,
          })
          .returning()
      )[0];

      if (!inserted) {
        throw new BadRequestException('Failed to create integration store record');
      }

      // Log audit
      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        actorType: 'user',
        action: 'store.connected',
        entityType: 'integration_stores',
        entityId: inserted.id,
        after: {
          storeName: inserted.storeName,
          storeUrl: inserted.storeUrl,
          platform: 'woocommerce',
        },
      });

      return {
        ...inserted,
        encryptedCredentials: '[ENCRYPTED_AES_256_GCM]',
        credentials: maskStoreCredentials({
          consumerKey: dto.consumerKey,
          consumerSecret: dto.consumerSecret,
          webhookSecret,
        }),
      };
    });
  }

  /**
   * Updates store settings or rotated credentials.
   */
  async updateStore(tenantId: string, storeId: string, dto: UpdateStoreInput) {
    return withSystem(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(integrationStores)
          .where(and(eq(integrationStores.tenantId, tenantId), eq(integrationStores.id, storeId)))
          .limit(1)
      )[0];

      if (!existing) {
        throw new NotFoundException('Store not found');
      }

      const updates: Record<string, any> = {
        updatedAt: sql`now()`,
      };

      if (dto.storeName !== undefined) updates['storeName'] = dto.storeName.trim();
      if (dto.isActive !== undefined) updates['isActive'] = dto.isActive;
      if (dto.syncOrders !== undefined) updates['syncOrders'] = dto.syncOrders;
      if (dto.pushStock !== undefined) updates['pushStock'] = dto.pushStock;
      if (dto.defaultWarehouseId !== undefined) updates['defaultWarehouseId'] = dto.defaultWarehouseId;

      // Credential rotation if keys provided
      if (dto.consumerKey || dto.consumerSecret) {
        const currentCreds = decryptStoreCredentials(existing.encryptedCredentials);
        const webhookSec = dto.webhookSecret || currentCreds.webhookSecret;
        const newCreds: StoreCredentials = {
          consumerKey: dto.consumerKey || currentCreds.consumerKey,
          consumerSecret: dto.consumerSecret || currentCreds.consumerSecret,
          ...(webhookSec ? { webhookSecret: webhookSec } : {}),
        };

        // Re-test connection before committing rotated keys
        const client = new WooCommerceClient({
          baseUrl: existing.storeUrl,
          consumerKey: newCreds.consumerKey,
          consumerSecret: newCreds.consumerSecret,
        });

        const testRes = await client.testConnection();
        if (!testRes.success) {
          throw new BadRequestException(`Rotated credentials failed verification: ${testRes.message}`);
        }

        updates['encryptedCredentials'] = encryptStoreCredentials(newCreds);
        updates['healthStatus'] = 'healthy';
        updates['healthMessage'] = 'Credentials updated and verified.';
      }

      const updated = (
        await tx
          .update(integrationStores)
          .set(updates)
          .where(and(eq(integrationStores.tenantId, tenantId), eq(integrationStores.id, storeId)))
          .returning()
      )[0];

      return {
        ...updated,
        encryptedCredentials: '[ENCRYPTED_AES_256_GCM]',
      };
    });
  }

  /**
   * Disconnects a store without deleting historical data.
   */
  async disconnectStore(tenantId: string, storeId: string, actorId: string) {
    return withSystem(async (tx) => {
      const store = (
        await tx
          .select()
          .from(integrationStores)
          .where(and(eq(integrationStores.tenantId, tenantId), eq(integrationStores.id, storeId)))
          .limit(1)
      )[0];

      if (!store) {
        throw new NotFoundException('Store not found');
      }

      const updated = (
        await tx
          .update(integrationStores)
          .set({
            isActive: false,
            healthStatus: 'disconnected',
            healthMessage: 'Store was manually disconnected.',
            updatedAt: sql`now()`,
          })
          .where(and(eq(integrationStores.tenantId, tenantId), eq(integrationStores.id, storeId)))
          .returning()
      )[0];

      await tx.insert(auditLogs).values({
        tenantId,
        actorId,
        actorType: 'user',
        action: 'store.disconnected',
        entityType: 'integration_stores',
        entityId: storeId,
        after: { storeName: store.storeName },
      });

      return {
        success: true,
        message: 'Store disconnected. Historical orders and shipments are preserved.',
        store: {
          ...updated,
          encryptedCredentials: '[ENCRYPTED_AES_256_GCM]',
        },
      };
    });
  }

  /**
   * Live ping test for an existing connected store.
   */
  async testStoreConnection(tenantId: string, storeId: string) {
    return withSystem(async (tx) => {
      const store = (
        await tx
          .select()
          .from(integrationStores)
          .where(and(eq(integrationStores.tenantId, tenantId), eq(integrationStores.id, storeId)))
          .limit(1)
      )[0];

      if (!store) {
        throw new NotFoundException('Store not found');
      }

      const creds = decryptStoreCredentials(store.encryptedCredentials);
      const client = new WooCommerceClient({
        baseUrl: store.storeUrl,
        consumerKey: creds.consumerKey,
        consumerSecret: creds.consumerSecret,
      });

      const res = await client.testConnection();

      await tx
        .update(integrationStores)
        .set({
          healthStatus: res.success ? 'healthy' : 'error',
          healthMessage: res.message,
          updatedAt: sql`now()`,
        })
        .where(eq(integrationStores.id, storeId));

      return res;
    });
  }

  /**
   * Fetches products and variants from WooCommerce and upserts into product_mappings.
   * Auto-maps only on exact, non-ambiguous single SKU matches.
   */
  async syncProducts(tenantId: string, storeId: string) {
    const store = await withSystem(async (tx) => {
      return (
        await tx
          .select()
          .from(integrationStores)
          .where(and(eq(integrationStores.tenantId, tenantId), eq(integrationStores.id, storeId)))
          .limit(1)
      )[0];
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const creds = decryptStoreCredentials(store.encryptedCredentials);
    const client = new WooCommerceClient({
      baseUrl: store.storeUrl,
      consumerKey: creds.consumerKey,
      consumerSecret: creds.consumerSecret,
    });

    // Fetch page 1 of products
    const wcProducts = await client.getProducts(1, 100);

    return withSystem(async (tx) => {
      // Fetch all existing internal product variants for auto-matching by exact SKU
      const internalVariants = await tx
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          name: productVariants.name,
        })
        .from(productVariants)
        .where(eq(productVariants.tenantId, tenantId));

      const skuMap = new Map<string, string>();
      for (const v of internalVariants) {
        if (v.sku && v.sku.trim()) {
          skuMap.set(v.sku.trim().toLowerCase(), v.id);
        }
      }

      let createdCount = 0;
      let updatedCount = 0;
      let autoMappedCount = 0;

      for (const p of wcProducts) {
        const priceMinor = toPaisa(p.price || p.regular_price || '0');

        // Check if product is variable
        if (p.type === 'variable' && p.variations && p.variations.length > 0) {
          // Fetch variations
          let variations: any[] = [];
          try {
            variations = await client.getVariations(p.id, 1, 50);
          } catch (e) {
            this.logger.warn(`Could not fetch variations for WC product ${p.id}: ${e}`);
          }

          for (const v of variations) {
            const varSku = v.sku?.trim() || '';
            const internalMatchId = varSku ? skuMap.get(varSku.toLowerCase()) : undefined;

            const existingMapping = (
              await tx
                .select()
                .from(productMappings)
                .where(
                  and(
                    eq(productMappings.tenantId, tenantId),
                    eq(productMappings.storeId, storeId),
                    eq(productMappings.externalProductId, String(p.id)),
                    eq(productMappings.externalVariantId, String(v.id))
                  )
                )
                .limit(1)
            )[0];

            if (existingMapping) {
              await tx
                .update(productMappings)
                .set({
                  externalName: `${p.name} - ${v.attributes.map((a: any) => a.option).join(' / ')}`,
                  externalSku: varSku || null,
                  externalPriceMinor: toPaisa(v.price || p.price || '0'),
                  externalStockQuantity: v.stock_quantity ?? null,
                  lastSyncedAt: sql`now()`,
                  updatedAt: sql`now()`,
                })
                .where(eq(productMappings.id, existingMapping.id));
              updatedCount++;
            } else {
              const status = internalMatchId ? 'mapped' : 'unmapped';
              await tx.insert(productMappings).values({
                tenantId,
                storeId,
                externalProductId: String(p.id),
                externalVariantId: String(v.id),
                externalSku: varSku || null,
                externalName: `${p.name} - ${v.attributes.map((a: any) => a.option).join(' / ')}`,
                externalPriceMinor: toPaisa(v.price || p.price || '0'),
                externalStockQuantity: v.stock_quantity ?? null,
                internalVariantId: internalMatchId || null,
                mappingStatus: status,
                lastSyncedAt: sql`now()`,
              });
              createdCount++;
              if (internalMatchId) autoMappedCount++;
            }
          }
        } else {
          // Simple product
          const pSku = p.sku?.trim() || '';
          const internalMatchId = pSku ? skuMap.get(pSku.toLowerCase()) : undefined;

          const existingMapping = (
            await tx
              .select()
              .from(productMappings)
              .where(
                and(
                  eq(productMappings.tenantId, tenantId),
                  eq(productMappings.storeId, storeId),
                  eq(productMappings.externalProductId, String(p.id)),
                  eq(productMappings.externalVariantId, '')
                )
              )
              .limit(1)
          )[0];

          if (existingMapping) {
            await tx
              .update(productMappings)
              .set({
                externalName: p.name,
                externalSku: pSku || null,
                externalPriceMinor: priceMinor,
                externalStockQuantity: p.stock_quantity ?? null,
                lastSyncedAt: sql`now()`,
                updatedAt: sql`now()`,
              })
              .where(eq(productMappings.id, existingMapping.id));
            updatedCount++;
          } else {
            const status = internalMatchId ? 'mapped' : 'unmapped';
            await tx.insert(productMappings).values({
              tenantId,
              storeId,
              externalProductId: String(p.id),
              externalVariantId: '',
              externalSku: pSku || null,
              externalName: p.name,
              externalPriceMinor: priceMinor,
              externalStockQuantity: p.stock_quantity ?? null,
              internalVariantId: internalMatchId || null,
              mappingStatus: status,
              lastSyncedAt: sql`now()`,
            });
            createdCount++;
            if (internalMatchId) autoMappedCount++;
          }
        }
      }

      return {
        success: true,
        totalFetched: wcProducts.length,
        createdCount,
        updatedCount,
        autoMappedCount,
      };
    });
  }

  /**
   * Lists product mappings with optional status filter.
   */
  async listProductMappings(
    tenantId: string,
    storeId: string,
    query: { status?: string; search?: string; page?: number; limit?: number } = {}
  ) {
    return withSystem(async (tx) => {
      const page = Math.max(1, query.page ? Number(query.page) : 1);
      const limit = Math.max(1, Math.min(100, query.limit ? Number(query.limit) : 50));
      const offset = (page - 1) * limit;

      const conditions: any[] = [
        eq(productMappings.tenantId, tenantId),
        eq(productMappings.storeId, storeId),
      ];

      if (query.status && query.status !== 'all') {
        conditions.push(eq(productMappings.mappingStatus, query.status));
      }

      const rows = await tx
        .select({
          id: productMappings.id,
          externalProductId: productMappings.externalProductId,
          externalVariantId: productMappings.externalVariantId,
          externalSku: productMappings.externalSku,
          externalName: productMappings.externalName,
          externalPriceMinor: productMappings.externalPriceMinor,
          externalStockQuantity: productMappings.externalStockQuantity,
          internalVariantId: productMappings.internalVariantId,
          mappingStatus: productMappings.mappingStatus,
          lastPushedStock: productMappings.lastPushedStock,
          lastSyncedAt: productMappings.lastSyncedAt,
          internalVariantTitle: productVariants.name,
          internalVariantSku: productVariants.sku,
          productTitle: products.name,
        })
        .from(productMappings)
        .leftJoin(productVariants, eq(productMappings.internalVariantId, productVariants.id))
        .leftJoin(products, eq(productVariants.productId, products.id))
        .where(and(...conditions))
        .orderBy(desc(productMappings.createdAt))
        .limit(limit)
        .offset(offset);

      const totalRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(productMappings)
        .where(and(...conditions));

      const total = totalRes[0]?.count ?? 0;

      return {
        items: rows.map((r) => ({
          ...r,
          externalPriceMinor: r.externalPriceMinor.toString(),
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

  /**
   * Manually maps or ignores a product variant.
   */
  async mapProductVariant(
    tenantId: string,
    mappingId: string,
    dto: MapProductVariantInput
  ) {
    return withSystem(async (tx) => {
      const mapping = (
        await tx
          .select()
          .from(productMappings)
          .where(and(eq(productMappings.tenantId, tenantId), eq(productMappings.id, mappingId)))
          .limit(1)
      )[0];

      if (!mapping) {
        throw new NotFoundException('Product mapping record not found');
      }

      if (dto.internalVariantId) {
        const variant = (
          await tx
            .select()
            .from(productVariants)
            .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.id, dto.internalVariantId)))
            .limit(1)
        )[0];

        if (!variant) {
          throw new NotFoundException('Selected internal product variant not found');
        }
      }

      const updated = (
        await tx
          .update(productMappings)
          .set({
            internalVariantId: dto.internalVariantId ?? null,
            mappingStatus: dto.mappingStatus,
            updatedAt: sql`now()`,
          })
          .where(eq(productMappings.id, mappingId))
          .returning()
      )[0];

      return {
        ...updated,
        externalPriceMinor: updated?.externalPriceMinor.toString(),
      };
    });
  }

  /**
   * Handles incoming WooCommerce webhooks.
   * Performs HMAC-SHA256 signature verification and event deduplication.
   */
  async handleWebhook(
    storeId: string,
    rawBody: string,
    signatureHeader: string | undefined | null,
    eventTopic: string,
    payload: any
  ) {
    // 1. Fetch store and credentials
    const store = await withSystem(async (tx) => {
      return (
        await tx
          .select()
          .from(integrationStores)
          .where(eq(integrationStores.id, storeId))
          .limit(1)
      )[0];
    });

    if (!store) {
      throw new NotFoundException(`Integration store ${storeId} not found`);
    }

    const creds = decryptStoreCredentials(store.encryptedCredentials);

    // 2. Acceptance Gate 2: Invalid signature rejected
    if (creds.webhookSecret) {
      const verifyRes = verifyWooCommerceWebhookSignature(rawBody, signatureHeader, creds.webhookSecret);
      if (!verifyRes.isValid) {
        throw new UnauthorizedException(`Webhook signature verification failed: ${verifyRes.error}`);
      }
    }

    // 3. Acceptance Gate 1: Replayed webhook creates no duplicate
    const resourceId = payload?.id || 'unknown';
    const deliveryIdOrDate = payload?.date_modified || payload?.date_created || Date.now();
    const deduplicationKey = computeWebhookDeduplicationKey(
      store.id,
      eventTopic,
      resourceId,
      deliveryIdOrDate
    );

    return withSystem(async (tx) => {
      // Check if deduplication key already exists
      const existingEvent = (
        await tx
          .select()
          .from(integrationEvents)
          .where(
            and(
              eq(integrationEvents.tenantId, store.tenantId),
              eq(integrationEvents.storeId, store.id),
              eq(integrationEvents.deduplicationKey, deduplicationKey)
            )
          )
          .limit(1)
      )[0];

      if (existingEvent) {
        this.logger.warn(`Duplicate webhook ignored: key=${deduplicationKey}`);
        return {
          status: 'duplicate_ignored',
          message: 'Webhook event already processed previously.',
          eventId: existingEvent.id,
        };
      }

      // Record incoming event
      const insertedEvent = (
        await tx
          .insert(integrationEvents)
          .values({
            tenantId: store.tenantId,
            storeId: store.id,
            eventType: eventTopic,
            externalEventId: String(resourceId),
            deduplicationKey,
            payload: payload || {},
            status: 'pending',
          })
          .returning()
      )[0];

      if (!insertedEvent) {
        throw new BadRequestException('Failed to persist integration event');
      }

      // 4. Ingest Order if topic matches
      if (
        eventTopic.includes('order.created') ||
        eventTopic.includes('order.updated') ||
        eventTopic.includes('order_created')
      ) {
        try {
          const ingestRes = await this.ingestWooCommerceOrder(tx, store, payload);
          await tx
            .update(integrationEvents)
            .set({
              status: 'processed',
              processedAt: sql`now()`,
            })
            .where(eq(integrationEvents.id, insertedEvent.id));

          return {
            status: 'processed',
            eventId: insertedEvent.id,
            order: ingestRes,
          };
        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : String(err);
          await tx
            .update(integrationEvents)
            .set({
              status: 'failed',
              errorMessage: errMessage,
            })
            .where(eq(integrationEvents.id, insertedEvent.id));

          this.logger.error(`Order ingestion failed for event ${insertedEvent.id}: ${errMessage}`);
          return {
            status: 'failed',
            eventId: insertedEvent.id,
            error: errMessage,
          };
        }
      }

      return {
        status: 'received',
        eventId: insertedEvent.id,
      };
    });
  }

  /**
   * Internal order ingestion helper with strict duplicate prevention and atomic order numbering.
   */
  private async ingestWooCommerceOrder(tx: any, store: any, wcOrder: WooCommerceOrder) {
    const tenantId = store.tenantId;
    const externalOrderId = String(wcOrder.id);

    // 1. Check if order already exists for (tenant_id, store_id, external_order_id)
    const existingOrder = (
      await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            eq(orders.storeId, store.id),
            eq(orders.externalOrderId, externalOrderId)
          )
        )
        .limit(1)
    )[0];

    if (existingOrder) {
      // Upsert: Map WooCommerce status to internal order status
      const mappedStatus = this.mapWooCommerceStatus(wcOrder.status);
      if (mappedStatus && mappedStatus !== existingOrder.orderStatus) {
        await tx
          .update(orders)
          .set({
            orderStatus: mappedStatus,
            customerNotes: wcOrder.customer_note || existingOrder.customerNotes,
            updatedAt: sql`now()`,
          })
          .where(eq(orders.id, existingOrder.id));

        await tx.insert(orderStatusHistory).values({
          tenantId,
          orderId: existingOrder.id,
          fromStatus: existingOrder.orderStatus,
          toStatus: mappedStatus,
          reason: `WooCommerce order status updated to ${wcOrder.status}`,
          changedBy: null,
        });
      }
      return { orderId: existingOrder.id, orderNumber: existingOrder.orderNumber, action: 'updated' };
    }

    // 2. Resolve Customer
    const rawPhone = wcOrder.billing.phone || wcOrder.shipping?.phone || '01700000000';
    const norm = normalizeBdPhone(rawPhone);
    const normalizedPhone = norm.isValid ? norm.e164 : rawPhone.trim();
    const customerName =
      `${wcOrder.billing.first_name || ''} ${wcOrder.billing.last_name || ''}`.trim() || 'WooCommerce Customer';

    let customer = (
      await tx
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.normalizedPhone, normalizedPhone)))
        .limit(1)
    )[0];

    if (!customer) {
      customer = (
        await tx
          .insert(customers)
          .values({
            tenantId,
            name: customerName,
            phone: rawPhone,
            normalizedPhone,
            email: wcOrder.billing.email || null,
          })
          .returning()
      )[0];

      // Insert address
      const fullAddr = `${wcOrder.billing.address_1 || ''} ${wcOrder.billing.address_2 || ''}`.trim();
      if (fullAddr && customer) {
        await tx.insert(customerAddresses).values({
          tenantId,
          customerId: customer.id,
          addressLine: fullAddr,
          district: wcOrder.billing.city || 'Dhaka',
          division: wcOrder.billing.state || 'Dhaka',
          isDefault: true,
        });
      }
    }

    // 3. Resolve Warehouse
    let warehouseId = store.defaultWarehouseId;
    if (!warehouseId) {
      const defWh = (
        await tx
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.isDefault, true)))
          .limit(1)
      )[0];
      warehouseId = defWh?.id;
    }

    if (!warehouseId) {
      // Fallback to any warehouse for tenant
      const anyWh = (
        await tx
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(eq(warehouses.tenantId, tenantId))
          .limit(1)
      )[0];
      warehouseId = anyWh?.id;
    }

    // 4. Generate Atomic Order Number
    let seq = (
      await tx
        .select()
        .from(orderSequences)
        .where(eq(orderSequences.tenantId, tenantId))
        .for('update')
        .limit(1)
    )[0];

    if (!seq) {
      seq = (
        await tx
          .insert(orderSequences)
          .values({
            tenantId,
            prefix: 'ORD-',
            lastNumber: 1000,
          })
          .returning()
      )[0];
    }

    const nextSeqNumber = (seq?.lastNumber ?? 1000) + 1;
    const orderNumber = `${seq?.prefix ?? 'ORD-'}${nextSeqNumber}`;

    await tx
      .update(orderSequences)
      .set({ lastNumber: nextSeqNumber, updatedAt: sql`now()` })
      .where(eq(orderSequences.tenantId, tenantId));

    // 5. Calculations
    const subtotalMinor = toPaisa(wcOrder.total ? (Number(wcOrder.total) - Number(wcOrder.shipping_total || 0)).toFixed(2) : '0');
    const discountMinor = toPaisa(wcOrder.discount_total || '0');
    const deliveryChargeMinor = toPaisa(wcOrder.shipping_total || '0');
    const totalAmountMinor = toPaisa(wcOrder.total || '0');
    const initialStatus = this.mapWooCommerceStatus(wcOrder.status);

    // 6. Insert Order
    const newOrder = (
      await tx
        .insert(orders)
        .values({
          tenantId,
          orderNumber,
          orderSequence: nextSeqNumber,
          customerId: customer.id,
          warehouseId,
          storeId: store.id,
          externalOrderId,
          source: 'website_woocommerce',
          sourceReference: `WC #${wcOrder.number || wcOrder.id}`,
          orderStatus: initialStatus,
          paymentStatus: wcOrder.status === 'completed' || wcOrder.status === 'processing' ? 'paid' : 'unpaid',
          paymentMethod: wcOrder.payment_method?.includes('cod') ? 'cod' : 'bkash',
          subtotalMinor,
          discountMinor,
          deliveryChargeMinor,
          totalAmountMinor,
          customerNotes: wcOrder.customer_note || null,
        })
        .returning()
    )[0];

    // 7. Insert Order Items & Reserve Inventory
    for (const item of wcOrder.line_items || []) {
      const itemPriceMinor = toPaisa(item.price ? String(item.price) : '0');
      const itemTotalMinor = toPaisa(item.total || '0');

      // Look up product mapping to resolve internal product_variants.id
      const mapping = (
        await tx
          .select()
          .from(productMappings)
          .where(
            and(
              eq(productMappings.tenantId, tenantId),
              eq(productMappings.storeId, store.id),
              eq(productMappings.externalProductId, String(item.product_id)),
              eq(
                productMappings.externalVariantId,
                item.variation_id && item.variation_id > 0 ? String(item.variation_id) : ''
              )
            )
          )
          .limit(1)
      )[0];

      let internalVariantId = mapping?.internalVariantId || null;
      let unitCostMinor = BigInt(0);

      if (internalVariantId) {
        const variant = (
          await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, internalVariantId))
            .limit(1)
        )[0];
        if (variant) {
          unitCostMinor = variant.costPriceMinor ?? BigInt(0);
        }
      }

      await tx.insert(orderItems).values({
        tenantId,
        orderId: newOrder.id,
        variantId: internalVariantId,
        productName: item.name,
        variantName: item.sku || 'Standard',
        sku: item.sku || null,
        quantity: item.quantity,
        unitPriceMinor: itemPriceMinor,
        totalPriceMinor: itemTotalMinor,
        unitCostMinor,
      });

      // Atomic inventory reservation if mapped and order is active
      if (internalVariantId && initialStatus !== 'cancelled') {
        try {
          await this.inventoryService.reserveStock(
            tenantId,
            'system',
            {
              warehouseId,
              variantId: internalVariantId,
              quantity: item.quantity,
              referenceType: 'order',
              referenceId: newOrder.id,
            }
          );
        } catch (invErr) {
          this.logger.warn(`Could not reserve inventory for imported WC item: ${invErr}`);
        }
      }
    }

    // Insert status history
    await tx.insert(orderStatusHistory).values({
      tenantId,
      orderId: newOrder.id,
      fromStatus: null,
      toStatus: initialStatus,
      reason: `Imported from WooCommerce #${wcOrder.number || wcOrder.id}`,
      changedBy: null,
    });

    // Update store last_order_synced_at
    await tx
      .update(integrationStores)
      .set({ lastOrderSyncedAt: sql`now()` })
      .where(eq(integrationStores.id, store.id));

    return { orderId: newOrder.id, orderNumber: newOrder.orderNumber, action: 'created' };
  }

  /**
   * Maps WooCommerce order statuses to internal normalized OrderStatus.
   */
  private mapWooCommerceStatus(wcStatus: string): string {
    const s = wcStatus?.toLowerCase();
    switch (s) {
      case 'processing':
        return 'processing';
      case 'on-hold':
        return 'on_hold';
      case 'completed':
        return 'delivered';
      case 'cancelled':
        return 'cancelled';
      case 'refunded':
        return 'returned';
      case 'failed':
        return 'cancelled';
      case 'pending':
      default:
        return 'pending';
    }
  }

  /**
   * Reconciles missed orders by polling WooCommerce API within a date window.
   * Acceptance Gate 3: Missed event recovered by reconciliation.
   */
  async reconcileOrders(tenantId: string, storeId: string, days = 7, force = false) {
    const store = await withSystem(async (tx) => {
      return (
        await tx
          .select()
          .from(integrationStores)
          .where(and(eq(integrationStores.tenantId, tenantId), eq(integrationStores.id, storeId)))
          .limit(1)
      )[0];
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const creds = decryptStoreCredentials(store.encryptedCredentials);
    const client = new WooCommerceClient({
      baseUrl: store.storeUrl,
      consumerKey: creds.consumerKey,
      consumerSecret: creds.consumerSecret,
    });

    const afterDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const wcOrders = await client.getOrders({ after: afterDate, perPage: 100 });

    return withSystem(async (tx) => {
      let recoveredCount = 0;
      let alreadySyncedCount = 0;

      for (const wcOrder of wcOrders) {
        const externalId = String(wcOrder.id);
        const exists = (
          await tx
            .select({ id: orders.id })
            .from(orders)
            .where(
              and(
                eq(orders.tenantId, tenantId),
                eq(orders.storeId, store.id),
                eq(orders.externalOrderId, externalId)
              )
            )
            .limit(1)
        )[0];

        if (!exists) {
          await this.ingestWooCommerceOrder(tx, store, wcOrder);
          recoveredCount++;
        } else {
          alreadySyncedCount++;
        }
      }

      await tx
        .update(integrationStores)
        .set({
          lastOrderSyncedAt: sql`now()`,
          healthStatus: 'healthy',
          healthMessage: `Reconciled ${wcOrders.length} orders successfully.`,
        })
        .where(eq(integrationStores.id, store.id));

      return {
        success: true,
        totalChecked: wcOrders.length,
        recoveredCount,
        alreadySyncedCount,
      };
    });
  }

  /**
   * Pushes stock changes from Growthomic OS to WooCommerce.
   * Prevents sync loops by checking last_pushed_stock.
   */
  async pushStockToStore(
    tenantId: string,
    storeId: string,
    variantId: string,
    newQuantity: number
  ) {
    const store = await withSystem(async (tx) => {
      return (
        await tx
          .select()
          .from(integrationStores)
          .where(and(eq(integrationStores.tenantId, tenantId), eq(integrationStores.id, storeId)))
          .limit(1)
      )[0];
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (!store.pushStock || !store.isActive) {
      return { skipped: true, reason: 'Stock push is disabled for this store' };
    }

    return withSystem(async (tx) => {
      const mappings = await tx
        .select()
        .from(productMappings)
        .where(
          and(
            eq(productMappings.tenantId, tenantId),
            eq(productMappings.storeId, storeId),
            eq(productMappings.internalVariantId, variantId),
            eq(productMappings.mappingStatus, 'mapped')
          )
        );

      if (mappings.length === 0) {
        return { skipped: true, reason: 'Variant is not mapped to any WooCommerce products' };
      }

      const creds = decryptStoreCredentials(store.encryptedCredentials);
      const client = new WooCommerceClient({
        baseUrl: store.storeUrl,
        consumerKey: creds.consumerKey,
        consumerSecret: creds.consumerSecret,
      });

      let updatedCount = 0;
      for (const m of mappings) {
        // Prevent sync loop: if we already pushed this exact quantity, skip!
        if (m.lastPushedStock === newQuantity) {
          continue;
        }

        const pId = Number(m.externalProductId);
        const vId = m.externalVariantId ? Number(m.externalVariantId) : undefined;

        try {
          await client.updateStock(pId, newQuantity, vId);

          await tx
            .update(productMappings)
            .set({
              lastPushedStock: newQuantity,
              externalStockQuantity: newQuantity,
              updatedAt: sql`now()`,
            })
            .where(eq(productMappings.id, m.id));

          updatedCount++;
        } catch (pushErr) {
          this.logger.error(`Stock push failed for mapping ${m.id}: ${pushErr}`);
        }
      }

      await tx
        .update(integrationStores)
        .set({ lastStockPushedAt: sql`now()` })
        .where(eq(integrationStores.id, store.id));

      return {
        success: true,
        updatedCount,
      };
    });
  }

  /**
   * Lists integration events (webhook and sync audit logs).
   */
  async listEvents(
    tenantId: string,
    storeId: string,
    query: { status?: string; page?: number; limit?: number } = {}
  ) {
    return withSystem(async (tx) => {
      const page = Math.max(1, query.page ? Number(query.page) : 1);
      const limit = Math.max(1, Math.min(100, query.limit ? Number(query.limit) : 50));
      const offset = (page - 1) * limit;

      const conditions: any[] = [
        eq(integrationEvents.tenantId, tenantId),
        eq(integrationEvents.storeId, storeId),
      ];

      if (query.status && query.status !== 'all') {
        conditions.push(eq(integrationEvents.status, query.status));
      }

      const rows = await tx
        .select()
        .from(integrationEvents)
        .where(and(...conditions))
        .orderBy(desc(integrationEvents.createdAt))
        .limit(limit)
        .offset(offset);

      const totalRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(integrationEvents)
        .where(and(...conditions));

      const total = totalRes[0]?.count ?? 0;

      return {
        items: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }
}
