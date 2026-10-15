import { Injectable, NestMiddleware } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
