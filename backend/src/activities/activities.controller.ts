import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ActivitiesService } from './activities.service';
import { SubscriptionActiveGuard } from '../billing/subscription.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('t/:tenantSlug/activities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  @RequirePermissions('activities.read')
  async list(
    @Req() req: Request,
    @Query('contactId') contactId?: string,
    @Query('dealId') dealId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) return { data: [], total: 0 };
    return this.activities.list(tenant, {
      contactId,
      dealId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('activities.read')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenant = (req as any).tenant;
    if (!tenant) return null;
    return this.activities.getOne(tenant, id);
  }

  @Post()
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('activities.write')
  async create(@Req() req: Request, @Body() body: any) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.activities.create(tenant, body);
  }
}
