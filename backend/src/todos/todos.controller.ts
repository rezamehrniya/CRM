import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SubscriptionActiveGuard } from '../billing/subscription.guard';
import { TenantContext } from '../tenant/tenant.middleware';
import { TodosService } from './todos.service';

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

@Controller('t/:tenantSlug/todos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  private getContext(req: AuthenticatedRequest) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new BadRequestException('Tenant not found');
    if (!actor) throw new BadRequestException('User not found');
    return { tenant, actor };
  }

  @Get()
  @RequirePermissions('todos.read')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('scope') scope?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.todos.list(tenant, actor, {
      scope,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('todos.write')
  async create(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const { tenant, actor } = this.getContext(req);
    return this.todos.create(tenant, actor, body ?? {});
  }

  @Patch(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('todos.write')
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    const { tenant, actor } = this.getContext(req);
    return this.todos.update(tenant, actor, id, body ?? {});
  }

  @Delete(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('todos.write')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const { tenant, actor } = this.getContext(req);
    return this.todos.remove(tenant, actor, id);
  }
}

