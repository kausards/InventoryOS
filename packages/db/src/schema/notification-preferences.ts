import { pgTable, uuid, text, boolean, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channelSmsEnabled: boolean('channel_sms_enabled').notNull().default(true),
    channelWhatsappEnabled: boolean('channel_whatsapp_enabled').notNull().default(true),
    channelEmailEnabled: boolean('channel_email_enabled').notNull().default(true),
    channelInAppEnabled: boolean('channel_in_app_enabled').notNull().default(true),
    smsProvider: text('sms_provider').notNull().default('elitbuzz'), // 'elitbuzz' | 'greenweb' | 'mock'
    smsApiKey: text('sms_api_key'),
    smsSenderId: text('sms_sender_id'),
    whatsappProvider: text('whatsapp_provider').notNull().default('mock'), // 'meta_cloud' | 'twilio' | 'mock'
    whatsappApiToken: text('whatsapp_api_token'),
    whatsappPhoneNumberId: text('whatsapp_phone_number_id'),
    eventsConfig: jsonb('events_config').default(sql`'{"order_created": true, "order_confirmed": true, "order_shipped": true, "order_delivered": true}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantUnique: uniqueIndex('idx_notification_preferences_tenant').on(table.tenantId),
  })
);
