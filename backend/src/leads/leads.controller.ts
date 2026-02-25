import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { LeadsService } from './leads.service';
import { SubscriptionActiveGuard } from '../billing/subscription.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { TenantContext } from '../tenant/tenant.middleware';

type AuthenticatedRequest = Request & {
  tenant?: TenantContext;
  user?: { userId: string; tenantId: string; role: string; permissions?: string[]; sessionId: string };
};

@Controller('t/:tenantSlug/leads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermissions('leads.read')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('owner') owner?: string,
    @Query('overdue') overdue?: string,
    @Query('activityDays') activityDays?: string,
  ) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) return { data: [], total: 0 };
    return this.leads.list(tenant, {
      actor,
      q,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      status,
      source,
      owner,
      overdue,
      activityDays: activityDays ? parseInt(activityDays, 10) : undefined,
    });
  }

  @Get('owners')
  @RequirePermissions('leads.read')
  async owners(@Req() req: AuthenticatedRequest) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) return [];
    return this.leads.listOwners(tenant, actor);
  }

  @Get(':id')
  @RequirePermissions('leads.read')
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) return null;
    return this.leads.getOne(tenant, actor, id);
  }

  @Post()
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('leads.write')
  async create(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    return this.leads.create(tenant, actor, body);
  }

  @Patch('bulk')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('leads.manage')
  async bulk(
    @Req() req: AuthenticatedRequest,
    @Body() body: { ids?: string[]; status?: string; ownerUserId?: string | null },
  ) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    if (!actor) throw new Error('User not found');
    return this.leads.bulkUpdate(tenant, actor, body);
  }

  @Patch(':id/assign')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('leads.manage')
  async assign(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { ownerUserId?: string | null },
  ) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    return this.leads.update(tenant, actor, id, { ownerUserId: body.ownerUserId ?? undefined });
  }

  @Patch(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('leads.write')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    return this.leads.update(tenant, actor, id, body);
  }

  @Patch(':id/move')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('leads.write')
  async move(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status?: string; position?: number },
  ) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    return this.leads.move(tenant, actor, id, body);
  }

  @Patch(':id/convert')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('leads.write')
  async convert(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    return this.leads.convert(tenant, actor, id);
  }

  @Delete(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('leads.manage')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new Error('Tenant not found');
    return this.leads.remove(tenant, actor, id);
  }
}
