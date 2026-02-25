import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantContext } from '../tenant/tenant.middleware';
import { RemindersService } from './reminders.service';

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

@Controller('t/:tenantSlug/reminders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  private getContext(req: AuthenticatedRequest) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new BadRequestException('Tenant not found');
    if (!actor) throw new BadRequestException('User not found');
    return { tenant, actor };
  }

  @Get('summary')
  @RequirePermissions('dashboard.read')
  async summary(@Req() req: AuthenticatedRequest, @Query('scope') scope?: string) {
    const { tenant, actor } = this.getContext(req);
    return this.reminders.summary(tenant, actor, scope);
  }
}

