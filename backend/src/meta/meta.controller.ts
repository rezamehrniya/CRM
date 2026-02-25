import { BadRequestException, Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantContext } from '../tenant/tenant.middleware';
import { MetaService } from './meta.service';

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

@Controller('t/:tenantSlug/meta')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  @Get('server-time')
  @RequirePermissions('meta.read')
  getServerTime(@Req() req: AuthenticatedRequest) {
    if (!req.tenant) throw new BadRequestException('Tenant not found');
    if (!req.user) throw new BadRequestException('User not found');
    return this.meta.getServerTime();
  }
}

