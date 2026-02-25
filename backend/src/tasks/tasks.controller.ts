import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { SubscriptionActiveGuard } from '../billing/subscription.guard';
import { TenantContext } from '../tenant/tenant.middleware';
import { TasksService } from './tasks.service';

type AuthenticatedRequest = Request & {
  tenant?: TenantContext;
  user?: { userId: string; tenantId: string; role: string; permissions?: string[]; sessionId: string };
};

@Controller('t/:tenantSlug/tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  private getContext(req: AuthenticatedRequest) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new BadRequestException('Tenant not found');
    if (!actor) throw new BadRequestException('User not found');
    return { tenant, actor };
  }

  @Get()
  @RequirePermissions('tasks.read')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('tab') tab?: string,
    @Query('assignee') assignee?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.tasks.list(tenant, actor, {
      q,
      status,
      tab,
      assignee,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('assignees')
  @RequirePermissions('tasks.read')
  async assignees(@Req() req: AuthenticatedRequest) {
    const { tenant, actor } = this.getContext(req);
    return this.tasks.listAssignees(tenant, actor);
  }

  @Get(':id')
  @RequirePermissions('tasks.read')
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const { tenant, actor } = this.getContext(req);
    return this.tasks.getOne(tenant, actor, id);
  }

  @Post()
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('tasks.write')
  async create(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const { tenant, actor } = this.getContext(req);
    return this.tasks.create(tenant, actor, body);
  }

  @Patch(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('tasks.write')
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    const { tenant, actor } = this.getContext(req);
    return this.tasks.update(tenant, actor, id, body);
  }

  @Patch(':id/move')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('tasks.write')
  async move(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status?: string; order?: number },
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.tasks.move(tenant, actor, id, body);
  }

  @Delete(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('tasks.manage')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const { tenant, actor } = this.getContext(req);
    return this.tasks.remove(tenant, actor, id);
  }
}
