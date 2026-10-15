import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    triggerEvent: text('trigger_event').notNull(), // 'order_created', 'order_shipped', etc.
    channel: text('channel').notNull(), // 'sms' | 'whatsapp' | 'in_app' | 'email'
    language: text('language').notNull().default('bn'), // 'bn' | 'en'
    content: text('content').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('idx_notification_templates_tenant').on(table.tenantId),
    tenantEventIdx: index('idx_notification_templates_event').on(table.tenantId, table.triggerEvent, table.channel),
  })
);
