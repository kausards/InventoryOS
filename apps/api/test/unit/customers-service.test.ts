import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomersService } from '../../src/customers/customers.service';
import * as dbModule from '@growthomic/db';

describe('CustomersService - CRM & Normalization', () => {
  let service: CustomersService;

  beforeEach(() => {
    service = new CustomersService();
    vi.restoreAllMocks();
  });

  it('normalizes Bangladesh phone to E.164 and creates customer with address', async () => {
    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // 1. Check existing customer with normalized phone -> none
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    // 2. Insert customer
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'cust-1',
            name: 'Akram Khan',
            phone: '01812345678',
            normalizedPhone: '+8801812345678',
            totalSpentMinor: BigInt(0),
          },
        ]),
      }),
    });

    // 3. Insert address
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'addr-1',
            division: 'Chattogram',
            district: 'Chattogram',
            streetAddress: 'GEC Circle',
          },
        ]),
      }),
    });

    // 4. Insert audit log
    mockTx.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue({}),
    });

    const res = await service.createCustomer('t-1', 'actor-1', {
      name: 'Akram Khan',
      phone: '01812345678',
      address: {
        division: 'Chattogram',
        district: 'Chattogram',
        streetAddress: 'GEC Circle',
        label: 'Home',
        isDefault: true,
      },
    });

    expect(res.name).toBe('Akram Khan');
    expect(res.normalizedPhone).toBe('+8801812345678');
    expect(res.defaultAddress?.district).toBe('Chattogram');
  });

  it('rejects duplicate customer creation with the same phone in the same tenant', async () => {
    const mockTx = {
      select: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    // Existing customer found
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 'cust-existing', phone: '01712345678' },
      ]),
    });

    await expect(
      service.createCustomer('t-1', 'actor-1', {
        name: 'Another Person',
        phone: '01712345678',
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('getCustomerById throws NotFoundException for cross-tenant access', async () => {
    const mockTx = {
      select: vi.fn(),
    };
    vi.spyOn(dbModule, 'withSystem').mockImplementation(async (cb: any) => cb(mockTx));

    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    await expect(service.getCustomerById('t-1', 'missing-cust')).rejects.toThrow(
      NotFoundException
    );
  });
});
