import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const courierAccounts = pgTable(
  'courier_accounts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    courierCode: text('courier_code').notNull(), // 'steadfast' | 'pathao' | 'redx'
    accountName: text('account_name').notNull(),
    encryptedCredentials: text('encrypted_credentials').notNull(), // AES-256-GCM ciphertext
    senderName: text('sender_name'),
    senderPhone: text('sender_phone'),
    senderAddress: text('sender_address'),
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    testMode: boolean('test_mode').notNull().default(false),
    lastConnectionTestAt: timestamp('last_connection_test_at', { withTimezone: true, mode: 'string' }),
    lastConnectionStatus: text('last_connection_status'), // 'connected' | 'failed'
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_courier_accounts_tenant').on(table.tenantId),
    index('idx_courier_accounts_tenant_code').on(table.tenantId, table.courierCode),
  ]
);
