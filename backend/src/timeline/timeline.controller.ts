import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantContext } from '../tenant/tenant.middleware';
import { TimelineService } from './timeline.service';

type AuthenticatedRequest = Request & {
  tenant?: TenantContext;
  user?: {
    userId: string;
    tenantId: string;
    role: string;
    permissions?: string[];
    sessionId: string;
  };
};

@Controller('t/:tenantSlug/timeline')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  private getContext(req: AuthenticatedRequest) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new BadRequestException('Tenant not found');
    if (!actor) throw new BadRequestException('User not found');
    return { tenant, actor };
  }

  @Get('lead/:leadId')
  @RequirePermissions('timeline.read')
  async getLeadTimeline(
    @Req() req: AuthenticatedRequest,
    @Param('leadId') leadId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.timeline.getLeadTimeline(tenant, actor, leadId, {
      from,
      to,
      type,
      limit,
      cursor,
    });
  }
}
