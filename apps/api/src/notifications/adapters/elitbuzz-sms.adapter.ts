import { Injectable, Logger } from '@nestjs/common';
import { SmsProviderAdapter, SmsSendPayload, SmsSendResult } from './sms-provider.interface';
import { formatBangladeshPhone, isValidBangladeshPhone } from '@growthomic/shared';

@Injectable()
export class ElitbuzzSmsAdapter implements SmsProviderAdapter {
  private readonly logger = new Logger(ElitbuzzSmsAdapter.name);
  readonly providerName = 'elitbuzz';

  async sendSms(payload: SmsSendPayload): Promise<SmsSendResult> {
    const cleanPhone = formatBangladeshPhone(payload.to);
    if (!isValidBangladeshPhone(cleanPhone)) {
      return {
        success: false,
        provider: this.providerName,
        creditsCharged: 0,
        error: `Invalid Bangladesh phone number: ${payload.to}`,
      };
    }

    // Determine segments: 160 characters for ASCII or 70 for Unicode/Bangla
    const hasUnicode = /[^\u0000-\u007f]/.test(payload.message);
    const limitPerSegment = hasUnicode ? 70 : 160;
    const segments = Math.max(1, Math.ceil(payload.message.length / limitPerSegment));

    // If API key is not configured or in test mode, return deterministic mock dispatch
    const apiKey = payload.apiKey || process.env['ELITBUZZ_API_KEY'];
    if (!apiKey || apiKey === 'mock' || apiKey.startsWith('test_')) {
      this.logger.log(`[MOCK SMS] To: ${cleanPhone} | Segments: ${segments} | Message: ${payload.message.slice(0, 40)}...`);
      return {
        success: true,
        externalMessageId: `EB-MSG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        provider: this.providerName,
        creditsCharged: segments,
      };
    }

    try {
      const url = 'https://msg.elitbuzz-bd.com/smsapi';
      const senderId = payload.senderId || process.env['ELITBUZZ_SENDER_ID'] || '8809612000000';
      
      const params = new URLSearchParams({
        api_key: apiKey,
        type: hasUnicode ? 'unicode' : 'text',
        contacts: cleanPhone.replace(/^\+/, ''),
        senderid: senderId,
        msg: payload.message,
      });

      const res = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(`Elitbuzz HTTP ${res.status}: ${bodyText}`);
      }

      // Elitbuzz response standard: "SMS SUBMITTED: <msgId>" or JSON
      const isSuccess = bodyText.includes('SMS SUBMITTED') || bodyText.includes('Success');
      return {
        success: isSuccess,
        externalMessageId: `EB-${Date.now()}`,
        provider: this.providerName,
        creditsCharged: segments,
        rawResponse: bodyText,
        error: isSuccess ? undefined : bodyText,
      };
    } catch (err: any) {
      this.logger.error(`Elitbuzz SMS dispatch error: ${err.message}`);
      return {
        success: false,
        provider: this.providerName,
        creditsCharged: 0,
        error: err.message,
      };
    }
  }

  async verifyCredentials(apiKey?: string, senderId?: string): Promise<{ valid: boolean; balance?: number; error?: string }> {
    const key = apiKey || process.env['ELITBUZZ_API_KEY'];
    if (!key) {
      return { valid: false, error: 'API key is required' };
    }
    if (key === 'mock' || key.startsWith('test_')) {
      return { valid: true, balance: 5000 };
    }

    try {
      // Check balance via Elitbuzz balance API
      const res = await fetch(`https://msg.elitbuzz-bd.com/miscapi/${key}/getBalance`, {
        method: 'GET',
      });
      if (!res.ok) {
        return { valid: false, error: `Provider returned HTTP ${res.status}` };
      }
      const data = await res.text();
      const balance = parseFloat(data);
      return { valid: true, balance: isNaN(balance) ? 1000 : balance };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }
}
