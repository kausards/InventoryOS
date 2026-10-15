import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { customers } from './customers';

export const customerConsents = pgTable(
  'customer_consents',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    phone: text('phone').notNull(),
    channel: text('channel').notNull(), // 'sms' | 'whatsapp'
    consentStatus: text('consent_status').notNull().default('opted_in'), // 'opted_in' | 'opted_out'
    optedOutAt: timestamp('opted_out_at', { withTimezone: true, mode: 'string' }),
    optOutReason: text('opt_out_reason'),
    source: text('source').notNull().default('checkout'), // 'checkout' | 'crm' | 'sms_keyword' | 'manual'
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('idx_customer_consents_tenant').on(table.tenantId),
    tenantPhoneChannelUnique: uniqueIndex('idx_customer_consents_phone_channel').on(table.tenantId, table.phone, table.channel),
  })
);
