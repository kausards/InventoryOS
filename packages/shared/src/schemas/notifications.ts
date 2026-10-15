import { z } from 'zod';

export const NOTIFICATION_CHANNELS = ['in_app', 'sms', 'whatsapp', 'email'] as const;
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];

export const NOTIFICATION_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'failed',
  'credit_exhausted',
  'opted_out',
] as const;
export type NotificationStatus = typeof NOTIFICATION_STATUSES[number];

export const NOTIFICATION_TYPES = [
  'customer_alert',
  'staff_alert',
  'system_alert',
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const MESSAGE_CREDIT_TYPES = [
  'top_up',
  'deduction',
  'refund',
  'adjustment',
] as const;
export type MessageCreditType = typeof MESSAGE_CREDIT_TYPES[number];

export const CONSENT_STATUSES = ['opted_in', 'opted_out'] as const;
export type ConsentStatus = typeof CONSENT_STATUSES[number];

export const TRIGGER_EVENTS = [
  'order_created',
  'order_confirmed',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
  'return_received',
  'return_completed',
  'stock_low',
] as const;
export type TriggerEvent = typeof TRIGGER_EVENTS[number];

export const SMS_PROVIDERS = ['elitbuzz', 'greenweb', 'mock'] as const;
export type SmsProvider = typeof SMS_PROVIDERS[number];

export const WHATSAPP_PROVIDERS = ['meta_cloud', 'twilio', 'mock'] as const;
export type WhatsAppProvider = typeof WHATSAPP_PROVIDERS[number];

// Schemas
export const sendNotificationSchema = z.object({
  recipient: z.string().min(1, 'Recipient is required'),
  channel: z.enum(NOTIFICATION_CHANNELS),
  type: z.enum(NOTIFICATION_TYPES).default('customer_alert'),
  templateId: z.string().uuid().optional().nullable(),
  triggerEvent: z.enum(TRIGGER_EVENTS).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1, 'Notification content is required'),
  variables: z.record(z.string(), z.any()).optional().default({}),
  orderId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
});
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

export const topUpCreditsSchema = z.object({
  channel: z.enum(['sms', 'whatsapp', 'system']),
  amount: z.number().int().min(1, 'Top-up amount must be at least 1 credit'),
  referenceId: z.string().optional().nullable(),
  description: z.string().min(1).default('Manual credit top-up'),
});
export type TopUpCreditsInput = z.infer<typeof topUpCreditsSchema>;

export const updateConsentSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
  channel: z.enum(['sms', 'whatsapp']),
  consentStatus: z.enum(CONSENT_STATUSES),
  optOutReason: z.string().max(500).optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
});
export type UpdateConsentInput = z.infer<typeof updateConsentSchema>;

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  triggerEvent: z.enum(TRIGGER_EVENTS),
  channel: z.enum(NOTIFICATION_CHANNELS),
  language: z.enum(['bn', 'en']).default('bn'),
  content: z.string().min(1, 'Template content is required'),
  isActive: z.boolean().default(true),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const updatePreferencesSchema = z.object({
  channelSmsEnabled: z.boolean().optional(),
  channelWhatsappEnabled: z.boolean().optional(),
  channelEmailEnabled: z.boolean().optional(),
  channelInAppEnabled: z.boolean().optional(),
  smsProvider: z.enum(SMS_PROVIDERS).optional(),
  smsApiKey: z.string().optional().nullable(),
  smsSenderId: z.string().optional().nullable(),
  whatsappProvider: z.enum(WHATSAPP_PROVIDERS).optional(),
  whatsappApiToken: z.string().optional().nullable(),
  whatsappPhoneNumberId: z.string().optional().nullable(),
  eventsConfig: z.record(z.string(), z.boolean()).optional(),
});
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

// Template variable interpolation helper
export function renderTemplate(template: string, variables: Record<string, any>): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : `{{${key}}}`;
  });
}

// Default system templates (Bilingual: Bangla & English)
export const DEFAULT_NOTIFICATION_TEMPLATES = [
  {
    name: 'Order Confirmation (Bangla)',
    triggerEvent: 'order_confirmed' as TriggerEvent,
    channel: 'sms' as NotificationChannel,
    language: 'bn' as const,
    content: 'প্রিয় {{customer_name}}, আপনার অর্ডার #{{order_number}} সফলভাবে কনফার্ম করা হয়েছে। মোট বিল: ৳{{total_amount}}। সাথে থাকার জন্য ধন্যবাদ!',
  },
  {
    name: 'Order Shipped with Tracking (Bangla)',
    triggerEvent: 'order_shipped' as TriggerEvent,
    channel: 'sms' as NotificationChannel,
    language: 'bn' as const,
    content: 'প্রিয় {{customer_name}}, আপনার অর্ডার #{{order_number}} কুরিয়ারে হস্তান্তর করা হয়েছে। ট্র্যাকিং কোড: {{tracking_code}}। কুরিয়ার: {{courier_name}}।',
  },
  {
    name: 'Order Delivered (Bangla)',
    triggerEvent: 'order_delivered' as TriggerEvent,
    channel: 'sms' as NotificationChannel,
    language: 'bn' as const,
    content: 'প্রিয় {{customer_name}}, আপনার অর্ডার #{{order_number}} ডেলিভারি সম্পন্ন হয়েছে। পণ্যটি আপনার পছন্দ হয়েছে বলে আশা করছি!',
  },
  {
    name: 'Order Confirmation (English)',
    triggerEvent: 'order_confirmed' as TriggerEvent,
    channel: 'sms' as NotificationChannel,
    language: 'en' as const,
    content: 'Dear {{customer_name}}, your order #{{order_number}} has been confirmed. Total: ৳{{total_amount}}. Thank you for shopping with us!',
  },
  {
    name: 'Order Shipped (English)',
    triggerEvent: 'order_shipped' as TriggerEvent,
    channel: 'sms' as NotificationChannel,
    language: 'en' as const,
    content: 'Dear {{customer_name}}, order #{{order_number}} has been shipped via {{courier_name}}. Tracking ID: {{tracking_code}}.',
  },
  {
    name: 'WhatsApp Order Dispatch (Bilingual)',
    triggerEvent: 'order_shipped' as TriggerEvent,
    channel: 'whatsapp' as NotificationChannel,
    language: 'bn' as const,
    content: '📦 প্রিয় {{customer_name}}, আপনার অর্ডার #{{order_number}} ডেলিভারির পথে!\n\nকুরিয়ার: {{courier_name}}\nট্র্যাকিং নম্বর: {{tracking_code}}\nমোট প্রদেয় COD: ৳{{total_amount}}\n\nপার্সেল রিসিভ করার সময় চেক করে নিন। ধন্যবাদ!',
  },
];
