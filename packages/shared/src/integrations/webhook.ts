import * as crypto from 'crypto';

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Verifies the HMAC-SHA256 signature of an incoming WooCommerce webhook.
 * WooCommerce sends the base64-encoded signature in the `x-wc-webhook-signature` header.
 *
 * @param rawBody - The unparsed raw body string of the incoming HTTP request.
 * @param signatureHeader - The value of the `x-wc-webhook-signature` request header.
 * @param webhookSecret - The shared secret configured for this webhook in WooCommerce.
 */
export function verifyWooCommerceWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined | null,
  webhookSecret: string
): WebhookVerificationResult {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { isValid: false, error: 'Missing x-wc-webhook-signature header.' };
  }

  if (!webhookSecret || typeof webhookSecret !== 'string') {
    return { isValid: false, error: 'Store webhook secret is not configured.' };
  }

  try {
    const payloadBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
    const computedHmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadBuffer)
      .digest(); // Raw buffer

    const providedSignatureBuffer = Buffer.from(signatureHeader.trim(), 'base64');

    // Both buffers must be equal length for timingSafeEqual
    if (computedHmac.length !== providedSignatureBuffer.length) {
      return { isValid: false, error: 'Signature length mismatch.' };
    }

    const matches = crypto.timingSafeEqual(computedHmac, providedSignatureBuffer);
    if (!matches) {
      return { isValid: false, error: 'Invalid webhook signature.' };
    }

    return { isValid: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signature calculation error';
    return { isValid: false, error: message };
  }
}

/**
 * Computes the unique deduplication key for an incoming webhook event.
 * Combines storeId, event topic/type, external resource ID, and delivery timestamp or hash.
 */
export function computeWebhookDeduplicationKey(
  storeId: string,
  topic: string,
  resourceId: string | number,
  deliveryIdOrDate: string | number
): string {
  return `${storeId}:${topic}:${resourceId}:${deliveryIdOrDate}`;
}
