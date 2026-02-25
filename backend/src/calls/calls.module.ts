import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { VoipMockService } from './voip-mock.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CallsController],
  providers: [CallsService, VoipMockService],
  exports: [CallsService],
})
export class CallsModule {}

