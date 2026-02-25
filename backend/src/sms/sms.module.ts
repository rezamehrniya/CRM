import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsController } from './sms.controller';
import { SmsMockProviderService } from './sms-mock-provider.service';
import { SmsService } from './sms.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SmsController],
  providers: [SmsService, SmsMockProviderService],
  exports: [SmsService],
})
export class SmsModule {}
