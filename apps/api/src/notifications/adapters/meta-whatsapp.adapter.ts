import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppProviderAdapter, WhatsAppSendPayload, WhatsAppSendResult } from './whatsapp-provider.interface';
import { formatBangladeshPhone, isValidBangladeshPhone } from '@growthomic/shared';

@Injectable()
export class MetaWhatsAppAdapter implements WhatsAppProviderAdapter {
  private readonly logger = new Logger(MetaWhatsAppAdapter.name);
  readonly providerName = 'meta_cloud';

  async sendWhatsApp(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult> {
    const cleanPhone = formatBangladeshPhone(payload.to);
    if (!isValidBangladeshPhone(cleanPhone)) {
      return {
        success: false,
        provider: this.providerName,
        error: `Invalid Bangladesh phone number for WhatsApp: ${payload.to}`,
      };
    }

    const token = payload.apiToken || process.env['WHATSAPP_API_TOKEN'];
    const phoneId = payload.phoneNumberId || process.env['WHATSAPP_PHONE_NUMBER_ID'];

    if (!token || token === 'mock' || !phoneId || phoneId === 'mock') {
      this.logger.log(`[MOCK WHATSAPP] To: ${cleanPhone} | Message: ${payload.message.slice(0, 50)}...`);
      return {
        success: true,
        externalMessageId: `wamid.HBgM${Date.now()}${Math.floor(Math.random() * 1000)}`,
        provider: this.providerName,
      };
    }

    try {
      const recipientNumber = cleanPhone.replace(/^\+/, '');
      const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

      const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientNumber,
        type: 'text',
        text: { preview_url: false, body: payload.message },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const resData: any = await res.json();
      if (!res.ok) {
        throw new Error(resData?.error?.message || `Meta WhatsApp API error ${res.status}`);
      }

      const messageId = resData?.messages?.[0]?.id || `WA-${Date.now()}`;
      return {
        success: true,
        externalMessageId: messageId,
        provider: this.providerName,
        rawResponse: resData,
      };
    } catch (err: any) {
      this.logger.error(`Meta WhatsApp dispatch error: ${err.message}`);
      return {
        success: false,
        provider: this.providerName,
        error: err.message,
      };
    }
  }

  async verifyCredentials(apiToken?: string, phoneNumberId?: string): Promise<{ valid: boolean; error?: string }> {
    const token = apiToken || process.env['WHATSAPP_API_TOKEN'];
    const phoneId = phoneNumberId || process.env['WHATSAPP_PHONE_NUMBER_ID'];

    if (!token || !phoneId) {
      return { valid: false, error: 'API token and Phone Number ID are required' };
    }
    if (token === 'mock' || token.startsWith('test_')) {
      return { valid: true };
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err: any = await res.json();
        return { valid: false, error: err?.error?.message || 'Meta verification failed' };
      }
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }
}
