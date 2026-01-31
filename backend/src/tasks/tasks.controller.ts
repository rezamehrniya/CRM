import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TasksService } from './tasks.service';
import { SubscriptionActiveGuard } from '../billing/subscription.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('t/:tenantSlug/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) return { data: [], total: 0 };
    return this.tasks.list(tenant, {
      q,
      status,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenant = (req as any).tenant;
    if (!tenant) return null;
    return this.tasks.getOne(tenant, id);
  }

  @Post()
  @UseGuards(SubscriptionActiveGuard)
  async create(@Req() req: Request, @Body() body: any) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.tasks.create(tenant, body);
  }

  @Patch(':id')
  @UseGuards(SubscriptionActiveGuard)
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.tasks.update(tenant, id, body);
  }

  @Delete(':id')
  @UseGuards(SubscriptionActiveGuard)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.tasks.remove(tenant, id);
  }
}
