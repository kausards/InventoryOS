import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  withSystem,
  importBatches,
  products,
  productVariants,
  warehouses,
  warehouseStockBalances,
  inventoryMovements,
  customers,
  customerAddresses,
  orders,
  orderItems,
  orderStatusHistory,
  auditLogs,
} from '@growthomic/db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import {
  importProductRowSchema,
  importCustomerRowSchema,
  importOrderRowSchema,
  cleanImportCell,
} from '@growthomic/shared';
import type {
  DryRunImportInput,
  CommitImportInput,
  ImportEntityType,
} from '@growthomic/shared';

@Injectable()
export class ImportsService {
  /**
   * Dry-run validation of CSV rows against strict schemas and anti-formula injection checks
   */
  async dryRun(tenantId: string, dto: DryRunImportInput) {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const validRows: any[] = [];

    const schemaMap = {
      products: importProductRowSchema,
      customers: importCustomerRowSchema,
      orders: importOrderRowSchema,
    };

    const schema = schemaMap[dto.entityType as ImportEntityType];
    if (!schema) {
      throw new BadRequestException(`Unsupported import entity type: ${dto.entityType}`);
    }

    dto.rows.forEach((rawRow, index) => {
      const rowNumber = index + 1;
      const parsed = schema.safeParse(rawRow);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          errors.push({
            row: rowNumber,
            field: issue.path.join('.') || 'row',
            message: issue.message,
          });
        });
      } else {
        validRows.push(parsed.data);
      }
    });

    return {
      entityType: dto.entityType,
      fileName: dto.fileName,
      totalRows: dto.rows.length,
      validRows: validRows.length,
      invalidRows: errors.length,
      errors: errors.slice(0, 50), // Cap error preview at 50 to avoid massive payloads
      preview: validRows.slice(0, 10),
    };
  }

  /**
   * Commit parsed CSV rows to database and create tracking batch
   */
  async commit(
    tenantId: string,
    userId: string,
    dto: CommitImportInput,
    requestId?: string
  ) {
    const schemaMap = {
      products: importProductRowSchema,
      customers: importCustomerRowSchema,
      orders: importOrderRowSchema,
    };

    const schema = schemaMap[dto.entityType as ImportEntityType];
    if (!schema) {
      throw new BadRequestException(`Unsupported import entity type: ${dto.entityType}`);
    }

    // Validate rows
    const validRows: any[] = [];
    const validationErrors: Array<{ row: number; error: string }> = [];

    dto.rows.forEach((rawRow, idx) => {
      const parsed = schema.safeParse(rawRow);
      if (parsed.success) {
        validRows.push(parsed.data);
      } else {
        validationErrors.push({
          row: idx + 1,
          error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
        });
      }
    });

    if (validRows.length === 0) {
      throw new BadRequestException('No valid rows available to import.');
    }

    return withSystem(async (tx) => {
      const createdIds: string[] = [];

      // 1. PRODUCTS IMPORT
      if (dto.entityType === 'products') {
        // Resolve or create warehouse
        let [defaultWarehouse] = await tx
          .select()
          .from(warehouses)
          .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.status, 'active')))
          .limit(1);

        if (!defaultWarehouse) {
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
          defaultWarehouse = newWh!;
        }

        for (const row of validRows) {
          const slug = `${cleanImportCell(row.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          
          const [product] = await tx
            .insert(products)
            .values({
              tenantId,
              name: cleanImportCell(row.name),
              slug,
              description: row.category ? `Category: ${cleanImportCell(row.category)}` : null,
              status: 'active',
            })
            .returning();

          const [variant] = await tx
            .insert(productVariants)
            .values({
              tenantId,
              productId: product!.id,
              sku: cleanImportCell(row.sku),
              name: 'Default',
              retailPrice: BigInt(Math.round(row.retailPrice * 100)),
              purchaseCost: BigInt(Math.round((row.purchaseCost ?? 0) * 100)),
              status: 'active',
            })
            .returning();

          if (defaultWarehouse && row.stockQuantity > 0) {
            await tx.insert(warehouseStockBalances).values({
              tenantId,
              warehouseId: defaultWarehouse.id,
              variantId: variant!.id,
              onHand: row.stockQuantity,
              available: row.stockQuantity,
              reserved: 0,
            });

            await tx.insert(inventoryMovements).values({
              tenantId,
              warehouseId: defaultWarehouse.id,
              variantId: variant!.id,
              type: 'opening',
              quantity: row.stockQuantity,
              referenceType: 'manual',
              actorId: userId,
              note: `CSV Batch import from ${cleanImportCell(dto.fileName)}`,
            });
          }

          createdIds.push(product!.id);
        }
      }

      // 2. CUSTOMERS IMPORT
      else if (dto.entityType === 'customers') {
        for (const row of validRows) {
          const [existing] = await tx
            .select()
            .from(customers)
            .where(and(eq(customers.tenantId, tenantId), eq(customers.normalizedPhone, row.phone)))
            .limit(1);

          if (existing) {
            createdIds.push(existing.id);
            continue;
          }

          const [cust] = await tx
            .insert(customers)
            .values({
              tenantId,
              name: cleanImportCell(row.name),
              phone: row.phone,
              normalizedPhone: row.phone,
              notes: 'Imported via CSV batch',
            })
            .returning();

          if (row.address || row.division || row.district) {
            await tx.insert(customerAddresses).values({
              tenantId,
              customerId: cust!.id,
              streetAddress: row.address ? cleanImportCell(row.address) : 'Dhaka, Bangladesh',
              division: row.division ?? 'Dhaka',
              district: row.district ?? 'Dhaka',
              upazilaThana: row.upazilaThana ? cleanImportCell(row.upazilaThana) : 'Dhaka',
              isDefault: true,
            });
          }

          createdIds.push(cust!.id);
        }
      }

      // 3. ORDERS IMPORT
      else if (dto.entityType === 'orders') {
        let [defaultWarehouse] = await tx
          .select()
          .from(warehouses)
          .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.status, 'active')))
          .limit(1);

        if (!defaultWarehouse) {
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
          defaultWarehouse = newWh!;
        }

        const countRes = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(orders)
          .where(eq(orders.tenantId, tenantId));
        let sequence = (countRes[0]?.count ?? 0) + 1;

        for (const row of validRows) {
          // Resolve or create customer
          let [cust] = await tx
            .select()
            .from(customers)
            .where(and(eq(customers.tenantId, tenantId), eq(customers.normalizedPhone, row.customerPhone)))
            .limit(1);

          if (!cust) {
            const [newCust] = await tx
              .insert(customers)
              .values({
                tenantId,
                name: cleanImportCell(row.customerName),
                phone: row.customerPhone,
                normalizedPhone: row.customerPhone,
                notes: 'Created via order import',
              })
              .returning();
            cust = newCust!;
          }

          // Resolve variant or create placeholder
          let [variant] = await tx
            .select()
            .from(productVariants)
            .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.sku, row.sku)))
            .limit(1);

          if (!variant) {
            const [newProd] = await tx
              .insert(products)
              .values({
                tenantId,
                name: `Product ${row.sku}`,
                slug: `prod-${row.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
                status: 'active',
              })
              .returning();

            const [newVar] = await tx
              .insert(productVariants)
              .values({
                tenantId,
                productId: newProd!.id,
                sku: row.sku,
                name: 'Default',
                retailPrice: BigInt(Math.round(row.unitPrice * 100)),
                purchaseCost: BigInt(0),
                status: 'active',
              })
              .returning();

            variant = newVar!;
          }

          const orderNum = row.orderNumber
            ? cleanImportCell(row.orderNumber)
            : `IMP-${Date.now().toString(36).toUpperCase()}-${sequence}`;

          const subtotalMinor = BigInt(Math.round(row.unitPrice * row.quantity * 100));
          const deliveryMinor = BigInt(Math.round((row.deliveryCharge ?? 60) * 100));
          const totalAmountMinor = subtotalMinor + deliveryMinor;

          const [order] = await tx
            .insert(orders)
            .values({
              tenantId,
              orderNumber: orderNum,
              orderSequence: sequence++,
              customerId: cust.id,
              warehouseId: defaultWarehouse.id,
              source: 'import',
              orderStatus: row.orderStatus ?? 'delivered',
              paymentStatus: row.paymentMethod === 'cod' && row.orderStatus !== 'delivered' ? 'unpaid' : 'paid',
              paymentMethod: row.paymentMethod ?? 'cod',
              currency: 'BDT',
              subtotalMinor,
              deliveryChargeMinor: deliveryMinor,
              totalAmountMinor,
            })
            .returning();

          await tx.insert(orderItems).values({
            tenantId,
            orderId: order!.id,
            productId: variant.productId,
            variantId: variant.id,
            productName: `Product ${row.sku}`,
            variantName: 'Default',
            sku: row.sku,
            quantity: row.quantity,
            unitPriceMinor: BigInt(Math.round(row.unitPrice * 100)),
            totalPriceMinor: subtotalMinor,
          });

          await tx.insert(orderStatusHistory).values({
            tenantId,
            orderId: order!.id,
            fromStatus: 'pending',
            toStatus: row.orderStatus ?? 'delivered',
            actorType: 'user',
            actorId: userId,
            notes: 'Imported via historical CSV batch',
          });

          createdIds.push(order!.id);
        }
      }

      // Record Import Batch
      const [batch] = await tx
        .insert(importBatches)
        .values({
          tenantId,
          entityType: dto.entityType,
          fileName: cleanImportCell(dto.fileName),
          totalRows: dto.rows.length,
          successfulRows: createdIds.length,
          failedRows: dto.rows.length - createdIds.length,
          status: 'completed',
          importedIds: createdIds,
          errors: validationErrors.length > 0 ? validationErrors : null,
          createdBy: userId,
        })
        .returning();

      // Audit Log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'IMPORT_COMMITTED',
        entityType: 'import_batch',
        entityId: batch!.id,
        requestId,
        after: {
          entityType: dto.entityType,
          fileName: dto.fileName,
          totalRows: dto.rows.length,
          successfulRows: createdIds.length,
        },
      });

      return {
        batch,
        message: `Successfully imported ${createdIds.length} ${dto.entityType}.`,
      };
    });
  }

  /**
   * List import history / batches
   */
  async listBatches(tenantId: string, page = 1, limit = 20) {
    return withSystem(async (tx) => {
      const p = Math.max(1, page);
      const l = Math.max(1, Math.min(100, limit));
      const offset = (p - 1) * l;

      const items = await tx
        .select()
        .from(importBatches)
        .where(eq(importBatches.tenantId, tenantId))
        .orderBy(desc(importBatches.createdAt))
        .limit(l)
        .offset(offset);

      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(importBatches)
        .where(eq(importBatches.tenantId, tenantId));

      const total = countRes[0]?.count ?? 0;

      return {
        items,
        pagination: {
          page: p,
          limit: l,
          total,
          totalPages: Math.ceil(total / l),
        },
      };
    });
  }

  /**
   * Undo Last Batch / rollback imported records
   */
  async undoBatch(tenantId: string, userId: string, batchId: string, requestId?: string) {
    return withSystem(async (tx) => {
      const [batch] = await tx
        .select()
        .from(importBatches)
        .where(and(eq(importBatches.tenantId, tenantId), eq(importBatches.id, batchId)))
        .limit(1);

      if (!batch) {
        throw new NotFoundException(`Import batch with ID ${batchId} not found.`);
      }

      if (batch.status === 'reverted') {
        throw new BadRequestException('This batch has already been reverted.');
      }

      const importedIds = (batch.importedIds as string[]) || [];

      if (importedIds.length > 0) {
        if (batch.entityType === 'products') {
          // Find variants
          const variants = await tx
            .select({ id: productVariants.id })
            .from(productVariants)
            .where(
              and(
                eq(productVariants.tenantId, tenantId),
                inArray(productVariants.productId, importedIds)
              )
            );
          const variantIds = variants.map((v) => v.id);

          if (variantIds.length > 0) {
            await tx
              .delete(warehouseStockBalances)
              .where(
                and(
                  eq(warehouseStockBalances.tenantId, tenantId),
                  inArray(warehouseStockBalances.variantId, variantIds)
                )
              );

            await tx
              .delete(inventoryMovements)
              .where(
                and(
                  eq(inventoryMovements.tenantId, tenantId),
                  inArray(inventoryMovements.variantId, variantIds)
                )
              );

            await tx
              .delete(productVariants)
              .where(
                and(
                  eq(productVariants.tenantId, tenantId),
                  inArray(productVariants.id, variantIds)
                )
              );
          }

          await tx
            .delete(products)
            .where(and(eq(products.tenantId, tenantId), inArray(products.id, importedIds)));
        } else if (batch.entityType === 'customers') {
          await tx
            .delete(customerAddresses)
            .where(
              and(
                eq(customerAddresses.tenantId, tenantId),
                inArray(customerAddresses.customerId, importedIds)
              )
            );

          await tx
            .delete(customers)
            .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, importedIds)));
        } else if (batch.entityType === 'orders') {
          await tx
            .delete(orderItems)
            .where(
              and(
                eq(orderItems.tenantId, tenantId),
                inArray(orderItems.orderId, importedIds)
              )
            );

          await tx
            .delete(orderStatusHistory)
            .where(
              and(
                eq(orderStatusHistory.tenantId, tenantId),
                inArray(orderStatusHistory.orderId, importedIds)
              )
            );

          await tx
            .delete(orders)
            .where(and(eq(orders.tenantId, tenantId), inArray(orders.id, importedIds)));
        }
      }

      // Mark batch as reverted
      const [updatedBatch] = await tx
        .update(importBatches)
        .set({
          status: 'reverted',
          revertedAt: new Date().toISOString(),
          revertedBy: userId,
        })
        .where(and(eq(importBatches.tenantId, tenantId), eq(importBatches.id, batchId)))
        .returning();

      // Audit Log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'IMPORT_REVERTED',
        entityType: 'import_batch',
        entityId: batchId,
        requestId,
        after: {
          revertedRecords: importedIds.length,
          entityType: batch.entityType,
        },
      });

      return {
        success: true,
        message: `Successfully reverted import batch ${batchId}.`,
        revertedCount: importedIds.length,
        batch: updatedBatch,
      };
    });
  }
}
