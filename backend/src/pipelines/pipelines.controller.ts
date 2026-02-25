import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PipelinesService } from './pipelines.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('t/:tenantSlug/pipelines')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  @Get()
  @RequirePermissions('quotes.read')
  async list(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return [];
    return this.pipelines.list(tenant);
  }
}
