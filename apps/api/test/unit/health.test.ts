import { describe, it, expect, beforeEach } from 'vitest';
import { HealthController } from '../../src/health/health.controller';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(() => {
    healthController = new HealthController();
  });

  it('returns ok status with requestId', () => {
    const req = { headers: { 'x-request-id': 'req_123' } };
    const res = healthController.check(req);

    expect(res.status).toBe('ok');
    expect(res.version).toBe('0.0.0');
    expect(res.requestId).toBe('req_123');
    expect(res.timestamp).toBeDefined();
  });

  it('uses unknown if requestId is missing', () => {
    const req = { headers: {} };
    const res = healthController.check(req);

    expect(res.requestId).toBe('unknown');
  });
});
