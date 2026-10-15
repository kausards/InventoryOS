import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, or, sql, desc, ilike } from 'drizzle-orm';
import {
  withSystem,
  products,
  productVariants,
  productBundles,
  categories,
  brands,
  warehouses,
  warehouseStockBalances,
  inventoryMovements,
  auditLogs,
} from '@growthomic/db';
import type { CreateProductInput, UpdateProductInput, UpdateVariantInput } from '@growthomic/shared';
import { calculateBundleAvailability } from '@growthomic/shared';

@Injectable()
export class ProductsService {
  async listProducts(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      categoryId?: string;
      brandId?: string;
      status?: string;
    } = {}
  ) {
    return withSystem(async (tx) => {
      const page = Math.max(1, params.page ?? 1);
      const limit = Math.min(100, Math.max(1, params.limit ?? 20));
      const offset = (page - 1) * limit;

      const conditions = [eq(products.tenantId, tenantId)];

      if (params.status) {
        conditions.push(eq(products.status, params.status));
      }
      if (params.categoryId) {
        conditions.push(eq(products.categoryId, params.categoryId));
      }
      if (params.brandId) {
        conditions.push(eq(products.brandId, params.brandId));
      }
      if (params.search) {
        const query = `%${params.search}%`;
        conditions.push(
          or(
            ilike(products.name, query),
            ilike(products.slug, query)
          )!
        );
      }

      // Fetch products
      const rows = await tx
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          description: products.description,
          type: products.type,
          status: products.status,
          imageUrl: products.imageUrl,
          categoryId: products.categoryId,
          categoryName: categories.name,
          brandId: products.brandId,
          brandName: brands.name,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(brands, eq(products.brandId, brands.id))
        .where(and(...conditions))
        .orderBy(desc(products.createdAt))
        .limit(limit)
        .offset(offset);

      // Fetch variants and stock balances for these products
      const productIds = rows.map((p) => p.id);
      let variantsList: any[] = [];
      let balancesList: any[] = [];

      if (productIds.length > 0) {
        variantsList = await tx
          .select()
          .from(productVariants)
          .where(and(eq(productVariants.tenantId, tenantId), sql`${productVariants.productId} IN ${productIds}`));

        const variantIds = variantsList.map((v) => v.id);
        if (variantIds.length > 0) {
          balancesList = await tx
            .select()
            .from(warehouseStockBalances)
            .where(and(eq(warehouseStockBalances.tenantId, tenantId), sql`${warehouseStockBalances.variantId} IN ${variantIds}`));
        }
      }

      // Map enriched products
      const items = rows.map((product) => {
        const variants = variantsList.filter((v) => v.productId === product.id);
        const enrichedVariants = variants.map((v) => {
          const balance = balancesList.find((b) => b.variantId === v.id);
          return {
            id: v.id,
            sku: v.sku,
            barcode: v.barcode,
            name: v.name,
            options: v.options,
            retailPrice: Number(v.retailPrice),
            wholesalePrice: v.wholesalePrice ? Number(v.wholesalePrice) : null,
            purchaseCost: Number(v.purchaseCost),
            lowStockThreshold: v.lowStockThreshold,
            onHand: balance?.onHand ?? 0,
            reserved: balance?.reserved ?? 0,
            available: balance?.available ?? 0,
          };
        });

        const totalOnHand = enrichedVariants.reduce((sum, v) => sum + v.onHand, 0);
        const totalAvailable = enrichedVariants.reduce((sum, v) => sum + v.available, 0);

        return {
          ...product,
          variantCount: variants.length,
          totalOnHand,
          totalAvailable,
          variants: enrichedVariants,
        };
      });

      // Total count
      const totalCountRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(and(...conditions));

      const total = totalCountRes[0]?.count ?? 0;

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

  async getProductById(tenantId: string, productId: string) {
    return withSystem(async (tx) => {
      const rows = await tx
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          description: products.description,
          type: products.type,
          status: products.status,
          imageUrl: products.imageUrl,
          categoryId: products.categoryId,
          categoryName: categories.name,
          brandId: products.brandId,
          brandName: brands.name,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(brands, eq(products.brandId, brands.id))
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
        .limit(1);

      const product = rows[0];
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      const variants = await tx
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.productId, productId), eq(productVariants.tenantId, tenantId)));

      const variantIds = variants.map((v) => v.id);
      const balances = variantIds.length > 0
        ? await tx
            .select()
            .from(warehouseStockBalances)
            .where(and(eq(warehouseStockBalances.tenantId, tenantId), sql`${warehouseStockBalances.variantId} IN ${variantIds}`))
        : [];

      const enrichedVariants = variants.map((v) => {
        const balance = balances.find((b) => b.variantId === v.id);
        return {
          id: v.id,
          sku: v.sku,
          barcode: v.barcode,
          name: v.name,
          options: v.options,
          retailPrice: Number(v.retailPrice),
          wholesalePrice: v.wholesalePrice ? Number(v.wholesalePrice) : null,
          purchaseCost: Number(v.purchaseCost),
          lowStockThreshold: v.lowStockThreshold,
          weightGrams: v.weightGrams,
          status: v.status,
          onHand: balance?.onHand ?? 0,
          reserved: balance?.reserved ?? 0,
          available: balance?.available ?? 0,
        };
      });

      // If bundle, load bundle components
      let bundleComponentsList: any[] = [];
      let bundleAvailable = 0;
      if (product.type === 'bundle') {
        const bundleRows = await tx
          .select({
            id: productBundles.id,
            componentVariantId: productBundles.componentVariantId,
            quantity: productBundles.quantity,
            variantName: productVariants.name,
            sku: productVariants.sku,
          })
          .from(productBundles)
          .innerJoin(productVariants, eq(productBundles.componentVariantId, productVariants.id))
          .where(and(eq(productBundles.bundleProductId, productId), eq(productBundles.tenantId, tenantId)));

        const compVariantIds = bundleRows.map((b) => b.componentVariantId);
        const compBalances = compVariantIds.length > 0
          ? await tx
              .select()
              .from(warehouseStockBalances)
              .where(and(eq(warehouseStockBalances.tenantId, tenantId), sql`${warehouseStockBalances.variantId} IN ${compVariantIds}`))
          : [];

        bundleComponentsList = bundleRows.map((comp) => {
          const bal = compBalances.find((b) => b.variantId === comp.componentVariantId);
          return {
            ...comp,
            onHand: bal?.onHand ?? 0,
            reserved: bal?.reserved ?? 0,
            available: bal?.available ?? 0,
          };
        });

        bundleAvailable = calculateBundleAvailability(
          bundleComponentsList.map((c) => ({
            onHand: c.onHand,
            reserved: c.reserved,
            requiredQuantity: c.quantity,
          }))
        );
      }

      return {
        ...product,
        variants: enrichedVariants,
        bundleComponents: bundleComponentsList,
        bundleAvailable: product.type === 'bundle' ? bundleAvailable : undefined,
      };
    });
  }

  async createProduct(
    tenantId: string,
    actorId: string,
    dto: CreateProductInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      // 1. Ensure a default warehouse exists for the tenant
      let defaultWarehouse = (
        await tx
          .select()
          .from(warehouses)
          .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.isDefault, true)))
          .limit(1)
      )[0];

      if (!defaultWarehouse) {
        const insertedWh = await tx
          .insert(warehouses)
          .values({
            tenantId,
            name: 'Main Warehouse',
            code: 'WH-MAIN',
            isDefault: true,
          })
          .returning();
        defaultWarehouse = insertedWh[0]!;
      }

      // 2. Generate slug with collision check
      const baseSlug = dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || 'product';

      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existing = await tx
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.tenantId, tenantId), eq(products.slug, slug)))
          .limit(1);
        if (!existing[0]) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // 3. Insert product
      const insertedProduct = await tx
        .insert(products)
        .values({
          tenantId,
          name: dto.name,
          slug,
          description: dto.description ?? null,
          type: dto.type,
          categoryId: dto.categoryId ?? null,
          brandId: dto.brandId ?? null,
          imageUrl: dto.imageUrl ?? null,
          status: 'active',
        })
        .returning();

      const newProduct = insertedProduct[0]!;

      // 4. Insert variants
      const createdVariants: any[] = [];
      for (const vDto of dto.variants) {
        // SKU uniqueness check in tenant
        const skuConflict = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.sku, vDto.sku)))
          .limit(1);

        if (skuConflict[0]) {
          throw new BadRequestException(`SKU "${vDto.sku}" is already in use in this organization`);
        }

        const insertedVar = await tx
          .insert(productVariants)
          .values({
            tenantId,
            productId: newProduct.id,
            sku: vDto.sku,
            barcode: vDto.barcode ?? null,
            name: vDto.name,
            options: vDto.options,
            retailPrice: BigInt(vDto.retailPrice),
            wholesalePrice: vDto.wholesalePrice !== undefined && vDto.wholesalePrice !== null ? BigInt(vDto.wholesalePrice) : null,
            purchaseCost: BigInt(vDto.purchaseCost),
            lowStockThreshold: vDto.lowStockThreshold,
            weightGrams: vDto.weightGrams,
            status: 'active',
          })
          .returning();

        const newVar = insertedVar[0]!;

        // 5. Initial stock handling via immutable ledger & stock balance
        const initialStock = vDto.initialStock ?? 0;
        await tx.insert(warehouseStockBalances).values({
          tenantId,
          warehouseId: defaultWarehouse.id,
          variantId: newVar.id,
          onHand: initialStock,
          reserved: 0,
          available: initialStock,
        });

        if (initialStock > 0) {
          await tx.insert(inventoryMovements).values({
            tenantId,
            warehouseId: defaultWarehouse.id,
            variantId: newVar.id,
            type: 'opening',
            quantity: initialStock,
            referenceType: 'manual',
            reason: 'Initial Opening Stock',
            unitCost: BigInt(vDto.purchaseCost),
            actorId,
          });
        }

        createdVariants.push({
          ...newVar,
          retailPrice: Number(newVar.retailPrice),
          wholesalePrice: newVar.wholesalePrice ? Number(newVar.wholesalePrice) : null,
          purchaseCost: Number(newVar.purchaseCost),
          onHand: initialStock,
          available: initialStock,
        });
      }

      // 6. Handle bundle components if type === 'bundle'
      if (dto.type === 'bundle' && dto.bundleComponents && dto.bundleComponents.length > 0) {
        for (const comp of dto.bundleComponents) {
          await tx.insert(productBundles).values({
            tenantId,
            bundleProductId: newProduct.id,
            componentVariantId: comp.componentVariantId,
            quantity: comp.quantity,
          });
        }
      }

      // 7. Audit log
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'product.create',
        entityType: 'product',
        entityId: newProduct.id,
        after: { name: newProduct.name, sku: dto.variants[0]?.sku },
        requestId: requestId ?? null,
      });

      return {
        ...newProduct,
        variants: createdVariants,
      };
    });
  }

  async updateProduct(
    tenantId: string,
    actorId: string,
    productId: string,
    dto: UpdateProductInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(products)
          .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!existing) {
        throw new NotFoundException('Product not found');
      }

      const updateData: any = { updatedAt: sql`now()` };
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
      if (dto.brandId !== undefined) updateData.brandId = dto.brandId;
      if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;

      const updated = await tx
        .update(products)
        .set(updateData)
        .where(eq(products.id, productId))
        .returning();

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'product.update',
        entityType: 'product',
        entityId: productId,
        after: updateData,
        requestId: requestId ?? null,
      });

      return updated[0];
    });
  }

  async updateVariant(
    tenantId: string,
    actorId: string,
    variantId: string,
    dto: UpdateVariantInput,
    requestId?: string
  ) {
    return withSystem(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(productVariants)
          .where(and(eq(productVariants.id, variantId), eq(productVariants.tenantId, tenantId)))
          .limit(1)
      )[0];

      if (!existing) {
        throw new NotFoundException('Variant not found');
      }

      const updateData: any = { updatedAt: sql`now()` };
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.barcode !== undefined) updateData.barcode = dto.barcode;
      if (dto.retailPrice !== undefined) updateData.retailPrice = BigInt(dto.retailPrice);
      if (dto.wholesalePrice !== undefined) updateData.wholesalePrice = dto.wholesalePrice !== null ? BigInt(dto.wholesalePrice) : null;
      if (dto.purchaseCost !== undefined) updateData.purchaseCost = BigInt(dto.purchaseCost);
      if (dto.lowStockThreshold !== undefined) updateData.lowStockThreshold = dto.lowStockThreshold;
      if (dto.weightGrams !== undefined) updateData.weightGrams = dto.weightGrams;
      if (dto.status !== undefined) updateData.status = dto.status;

      const updated = await tx
        .update(productVariants)
        .set(updateData)
        .where(eq(productVariants.id, variantId))
        .returning();

      await tx.insert(auditLogs).values({
        tenantId,
        actorType: 'user',
        actorId,
        action: 'variant.update',
        entityType: 'product_variant',
        entityId: variantId,
        after: { sku: existing.sku, changes: dto },
        requestId: requestId ?? null,
      });

      return updated[0];
    });
  }

  // Categories & Brands helpers
  async listCategories(tenantId: string) {
    return withSystem(async (tx) => {
      return tx
        .select()
        .from(categories)
        .where(eq(categories.tenantId, tenantId))
        .orderBy(categories.name);
    });
  }

  async createCategory(tenantId: string, name: string) {
    return withSystem(async (tx) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'category';
      const inserted = await tx
        .insert(categories)
        .values({ tenantId, name, slug })
        .returning();
      return inserted[0];
    });
  }

  async listBrands(tenantId: string) {
    return withSystem(async (tx) => {
      return tx
        .select()
        .from(brands)
        .where(eq(brands.tenantId, tenantId))
        .orderBy(brands.name);
    });
  }

  async createBrand(tenantId: string, name: string) {
    return withSystem(async (tx) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'brand';
      const inserted = await tx
        .insert(brands)
        .values({ tenantId, name, slug })
        .returning();
      return inserted[0];
    });
  }
}
