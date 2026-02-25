import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CompaniesService } from './companies.service';
import { SubscriptionActiveGuard } from '../billing/subscription.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { TenantContext } from '../tenant/tenant.middleware';

type AuthenticatedRequest = Request & {
  tenant?: TenantContext;
  user?: { userId: string; tenantId: string; role: string; permissions?: string[]; sessionId: string };
};

@Controller('t/:tenantSlug/companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermissions('companies.read')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('owner') owner?: string,
    @Query('status') status?: string,
    @Query('segment') segment?: string,
    @Query('hasOpenDeals') hasOpenDeals?: string,
    @Query('activityDays') activityDays?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) return { data: [], total: 0 };
    return this.companies.list(tenant, {
      actor,
      q,
      owner,
      status,
      segment,
      hasOpenDeals,
      activityDays: activityDays ? parseInt(activityDays, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('owners')
  @RequirePermissions('companies.read')
  async owners(@Req() req: AuthenticatedRequest) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) return [];
    return this.companies.listOwners(tenant, actor);
  }

  @Get(':id')
  @RequirePermissions('companies.read')
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenant = req.tenant;
    if (!tenant) return null;
    return this.companies.getOne(tenant, id, req.user);
  }

  @Post()
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('companies.write')
  async create(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    return this.companies.create(tenant, actor, body);
  }

  @Post('import')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('imports.write')
  async import(@Req() req: AuthenticatedRequest, @Body() body: { items?: Array<{ name?: string; phone?: string; website?: string }> }) {
    const tenant = req.tenant;
    if (!tenant) throw new Error('Tenant not found');
    const items = Array.isArray(body?.items) ? body.items : [];
    return this.companies.createMany(tenant, items);
  }

  @Patch(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('companies.write')
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    return this.companies.update(tenant, actor, id, body);
  }

  @Delete(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('companies.manage')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    return this.companies.remove(tenant, actor, id);
  }
}
