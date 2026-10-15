import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 12 bytes for GCM
const DEFAULT_FALLBACK_KEY = 'growthomic-courier-master-key-seed-32bytes';

function deriveKey(secretKey?: string): Buffer {
  const secret =
    secretKey ||
    process.env['COURIER_SECRET'] ||
    process.env['JWT_SECRET'] ||
    DEFAULT_FALLBACK_KEY;
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts arbitrary plaintext (or serialized JSON) using AES-256-GCM.
 * Output format: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function encryptCourierCredentials(plaintext: string, secretKey?: string): string {
  const key = deriveKey(secretKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM ciphertext formatted as `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
 */
export function decryptCourierCredentials(ciphertextPayload: string, secretKey?: string): string {
  const parts = ciphertextPayload.split(':');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Invalid ciphertext format. Expected iv:authTag:ciphertext');
  }

  const ivHex = parts[0];
  const authTagHex = parts[1];
  const encryptedHex = parts[2];

  const key = deriveKey(secretKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');

  return decrypted;
}

/**
 * Gate 4: Mask credentials so secrets are NEVER returned in any API response or log.
 * Replaces values with '******'.
 */
export function maskCourierCredentials<T extends Record<string, any>>(credentials: T): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const key of Object.keys(credentials)) {
    masked[key] = '******';
  }
  return masked;
}
