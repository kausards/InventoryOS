import { describe, it, expect } from 'vitest';
import {
  encryptCourierCredentials,
  decryptCourierCredentials,
  maskCourierCredentials,
  canTransitionShipmentStatus,
  isTerminalShipmentStatus,
} from '../courier/index.js';

describe('Courier Security & Encryption (Gate 4)', () => {
  const secretKey = 'test-secret-key-for-aes-256-gcm-encryption';
  const credentials = {
    apiKey: 'steadfast_live_key_99214a8f',
    secretKey: 'steadfast_secret_38921a4e8d2c',
  };

  it('encrypts and decrypts credentials accurately using AES-256-GCM', () => {
    const serialized = JSON.stringify(credentials);
    const encrypted = encryptCourierCredentials(serialized, secretKey);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toContain('steadfast_live_key');
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

    const decrypted = decryptCourierCredentials(encrypted, secretKey);
    const parsed = JSON.parse(decrypted);

    expect(parsed).toEqual(credentials);
  });

  it('fails decryption if ciphertext is tampered', () => {
    const serialized = JSON.stringify(credentials);
    const encrypted = encryptCourierCredentials(serialized, secretKey);
    const parts = encrypted.split(':');
    const ciphertextPart = parts[2] || '';
    // Tamper with the ciphertext
    const tampered = `${parts[0]}:${parts[1]}:${ciphertextPart.slice(0, -4)}ffff`;

    expect(() => decryptCourierCredentials(tampered, secretKey)).toThrow();
  });

  it('masks credentials with ****** and never reveals raw values (Gate 4)', () => {
    const masked = maskCourierCredentials(credentials);

    expect(masked['apiKey']).toBe('******');
    expect(masked['secretKey']).toBe('******');
    expect(JSON.stringify(masked)).not.toContain('steadfast_live_key');
    expect(JSON.stringify(masked)).not.toContain('steadfast_secret');
  });
});

describe('Courier State Machine & Terminal Status Protection (Gate 2)', () => {
  it('correctly identifies terminal shipment statuses', () => {
    expect(isTerminalShipmentStatus('delivered')).toBe(true);
    expect(isTerminalShipmentStatus('partially_delivered')).toBe(true);
    expect(isTerminalShipmentStatus('cancelled')).toBe(true);
    expect(isTerminalShipmentStatus('returned')).toBe(true);

    expect(isTerminalShipmentStatus('pending')).toBe(false);
    expect(isTerminalShipmentStatus('in_transit')).toBe(false);
    expect(isTerminalShipmentStatus('out_for_delivery')).toBe(false);
    expect(isTerminalShipmentStatus('unknown_pending_reconciliation')).toBe(false);
  });

  it('allows forward transitions from active to delivered or returned', () => {
    expect(canTransitionShipmentStatus('pending', 'in_transit')).toBe(true);
    expect(canTransitionShipmentStatus('in_transit', 'out_for_delivery')).toBe(true);
    expect(canTransitionShipmentStatus('out_for_delivery', 'delivered')).toBe(true);
    expect(canTransitionShipmentStatus('out_for_delivery', 'returned')).toBe(true);
  });

  it('strictly blocks out-of-order regression from terminal statuses (Gate 2)', () => {
    // If a parcel is marked delivered, an out-of-order webhook saying in_transit or pending MUST be rejected
    expect(canTransitionShipmentStatus('delivered', 'in_transit')).toBe(false);
    expect(canTransitionShipmentStatus('delivered', 'pending')).toBe(false);
    expect(canTransitionShipmentStatus('delivered', 'out_for_delivery')).toBe(false);

    // If cancelled, cannot regress to in_transit
    expect(canTransitionShipmentStatus('cancelled', 'in_transit')).toBe(false);

    // If returned, cannot regress to out_for_delivery
    expect(canTransitionShipmentStatus('returned', 'out_for_delivery')).toBe(false);
  });

  it('allows idempotent status events for same terminal state', () => {
    expect(canTransitionShipmentStatus('delivered', 'delivered')).toBe(true);
    expect(canTransitionShipmentStatus('cancelled', 'cancelled')).toBe(true);
  });
});
