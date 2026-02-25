import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';

@Module({
  imports: [AuthModule],
  controllers: [MetaController],
  providers: [MetaService],
})
export class MetaModule {}

