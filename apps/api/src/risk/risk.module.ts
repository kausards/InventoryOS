import { Module } from '@nestjs/common';
import { RiskService } from './risk.service';
import { RiskController } from './risk.controller';
import { AuthModule } from '../auth/auth.module';
import { CouriersModule } from '../couriers/couriers.module';

@Module({
  imports: [AuthModule, CouriersModule],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
