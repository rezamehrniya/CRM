import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
