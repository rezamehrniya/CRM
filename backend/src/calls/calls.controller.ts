import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantContext } from '../tenant/tenant.middleware';
import { CallsService } from './calls.service';

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

@Controller(['t/:tenantSlug/calls', 'api/t/:tenantSlug/calls'])
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  private getContext(req: AuthenticatedRequest) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new BadRequestException('Tenant not found');
    if (!actor) throw new BadRequestException('User not found');
    return { tenant, actor };
  }

  @Get('live')
  @RequirePermissions('calls.read')
  async live(@Req() req: AuthenticatedRequest, @Query('scope') scope?: string) {
    const { tenant, actor } = this.getContext(req);
    return this.calls.getLive(tenant, actor, scope);
  }

  @Get()
  @RequirePermissions('calls.read')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('scope') scope?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('hasRecording') hasRecording?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('agentUserId') agentUserId?: string,
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.calls.listLogs(tenant, actor, {
      scope,
      from,
      to,
      status,
      hasRecording,
      agentUserId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('calls.read')
  async getById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const { tenant, actor } = this.getContext(req);
    return this.calls.getById(tenant, actor, id);
  }
}

