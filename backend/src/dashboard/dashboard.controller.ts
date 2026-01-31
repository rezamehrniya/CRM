import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('t/:tenantSlug/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  async getKpis(@Req() req: Request) {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    if (!tenant) return { contactsCount: 0, dealsCount: 0, tasksDueToday: 0, pipelineValue: '0' };
    return this.dashboard.getKpis(tenant, user?.userId);
  }
}
