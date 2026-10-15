export interface WhatsAppSendPayload {
  to: string; // Bangladesh phone number
  message: string;
  templateName?: string;
  templateLanguage?: string;
  apiToken?: string;
  phoneNumberId?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  externalMessageId?: string | undefined;
  provider: string;
  error?: string | undefined;
  rawResponse?: any;
}

export interface WhatsAppProviderAdapter {
  providerName: string;
  sendWhatsApp(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult>;
  verifyCredentials(apiToken?: string, phoneNumberId?: string): Promise<{ valid: boolean; error?: string }>;
}
