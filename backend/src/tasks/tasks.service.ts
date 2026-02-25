import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';
import { hasPermission } from '../auth/permissions.utils';

type ActorContext = {
  userId: string;
  role: string;
  permissions?: string[];
};

type TaskQuery = {
  q?: string;
  status?: string;
  tab?: string;
  assignee?: string;
  page?: number;
  pageSize?: number;
};

type TaskMoveBody = {
  status?: string;
  order?: number;
};

type TaskPayload = Partial<{
  title: string;
  description: string;
  dueAt: string;
  status: string;
  priority: string;
  assignedToUserId: string;
  contactId: string;
  companyId: string;
  dealId: string;
}>;

type TaskBoardStatus = 'backlog' | 'today' | 'in_progress' | 'waiting' | 'done';

type TxClient = Prisma.TransactionClient | PrismaService | PrismaClient;

const BOARD_COLUMNS: TaskBoardStatus[] = ['backlog', 'today', 'in_progress', 'waiting', 'done'];
const BOARD_SET = new Set<string>(BOARD_COLUMNS);
const ACTIVE_COLUMNS: TaskBoardStatus[] = ['backlog', 'today', 'in_progress', 'waiting'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const taskSelect = {
  id: true,
  title: true,
  description: true,
  dueAt: true,
  status: true,
  priority: true,
  position: true,
  assignedToUserId: true,
  createdByUserId: true,
  contactId: true,
  companyId: true,
  dealId: true,
  createdAt: true,
  updatedAt: true,
  assignee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      avatarUrl: true,
      email: true,
      phone: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  deal: { select: { id: true, title: true } },
};

function isOwner(actor: ActorContext): boolean {
  return hasPermission(actor, 'tasks.manage');
}

function normalizeStatus(raw?: string | null): TaskBoardStatus {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (!value || value === 'open') return 'today';
  if (value === 'done') return 'done';
  if (BOARD_SET.has(value)) return value as TaskBoardStatus;
  return 'backlog';
}

function normalizePriority(raw?: string | null): (typeof PRIORITIES)[number] {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase();
  return (PRIORITIES as readonly string[]).includes(value) ? (value as (typeof PRIORITIES)[number]) : 'MEDIUM';
}

function statusOrder(status: string): number {
  const idx = BOARD_COLUMNS.indexOf(normalizeStatus(status));
  return idx === -1 ? 999 : idx;
}

function cleanString(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTenantMember(tenant: TenantContext, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId } },
      select: { status: true },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new BadRequestException('INVALID_ASSIGNEE');
    }
  }

  private accessFilter(actor: ActorContext): any {
    if (isOwner(actor)) return {};
    return {
      OR: [{ assignedToUserId: actor.userId }, { createdByUserId: actor.userId }],
    };
  }

  private parseTab(tab?: string): 'board' | 'my-tasks' | 'team' | 'archive' {
    const value = String(tab ?? 'board').trim().toLowerCase();
    if (value === 'my-tasks' || value === 'team' || value === 'archive') return value;
    return 'board';
  }

  private buildWhere(tenant: TenantContext, actor: ActorContext, query?: TaskQuery) {
    const tab = this.parseTab(query?.tab);
    const and: any[] = [{ tenantId: tenant.id }];

    if (!isOwner(actor)) {
      and.push(this.accessFilter(actor));
    }

    const assignee = cleanString(query?.assignee);
    if (assignee) {
      if (assignee === 'me' || !isOwner(actor)) {
        and.push({ assignedToUserId: actor.userId });
      } else {
        and.push({ assignedToUserId: assignee });
      }
    }

    const explicitStatus = cleanString(query?.status);
    if (explicitStatus) {
      and.push({ status: normalizeStatus(explicitStatus) });
    } else if (tab === 'my-tasks') {
      and.push({ assignedToUserId: actor.userId });
      and.push({ status: { in: ACTIVE_COLUMNS } });
    } else if (tab === 'team') {
      if (isOwner(actor)) {
        and.push({ status: { in: ACTIVE_COLUMNS } });
      } else {
        and.push({ assignedToUserId: actor.userId });
        and.push({ status: { in: ACTIVE_COLUMNS } });
      }
    } else if (tab === 'archive') {
      and.push({ status: 'done' });
    } else {
      and.push({ status: { in: BOARD_COLUMNS } });
    }

    const q = cleanString(query?.q);
    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { contact: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] } },
          { company: { name: { contains: q, mode: 'insensitive' } } },
          { deal: { title: { contains: q, mode: 'insensitive' } } },
          {
            assignee: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }

    return and.length === 1 ? and[0] : { AND: and };
  }

  private async nextPosition(tx: TxClient, tenantId: string, status: TaskBoardStatus): Promise<number> {
    const max = await tx.task.aggregate({
      where: { tenantId, status },
      _max: { position: true },
    });
    return (max._max.position ?? -1) + 1;
  }

  private async assertCanEdit(tenant: TenantContext, actor: ActorContext, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        status: true,
        assignedToUserId: true,
        createdByUserId: true,
      },
    });

    if (!task) throw new NotFoundException();

    if (!isOwner(actor)) {
      const isMine = task.assignedToUserId === actor.userId || task.createdByUserId === actor.userId;
      if (!isMine) throw new ForbiddenException('FORBIDDEN');
    }

    return task;
  }

  private async reindexColumn(
    tx: TxClient,
    tenant: TenantContext,
    actor: ActorContext,
    status: TaskBoardStatus,
    excludeId?: string,
  ) {
    const where: any = { tenantId: tenant.id, status };
    if (excludeId) where.id = { not: excludeId };
    if (!isOwner(actor)) {
      where.OR = [{ assignedToUserId: actor.userId }, { createdByUserId: actor.userId }];
    }

    const ids = await tx.task.findMany({
      where,
      select: { id: true },
      orderBy: [{ position: 'asc' }, { updatedAt: 'asc' }, { id: 'asc' }],
    });

    for (let i = 0; i < ids.length; i += 1) {
      await tx.task.update({ where: { id: ids[i].id }, data: { position: i } });
    }
  }

  private normalizeTaskRow<T extends { status: string }>(task: T): T {
    const normalized = normalizeStatus(task.status);
    if (task.status === normalized) return task;
    return { ...task, status: normalized };
  }

  async list(tenant: TenantContext, actor: ActorContext, query?: TaskQuery) {
    const tab = this.parseTab(query?.tab);
    const page = Math.max(1, query?.page ?? 1);
    const requested = query?.pageSize ?? (tab === 'board' ? 500 : 25);
    const pageSize = Math.min(tab === 'board' ? 500 : 100, Math.max(1, requested));
    const skip = (page - 1) * pageSize;
    const where = this.buildWhere(tenant, actor, query);

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: taskSelect,
        orderBy: [{ status: 'asc' }, { position: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    const normalized = data
      .map((row) => this.normalizeTaskRow(row))
      .sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || a.position - b.position);

    return { data: normalized, total, page, pageSize, tab, boardColumns: BOARD_COLUMNS };
  }

  async listAssignees(tenant: TenantContext, actor: ActorContext) {
    void actor;

    const members = await this.prisma.membership.findMany({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { userId: 'asc' }],
    });

    return members.map((m) => ({ ...m.user, role: m.role }));
  }

  async getOne(tenant: TenantContext, actor: ActorContext, id: string) {
    const where: any = { id, tenantId: tenant.id };
    if (!isOwner(actor)) {
      where.OR = [{ assignedToUserId: actor.userId }, { createdByUserId: actor.userId }];
    }

    const task = await this.prisma.task.findFirst({ where, select: taskSelect });
    if (!task) throw new NotFoundException();
    return this.normalizeTaskRow(task);
  }

  async create(tenant: TenantContext, actor: ActorContext, body: TaskPayload) {
    const title = cleanString(body.title);
    if (!title) throw new BadRequestException('TITLE_REQUIRED');

    const assignee = cleanString(body.assignedToUserId) ?? actor.userId;
    await this.assertTenantMember(tenant, assignee);

    const status = normalizeStatus(body.status);
    const position = await this.nextPosition(this.prisma, tenant.id, status);

    return this.prisma.task.create({
      data: {
        tenantId: tenant.id,
        title,
        description: cleanString(body.description),
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        status,
        priority: normalizePriority(body.priority),
        position,
        assignedToUserId: assignee,
        createdByUserId: actor.userId,
        contactId: cleanString(body.contactId),
        companyId: cleanString(body.companyId),
        dealId: cleanString(body.dealId),
      },
      select: taskSelect,
    });
  }

  async update(tenant: TenantContext, actor: ActorContext, id: string, body: TaskPayload) {
    const existing = await this.assertCanEdit(tenant, actor, id);
    const data: any = {};

    if (body.title !== undefined) {
      const nextTitle = cleanString(body.title);
      if (!nextTitle) throw new BadRequestException('TITLE_REQUIRED');
      data.title = nextTitle;
    }

    if (body.description !== undefined) data.description = cleanString(body.description);
    if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.priority !== undefined) data.priority = normalizePriority(body.priority);
    if (body.contactId !== undefined) data.contactId = cleanString(body.contactId);
    if (body.companyId !== undefined) data.companyId = cleanString(body.companyId);
    if (body.dealId !== undefined) data.dealId = cleanString(body.dealId);

    if (body.assignedToUserId !== undefined) {
      const nextAssignee = cleanString(body.assignedToUserId) ?? actor.userId;
      await this.assertTenantMember(tenant, nextAssignee);
      data.assignedToUserId = nextAssignee;
    }

    if (body.status !== undefined) {
      const nextStatus = normalizeStatus(body.status);
      data.status = nextStatus;
      if (nextStatus !== normalizeStatus(existing.status)) {
        data.position = await this.nextPosition(this.prisma, tenant.id, nextStatus);
      }
    }

    if (Object.keys(data).length === 0) {
      return this.getOne(tenant, actor, id);
    }

    const updated = await this.prisma.task.update({ where: { id }, data, select: taskSelect });
    return this.normalizeTaskRow(updated);
  }

  async move(tenant: TenantContext, actor: ActorContext, id: string, body: TaskMoveBody) {
    const existing = await this.assertCanEdit(tenant, actor, id);
    const fromStatus = normalizeStatus(existing.status);
    const toStatus = normalizeStatus(body.status ?? existing.status);
    const targetOrder = Math.max(0, Math.floor(Number.isFinite(body.order) ? Number(body.order) : 0));

    const moved = await this.prisma.$transaction(async (tx) => {
      if (fromStatus !== toStatus) {
        await tx.task.update({ where: { id }, data: { status: toStatus } });
        await this.reindexColumn(tx, tenant, actor, fromStatus, id);
      }

      const where: any = { tenantId: tenant.id, status: toStatus, id: { not: id } };
      if (!isOwner(actor)) {
        where.OR = [{ assignedToUserId: actor.userId }, { createdByUserId: actor.userId }];
      }

      const peers = await tx.task.findMany({
        where,
        select: { id: true },
        orderBy: [{ position: 'asc' }, { updatedAt: 'asc' }, { id: 'asc' }],
      });

      const ids = peers.map((x) => x.id);
      const safeIndex = Math.min(targetOrder, ids.length);
      ids.splice(safeIndex, 0, id);

      for (let i = 0; i < ids.length; i += 1) {
        await tx.task.update({
          where: { id: ids[i] },
          data: {
            position: i,
            ...(ids[i] === id ? { status: toStatus } : {}),
          },
        });
      }

      return tx.task.findUniqueOrThrow({ where: { id }, select: taskSelect });
    });

    return this.normalizeTaskRow(moved);
  }

  async remove(tenant: TenantContext, actor: ActorContext, id: string) {
    await this.assertCanEdit(tenant, actor, id);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }
}

