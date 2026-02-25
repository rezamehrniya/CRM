import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';
import { hasPermission } from '../auth/permissions.utils';

type ActorContext =
  | {
      userId: string;
      role: string;
      permissions?: string[];
    }
  | undefined;

type CompanyQuery = {
  actor?: ActorContext;
  q?: string;
  owner?: string;
  status?: string;
  segment?: string;
  hasOpenDeals?: string;
  activityDays?: number;
  page?: number;
  pageSize?: number;
};

type AccountStatus = 'HOT' | 'WARM' | 'COLD';
type Segment = 'A' | 'B' | 'C';

const companySelect = {
  id: true,
  name: true,
  phone: true,
  website: true,
  _count: { select: { contacts: true } },
} as const;

function cleanString(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: Prisma.Decimal | string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBool(value?: string): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return null;
}

function daysSince(date?: Date | null): number | null {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  return diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isClosedStage(name?: string | null): boolean {
  const value = String(name ?? '').toLowerCase();
  return value.includes('بسته') || value.includes('close') || value.includes('won') || value.includes('lost');
}

function deriveSegment(openPipelineValue: number, openDealsCount: number, contactsCount: number): Segment {
  if (openPipelineValue >= 180_000_000 || openDealsCount >= 3 || contactsCount >= 6) return 'A';
  if (openPipelineValue >= 60_000_000 || openDealsCount >= 1 || contactsCount >= 3) return 'B';
  return 'C';
}

function deriveAccountStatus(
  openDealsCount: number,
  openPipelineValue: number,
  lastActivityAt: Date | null,
): AccountStatus {
  const days = daysSince(lastActivityAt);
  if ((openDealsCount > 0 && (days === null || days <= 14)) || openPipelineValue >= 120_000_000) return 'HOT';
  if (openDealsCount > 0 || (days !== null && days <= 35)) return 'WARM';
  return 'COLD';
}

function canManage(actor?: ActorContext): boolean {
  return hasPermission(actor, 'companies.manage');
}

function incrementScore(
  map: Map<string, Map<string, number>>,
  companyId: string,
  ownerId: string | null | undefined,
  weight: number,
) {
  if (!ownerId) return;
  const bucket = map.get(companyId) ?? new Map<string, number>();
  bucket.set(ownerId, (bucket.get(ownerId) ?? 0) + weight);
  map.set(companyId, bucket);
}

function pickTopOwner(map: Map<string, number>): string | null {
  let bestId: string | null = null;
  let bestScore = -1;
  for (const [id, score] of map.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext, query?: CompanyQuery) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 25));

    const where: Prisma.CompanyWhereInput = { tenantId: tenant.id };
    const q = cleanString(query?.q);
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { website: { contains: q, mode: 'insensitive' } },
      ];
    }

    const companies = await this.prisma.company.findMany({
      where,
      select: companySelect,
      orderBy: { name: 'asc' },
    });

    if (companies.length === 0) {
      return { data: [], total: 0, page, pageSize };
    }

    const companyIds = companies.map((company) => company.id);
    const [contacts, deals, tasks, activities] = await Promise.all([
      this.prisma.contact.findMany({
        where: { tenantId: tenant.id, companyId: { in: companyIds } },
        select: { companyId: true, ownerUserId: true },
      }),
      this.prisma.deal.findMany({
        where: { tenantId: tenant.id, companyId: { in: companyIds } },
        select: { companyId: true, ownerUserId: true, amount: true, stage: { select: { name: true } } },
      }),
      this.prisma.task.findMany({
        where: { tenantId: tenant.id, companyId: { in: companyIds } },
        select: { companyId: true, assignedToUserId: true, status: true, dueAt: true },
      }),
      this.prisma.activity.findMany({
        where: {
          tenantId: tenant.id,
          OR: [
            { contact: { companyId: { in: companyIds } } },
            { deal: { companyId: { in: companyIds } } },
          ],
        },
        select: {
          type: true,
          happenedAt: true,
          contact: { select: { companyId: true } },
          deal: { select: { companyId: true } },
        },
        orderBy: [{ happenedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const dealStats = new Map<string, { openDealsCount: number; openPipelineValue: number }>();
    const overdueTasks = new Map<string, number>();
    const ownerScores = new Map<string, Map<string, number>>();
    const now = Date.now();

    for (const contact of contacts) {
      if (!contact.companyId) continue;
      incrementScore(ownerScores, contact.companyId, contact.ownerUserId, 2);
    }

    for (const deal of deals) {
      if (!deal.companyId) continue;
      const stats = dealStats.get(deal.companyId) ?? { openDealsCount: 0, openPipelineValue: 0 };
      const closed = isClosedStage(deal.stage?.name);
      if (!closed) {
        stats.openDealsCount += 1;
        stats.openPipelineValue += toNumber(deal.amount);
      }
      dealStats.set(deal.companyId, stats);
      incrementScore(ownerScores, deal.companyId, deal.ownerUserId, 3);
    }

    for (const task of tasks) {
      if (!task.companyId) continue;
      incrementScore(ownerScores, task.companyId, task.assignedToUserId, 1);
      if (task.status !== 'done' && task.dueAt && task.dueAt.getTime() < now) {
        overdueTasks.set(task.companyId, (overdueTasks.get(task.companyId) ?? 0) + 1);
      }
    }

    const latestActivity = new Map<string, { type: string; happenedAt: Date }>();
    for (const activity of activities) {
      const companyId = activity.deal?.companyId ?? activity.contact?.companyId;
      if (!companyId) continue;
      if (!latestActivity.has(companyId)) {
        latestActivity.set(companyId, { type: activity.type, happenedAt: activity.happenedAt });
      }
    }

    const ownerIdSet = new Set<string>();
    const selectedOwnerByCompany = new Map<string, string | null>();
    for (const [companyId, scoreMap] of ownerScores.entries()) {
      const ownerId = pickTopOwner(scoreMap);
      selectedOwnerByCompany.set(companyId, ownerId);
      if (ownerId) ownerIdSet.add(ownerId);
    }

    const owners = ownerIdSet.size
      ? await this.prisma.membership.findMany({
          where: { tenantId: tenant.id, userId: { in: Array.from(ownerIdSet) } },
          select: {
            userId: true,
            role: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        })
      : [];

    const ownerMap = new Map(owners.map((owner) => [owner.userId, { ...owner.user, role: owner.role }]));
    const ownerFilter = cleanString(query?.owner);
    const statusFilter = cleanString(query?.status)?.toUpperCase() as AccountStatus | undefined;
    const segmentFilter = cleanString(query?.segment)?.toUpperCase() as Segment | undefined;
    const hasOpenDealsFilter = toBool(query?.hasOpenDeals);
    const activityDaysFilter = Number.isFinite(query?.activityDays) ? Math.max(0, query?.activityDays ?? 0) : undefined;

    const enriched = companies
      .map((company) => {
        const stats = dealStats.get(company.id) ?? { openDealsCount: 0, openPipelineValue: 0 };
        const overdueTasksCount = overdueTasks.get(company.id) ?? 0;
        const activity = latestActivity.get(company.id) ?? null;
        const ownerUserId = selectedOwnerByCompany.get(company.id) ?? null;
        const contactsCount = company._count?.contacts ?? 0;
        const segment = deriveSegment(stats.openPipelineValue, stats.openDealsCount, contactsCount);
        const accountStatus = deriveAccountStatus(stats.openDealsCount, stats.openPipelineValue, activity?.happenedAt ?? null);
        const activityAgeDays = daysSince(activity?.happenedAt ?? null);
        return {
          ...company,
          ownerUserId,
          owner: ownerUserId ? ownerMap.get(ownerUserId) ?? null : null,
          salesStatus: accountStatus,
          segment,
          contactsCount,
          openDealsCount: stats.openDealsCount,
          openPipelineValue: String(Math.round(stats.openPipelineValue)),
          overdueTasksCount,
          lastActivityType: activity?.type ?? null,
          lastActivityAt: activity?.happenedAt ?? null,
          activityAgeDays,
          tags: [
            `SEGMENT_${segment}`,
            accountStatus,
            stats.openDealsCount > 0 ? 'HAS_OPEN_DEAL' : 'NO_OPEN_DEAL',
            overdueTasksCount > 0 ? 'HAS_OVERDUE_TASK' : 'NO_OVERDUE_TASK',
          ],
        };
      })
      .filter((company) => {
        if (!canManage(query?.actor) && query?.actor?.userId) {
          if (company.ownerUserId !== query.actor.userId) return false;
        }
        if (ownerFilter) {
          if (ownerFilter === 'me' && query?.actor?.userId && company.ownerUserId !== query.actor.userId) return false;
          if (ownerFilter !== 'me' && ownerFilter !== 'all' && company.ownerUserId !== ownerFilter) return false;
        }
        if (statusFilter && company.salesStatus !== statusFilter) return false;
        if (segmentFilter && company.segment !== segmentFilter) return false;
        if (hasOpenDealsFilter !== null && (company.openDealsCount > 0) !== hasOpenDealsFilter) return false;
        if (activityDaysFilter !== undefined) {
          if (company.activityAgeDays === null) return false;
          if (company.activityAgeDays > activityDaysFilter) return false;
        }
        return true;
      });

    const total = enriched.length;
    const skip = (page - 1) * pageSize;
    const data = enriched.slice(skip, skip + pageSize);
    return { data, total, page, pageSize };
  }

  async listOwners(tenant: TenantContext, actor?: ActorContext) {
    const where: Prisma.MembershipWhereInput = { tenantId: tenant.id, status: 'ACTIVE' };
    if (!canManage(actor) && actor?.userId) where.userId = actor.userId;

    const members = await this.prisma.membership.findMany({
      where,
      select: {
        role: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { userId: 'asc' }],
    });

    return members.map((member) => ({ ...member.user, role: member.role }));
  }

  async getOne(tenant: TenantContext, id: string, actor?: ActorContext) {
    const company = await this.prisma.company.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        ...companySelect,
        tenantId: true,
        contacts: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            ownerUserId: true,
          },
        },
        deals: {
          select: {
            id: true,
            title: true,
            amount: true,
            ownerUserId: true,
            stage: { select: { name: true } },
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            dueAt: true,
            assignedToUserId: true,
          },
        },
      },
    });

    if (!company) return null;

    const ownerScores = new Map<string, number>();
    for (const contact of company.contacts) {
      if (contact.ownerUserId) ownerScores.set(contact.ownerUserId, (ownerScores.get(contact.ownerUserId) ?? 0) + 2);
    }
    for (const deal of company.deals) {
      if (deal.ownerUserId) ownerScores.set(deal.ownerUserId, (ownerScores.get(deal.ownerUserId) ?? 0) + 3);
    }
    for (const task of company.tasks) {
      if (task.assignedToUserId) ownerScores.set(task.assignedToUserId, (ownerScores.get(task.assignedToUserId) ?? 0) + 1);
    }
    const ownerUserId = pickTopOwner(ownerScores);

    if (!canManage(actor) && actor?.userId && ownerUserId && ownerUserId !== actor.userId) {
      throw new NotFoundException();
    }

    const owner =
      ownerUserId &&
      (await this.prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId: tenant.id, userId: ownerUserId } },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              phone: true,
              avatarUrl: true,
            },
          },
        },
      }));

    const latestActivity = await this.prisma.activity.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [{ contact: { companyId: company.id } }, { deal: { companyId: company.id } }],
      },
      select: { type: true, happenedAt: true },
      orderBy: [{ happenedAt: 'desc' }, { id: 'desc' }],
    });

    let openDealsCount = 0;
    let openPipelineValue = 0;
    for (const deal of company.deals) {
      if (!isClosedStage(deal.stage?.name)) {
        openDealsCount += 1;
        openPipelineValue += toNumber(deal.amount);
      }
    }

    const overdueTasksCount = company.tasks.filter(
      (task) => task.status !== 'done' && task.dueAt && task.dueAt.getTime() < Date.now(),
    ).length;

    const segment = deriveSegment(openPipelineValue, openDealsCount, company._count?.contacts ?? 0);
    const salesStatus = deriveAccountStatus(openDealsCount, openPipelineValue, latestActivity?.happenedAt ?? null);

    return {
      ...company,
      ownerUserId,
      owner: owner ? { ...owner.user, role: owner.role } : null,
      segment,
      salesStatus,
      openDealsCount,
      openPipelineValue: String(Math.round(openPipelineValue)),
      overdueTasksCount,
      lastActivityType: latestActivity?.type ?? null,
      lastActivityAt: latestActivity?.happenedAt ?? null,
      contactsCount: company._count?.contacts ?? 0,
    };
  }

  async create(tenant: TenantContext, _actor: ActorContext, body: { name: string; phone?: string; website?: string }) {
    const name = cleanString(body.name);
    if (!name) throw new BadRequestException('NAME_REQUIRED');

    return this.prisma.company.create({
      data: {
        tenantId: tenant.id,
        name,
        phone: body.phone?.trim() || null,
        website: body.website?.trim() || null,
      },
      select: companySelect,
    });
  }

  private readonly IMPORT_MAX = 200;

  async createMany(tenant: TenantContext, items: Array<{ name?: string; phone?: string; website?: string }>) {
    const toCreate = items.slice(0, this.IMPORT_MAX).map((row) => ({
      tenantId: tenant.id,
      name: (row.name ?? '').trim() || '-',
      phone: (row.phone ?? '').trim() || null,
      website: (row.website ?? '').trim() || null,
    }));
    if (toCreate.length === 0) return { created: 0 };
    const result = await this.prisma.company.createMany({ data: toCreate });
    return { created: result.count };
  }

  async update(
    tenant: TenantContext,
    _actor: ActorContext,
    id: string,
    body: Partial<{ name: string; phone: string; website: string }>,
  ) {
    const existing = await this.prisma.company.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();

    const data: any = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.website !== undefined) data.website = body.website?.trim() || null;

    return this.prisma.company.update({
      where: { id },
      data,
      select: companySelect,
    });
  }

  async remove(tenant: TenantContext, _actor: ActorContext, id: string) {
    const existing = await this.prisma.company.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.company.delete({ where: { id } });
    return { ok: true };
  }
}
