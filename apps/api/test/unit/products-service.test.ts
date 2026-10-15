import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../../src/products/products.service';
import * as dbModule from '@growthomic/db';

describe('ProductsService - Products, Variants & Bundles', () => {
  let service: ProductsService;

  beforeEach(() => {
    service = new ProductsService();
    vi.restoreAllMocks();
  });

  it('createProduct rejects if SKU is already in use in the tenant', async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Warehouse lookup
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'wh-1' }]),
    });

    // 2. Slug check
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    // 3. Insert product
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'prod-1', name: 'Cotton T-Shirt' }]),
      }),
    });

    // 4. SKU collision check -> conflict exists!
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'var-existing' }]),
    });

    await expect(
      service.createProduct('t-1', 'actor-1', {
        name: 'Cotton T-Shirt',
        type: 'standard',
        variants: [
          {
            sku: 'TSHIRT-BLK-L',
            name: 'Black Large',
            retailPrice: 50000,
            options: { color: 'Black', size: 'L' },
          },
        ],
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('createProduct creates product, variant, stock balance and opening movement for initialStock > 0', async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Warehouse lookup: default warehouse exists
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'wh-1', name: 'Main Warehouse' }]),
    });

    // 2. Slug check: no collision
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    // 3. Insert product
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          { id: 'prod-1', name: 'Wireless Mouse', slug: 'wireless-mouse', type: 'standard' },
        ]),
      }),
    });

    // 4. SKU collision check: no conflict
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    // 5. Insert variant
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'var-1',
            sku: 'WM-01',
            name: 'Default',
            retailPrice: BigInt(120000),
            purchaseCost: BigInt(70000),
          },
        ]),
      }),
    });

    // 6. Insert warehouse_stock_balances
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    // 7. Insert opening inventory_movements
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    // 8. Insert audit_logs
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    const res = await service.createProduct('t-1', 'actor-1', {
      name: 'Wireless Mouse',
      type: 'standard',
      variants: [
        {
          sku: 'WM-01',
          name: 'Default',
          retailPrice: 120000,
          purchaseCost: 70000,
          initialStock: 25,
          options: {},
        },
      ],
    });

    expect(res.name).toBe('Wireless Mouse');
    expect(res.variants[0].sku).toBe('WM-01');
    expect(res.variants[0].onHand).toBe(25);
    expect(mockTx.insert).toHaveBeenCalledTimes(5); // product, variant, stock_balance, ledger movement, audit
  });

  it('getProductById throws NotFoundException when product does not exist in tenant', async () => {
    const mockTx = {
      select: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    await expect(service.getProductById('t-1', 'prod-missing')).rejects.toThrow(NotFoundException);
  });

  it('updateVariant modifies variant catalog prices without mutating historical inventory movements ledger costs', async () => {
    const mockTx = {
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Existing variant lookup: purchaseCost = 50,000 paisa, retailPrice = 80,000 paisa
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 'var-1',
          sku: 'SKU-OLD',
          retailPrice: BigInt(80000),
          purchaseCost: BigInt(50000),
        },
      ]),
    });

    // 2. Update variant with new price and cost (retailPrice: 95,000 paisa, purchaseCost: 65,000 paisa)
    mockTx.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'var-1',
              sku: 'SKU-OLD',
              retailPrice: BigInt(95000),
              purchaseCost: BigInt(65000),
            },
          ]),
        }),
      }),
    });

    // 3. Audit log insert
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    const res = await service.updateVariant('t-1', 'actor-1', 'var-1', {
      retailPrice: 95000,
      purchaseCost: 65000,
    });

    expect(res.retailPrice).toBe(BigInt(95000));
    expect(res.purchaseCost).toBe(BigInt(65000));
    // Verify that update was performed only on productVariants table, NOT inventoryMovements
    expect(mockTx.update).toHaveBeenCalledTimes(1);
    // Audit log recorded
    expect(mockTx.insert).toHaveBeenCalledTimes(1);
  });
});

