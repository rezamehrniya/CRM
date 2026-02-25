import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { normalizeRoleKey } from '../auth/permissions.constants';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { DashboardService } from './dashboard.service';

type TeamSortBy = 'revenue' | 'conversion' | 'overdue';

@Controller('t/:tenantSlug/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  private assertManagerAccess(req: Request) {
    const rawRole = (req as any)?.user?.role;
    const role = normalizeRoleKey(typeof rawRole === 'string' ? rawRole : null);
    if (role !== 'ADMIN' && role !== 'SALES_MANAGER') {
      throw new ForbiddenException({
        code: 'MANAGER_ONLY',
        message: 'Manager dashboard endpoints are only available for ADMIN/SALES_MANAGER',
      });
    }
  }

  private assertRepAccess(req: Request) {
    const rawRole = (req as any)?.user?.role;
    const role = normalizeRoleKey(typeof rawRole === 'string' ? rawRole : null);
    if (role !== 'ADMIN' && role !== 'SALES_MANAGER' && role !== 'SALES_REP') {
      throw new ForbiddenException({
        code: 'REP_ONLY',
        message: 'Rep dashboard endpoint is only available for ADMIN/SALES_MANAGER/SALES_REP',
      });
    }
  }

  // Legacy route kept for backward compatibility during migration.
  @Get()
  @RequirePermissions('dashboard.read')
  async getLegacyDashboard(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) {
    this.assertManagerAccess(req);
    return this.dashboard.getManagerOverview({ req, from, to });
  }

  @Get('manager/overview')
  @RequirePermissions('dashboard.read')
  async managerOverview(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) {
    this.assertManagerAccess(req);
    return this.dashboard.getManagerOverview({ req, from, to });
  }

  @Get('manager/team')
  @RequirePermissions('dashboard.read')
  async managerTeam(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sortBy') sortBy?: TeamSortBy,
  ) {
    this.assertManagerAccess(req);
    return this.dashboard.getManagerTeam({ req, from, to, sortBy });
  }

  @Get('rep')
  @RequirePermissions('dashboard.read')
  async repDashboard(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) {
    this.assertRepAccess(req);
    return this.dashboard.getRepDashboard({ req, from, to });
  }
}
