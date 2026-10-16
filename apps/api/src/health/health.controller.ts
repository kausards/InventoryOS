import { Controller, Get, Req } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(@Req() req: any) {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.0', // will be injected in CI later
      requestId: req.headers['x-request-id'] || 'unknown',
    };
  }

  @Get('openapi.json')
  getOpenApiSpec() {
    return {
      openapi: '3.0.3',
      info: {
        title: 'Shopeers API',
        description: 'Enterprise B2B eCommerce & Inventory OS for Bangladesh',
        version: '1.0.0',
      },
      paths: {
        '/health': { get: { summary: 'Health check' } },
        '/onboarding/status': { get: { summary: 'Get onboarding status' } },
        '/onboarding/complete': { post: { summary: 'Complete setup wizard' } },
        '/imports/dry-run': { post: { summary: 'Validate CSV import' } },
        '/imports/commit': { post: { summary: 'Commit CSV import batch' } },
        '/imports/batches': { get: { summary: 'List import batches' } },
        '/imports/batches/{id}/undo': { post: { summary: 'Undo last batch' } },
        '/customers/{id}/anonymize': { post: { summary: 'Redact PII & anonymize customer' } },
      },
    };
  }
}
