import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { env } from './config/env';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  app.enableCors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix(`api/${env.API_VERSION}`);
  app.use(new RequestIdMiddleware().use);
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(env.PORT, '0.0.0.0');
  console.log(`🚀 API running on http://localhost:${env.PORT}/api/${env.API_VERSION}`);
}
bootstrap();
