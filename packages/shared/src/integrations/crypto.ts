import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const DEFAULT_FALLBACK_KEY = 'growthomic-integration-master-key-32bytes';

function deriveKey(secretKey?: string): Buffer {
  const secret =
    secretKey ||
    process.env['INTEGRATION_SECRET'] ||
    process.env['COURIER_SECRET'] ||
    process.env['JWT_SECRET'] ||
    DEFAULT_FALLBACK_KEY;
  return crypto.createHash('sha256').update(secret).digest();
}

export interface StoreCredentials {
  consumerKey: string;
  consumerSecret: string;
  webhookSecret?: string;
}

export interface MaskedStoreCredentials {
  consumerKey: string;
  consumerSecret: string;
  webhookSecret?: string;
}

/**
 * Encrypts store credentials JSON object using AES-256-GCM.
 */
export function encryptStoreCredentials(credentials: StoreCredentials, secretKey?: string): string {
  const plaintext = JSON.stringify(credentials);
  const key = deriveKey(secretKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts store credentials JSON string from AES-256-GCM ciphertext.
 */
export function decryptStoreCredentials(ciphertext: string, secretKey?: string): StoreCredentials {
  const parts = ciphertext.split(':');
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

  return JSON.parse(decrypted) as StoreCredentials;
}

/**
 * Masks credentials for UI display and safe API logging.
 * Never outputs the real secrets.
 */
export function maskStoreCredentials(credentials: StoreCredentials): MaskedStoreCredentials {
  const maskKey = (key: string, prefix = 'ck_') => {
    if (!key) return '******';
    if (key.length <= 8) return '******';
    return `${prefix}...${key.slice(-4)}`;
  };

  const maskSecret = (secret: string, prefix = 'cs_') => {
    if (!secret) return '******';
    if (secret.length <= 8) return '******';
    return `${prefix}...${secret.slice(-4)}`;
  };

  return {
    consumerKey: maskKey(credentials.consumerKey, 'ck_'),
    consumerSecret: maskSecret(credentials.consumerSecret, 'cs_'),
    ...(credentials.webhookSecret && { webhookSecret: '******' }),
  };
}
