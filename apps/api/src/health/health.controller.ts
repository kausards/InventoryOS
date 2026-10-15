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
}
