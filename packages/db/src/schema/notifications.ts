import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { customers } from './customers';
import { orders } from './orders';
import { notificationTemplates } from './notification-templates';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    recipient: text('recipient').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    channel: text('channel').notNull(), // 'in_app' | 'sms' | 'whatsapp' | 'email'
    type: text('type').notNull().default('customer_alert'), // 'customer_alert' | 'staff_alert' | 'system_alert'
    templateId: uuid('template_id').references(() => notificationTemplates.id, { onDelete: 'set null' }),
    title: text('title'),
    content: text('content').notNull(),
    status: text('status').notNull().default('queued'), // 'queued' | 'sent' | 'delivered' | 'failed' | 'credit_exhausted' | 'opted_out'
    creditsDeducted: integer('credits_deducted').notNull().default(0),
    externalMessageId: text('external_message_id'),
    retryCount: integer('retry_count').notNull().default(0),
    errorDetails: text('error_details'),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }), // For in_app notifications
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('idx_notifications_tenant').on(table.tenantId),
    tenantStatusIdx: index('idx_notifications_tenant_status').on(table.tenantId, table.status),
    tenantChannelIdx: index('idx_notifications_tenant_channel').on(table.tenantId, table.channel),
    tenantCreatedIdx: index('idx_notifications_tenant_created').on(table.tenantId, table.createdAt),
    tenantOrderIdx: index('idx_notifications_tenant_order').on(table.tenantId, table.orderId),
  })
);
