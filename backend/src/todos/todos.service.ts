import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hasPermission } from '../auth/permissions.utils';
import { TenantContext } from '../tenant/tenant.middleware';

type ActorContext = {
  userId: string;
  role: string;
  permissions?: string[];
};

type TodoScope = 'me' | 'team';
type TodoStatusFilter = 'open' | 'done' | 'all';
type TodoStatus = 'OPEN' | 'DONE';

type ListArgs = {
  scope?: string;
  status?: string;
  limit?: number;
};

type CreatePayload = {
  title?: string;
  dueAt?: string | null;
  status?: string;
  userId?: string;
};

type UpdatePayload = {
  title?: string;
  dueAt?: string | null;
  status?: string;
};

const todoSelect = {
  id: true,
  tenantId: true,
  userId: true,
  title: true,
  dueAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.TodoSelect;

function cleanString(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStatus(raw?: string | null): TodoStatus {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase();
  return value === 'DONE' ? 'DONE' : 'OPEN';
}

function normalizeStatusFilter(raw?: string | null): TodoStatusFilter {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'done') return 'done';
  if (value === 'all') return 'all';
  return 'open';
}

function normalizeScope(raw?: string | null): TodoScope {
  return String(raw ?? '').trim().toLowerCase() === 'team' ? 'team' : 'me';
}

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  private canManage(actor: ActorContext) {
    return hasPermission(actor, 'todos.manage');
  }

  private resolveScope(scope: string | undefined, actor: ActorContext): TodoScope {
    const normalized = normalizeScope(scope);
    if (normalized === 'team' && this.canManage(actor)) return 'team';
    return 'me';
  }

  private buildWhere(
    tenant: TenantContext,
    actor: ActorContext,
    scope: TodoScope,
    status: TodoStatusFilter,
  ): Prisma.TodoWhereInput {
    const where: Prisma.TodoWhereInput = { tenantId: tenant.id };
    if (scope === 'me') where.userId = actor.userId;
    if (status === 'open') where.status = 'OPEN';
    if (status === 'done') where.status = 'DONE';
    return where;
  }

  private async assertTenantMember(tenant: TenantContext, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId } },
      select: { status: true },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new BadRequestException('INVALID_ASSIGNEE');
    }
  }

  private async assertWritable(
    tenant: TenantContext,
    actor: ActorContext,
    id: string,
  ) {
    const todo = await this.prisma.todo.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, userId: true },
    });
    if (!todo) throw new NotFoundException();

    if (todo.userId !== actor.userId && !this.canManage(actor)) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return todo;
  }

  async list(tenant: TenantContext, actor: ActorContext, args: ListArgs) {
    const scope = this.resolveScope(args.scope, actor);
    const status = normalizeStatusFilter(args.status);
    const limit = Math.min(200, Math.max(1, Number(args.limit ?? 50)));
    const where = this.buildWhere(tenant, actor, scope, status);

    const [items, openCount, doneCount] = await Promise.all([
      this.prisma.todo.findMany({
        where,
        select: todoSelect,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: limit,
      }),
      this.prisma.todo.count({
        where: this.buildWhere(tenant, actor, scope, 'open'),
      }),
      this.prisma.todo.count({
        where: this.buildWhere(tenant, actor, scope, 'done'),
      }),
    ]);

    return {
      scope,
      status,
      limit,
      counts: {
        open: openCount,
        done: doneCount,
        total: openCount + doneCount,
      },
      items,
    };
  }

  async create(tenant: TenantContext, actor: ActorContext, body: CreatePayload) {
    const title = cleanString(body.title);
    if (!title) throw new BadRequestException('TITLE_REQUIRED');

    const requestedUserId = cleanString(body.userId);
    let userId = actor.userId;
    if (requestedUserId && this.canManage(actor)) {
      await this.assertTenantMember(tenant, requestedUserId);
      userId = requestedUserId;
    }

    return this.prisma.todo.create({
      data: {
        tenantId: tenant.id,
        userId,
        title,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        status: normalizeStatus(body.status),
      },
      select: todoSelect,
    });
  }

  async update(tenant: TenantContext, actor: ActorContext, id: string, body: UpdatePayload) {
    await this.assertWritable(tenant, actor, id);

    const data: Prisma.TodoUpdateInput = {};
    if (body.title !== undefined) {
      const title = cleanString(body.title);
      if (!title) throw new BadRequestException('TITLE_REQUIRED');
      data.title = title;
    }
    if (body.status !== undefined) data.status = normalizeStatus(body.status);
    if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;

    if (Object.keys(data).length === 0) {
      return this.prisma.todo.findUniqueOrThrow({ where: { id }, select: todoSelect });
    }

    return this.prisma.todo.update({
      where: { id },
      data,
      select: todoSelect,
    });
  }

  async remove(tenant: TenantContext, actor: ActorContext, id: string) {
    await this.assertWritable(tenant, actor, id);
    await this.prisma.todo.delete({ where: { id } });
    return { ok: true };
  }
}

