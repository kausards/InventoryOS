export interface SmsSendPayload {
  to: string; // Bangladesh phone number (017... or +88017...)
  message: string;
  senderId?: string;
  apiKey?: string;
}

export interface SmsSendResult {
  success: boolean;
  externalMessageId?: string | undefined;
  provider: string;
  creditsCharged: number;
  error?: string | undefined;
  rawResponse?: any;
}

export interface SmsProviderAdapter {
  providerName: string;
  sendSms(payload: SmsSendPayload): Promise<SmsSendResult>;
  verifyCredentials(apiKey?: string, senderId?: string): Promise<{ valid: boolean; balance?: number; error?: string }>;
}
