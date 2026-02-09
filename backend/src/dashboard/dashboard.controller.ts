import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('t/:tenantSlug/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  async getKpis(@Req() req: Request) {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    if (!tenant) return { contactsCount: 0, dealsCount: 0, tasksDueToday: 0, pipelineValue: '0' };
    return this.dashboard.getKpis(tenant, user?.userId);
  }

  @Get('owner')
  @Roles('OWNER')
  async getOwnerDashboard(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) {
      return {
        kpis: {
          newLeadsToday: 0,
          newLeadsThisWeek: 0,
          overdueFollowUps: 0,
          openDealsCount: 0,
          pipelineValueSum: 0,
          forecastToMonthEnd: 0,
          wonDealsCountThisMonth: 0,
          lostDealsCountThisMonth: 0,
          avgDaysToClose: 0,
        },
        charts: {
          leadsFunnel: [],
          pipelineByStage: [],
          trend30d: [],
          dealAging: [],
          topSellers: [],
        },
        lists: {
          overdueLeads: [],
          hotDeals: [],
          recentActivities: [],
        },
      };
    }
    return this.dashboard.getOwnerDashboard(tenant);
  }
}
