import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { SubscriptionActiveGuard } from './subscription.guard';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [BillingService, SubscriptionActiveGuard],
  exports: [BillingService, SubscriptionActiveGuard],
})
export class BillingModule {}
