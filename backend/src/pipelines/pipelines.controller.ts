import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PipelinesService } from './pipelines.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('t/:tenantSlug/pipelines')
@UseGuards(JwtAuthGuard)
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  @Get()
  async list(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return [];
    return this.pipelines.list(tenant);
  }
}
