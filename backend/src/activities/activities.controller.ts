import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ActivitiesService } from './activities.service';
import { SubscriptionActiveGuard } from '../billing/subscription.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('t/:tenantSlug/activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
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
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenant = (req as any).tenant;
    if (!tenant) return null;
    return this.activities.getOne(tenant, id);
  }

  @Post()
  @UseGuards(SubscriptionActiveGuard)
  async create(@Req() req: Request, @Body() body: any) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.activities.create(tenant, body);
  }
}
