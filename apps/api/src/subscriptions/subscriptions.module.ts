import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionActiveGuard } from './guards/subscription-active.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionActiveGuard],
  exports: [SubscriptionsService, SubscriptionActiveGuard],
})
export class SubscriptionsModule {}
