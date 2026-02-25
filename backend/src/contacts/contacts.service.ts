import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

type ContactQuery = {
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

type RelationshipStatus = 'ACTIVE' | 'DORMANT' | 'LOST';
type Segment = 'A' | 'B' | 'C';

const contactSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  companyId: true,
  ownerUserId: true,
  company: { select: { id: true, name: true } },
} as const;

function cleanString(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canManageOwners(actor?: ActorContext): boolean {
  return hasPermission(actor, 'contacts.manage');
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

function isClosedStage(name?: string | null): boolean {
  const value = String(name ?? '').toLowerCase();
  return value.includes('بسته') || value.includes('close') || value.includes('won') || value.includes('lost');
}

function daysSince(date?: Date | null): number | null {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  return diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function deriveStatus(lastActivityAt: Date | null, openDealsCount: number, dealsCount: number): RelationshipStatus {
  const days = daysSince(lastActivityAt);
  if (days !== null) {
    if (days <= 14) return 'ACTIVE';
    if (days <= 45) return 'DORMANT';
    return openDealsCount > 0 ? 'DORMANT' : 'LOST';
  }
  if (openDealsCount > 0) return 'ACTIVE';
  if (dealsCount > 0) return 'DORMANT';
  return 'LOST';
}

function deriveSegment(openPipelineValue: number, openDealsCount: number, dealsCount: number): Segment {
  if (openPipelineValue >= 120_000_000 || openDealsCount >= 3) return 'A';
  if (openPipelineValue >= 40_000_000 || openDealsCount >= 1 || dealsCount >= 2) return 'B';
  return 'C';
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext, query?: ContactQuery) {
    const actor = query?.actor;
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 25));
    const where: Prisma.ContactWhereInput = { tenantId: tenant.id };

    const q = cleanString(query?.q);
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const ownerFilter = cleanString(query?.owner);
    if (ownerFilter) {
      if (ownerFilter === 'me' && actor?.userId) {
        where.ownerUserId = actor.userId;
      } else if (ownerFilter !== 'all') {
        where.ownerUserId = ownerFilter;
      }
    }

    if (actor?.userId && !canManageOwners(actor)) {
      where.ownerUserId = actor.userId;
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      select: contactSelect,
      orderBy: [{ id: 'asc' }],
    });

    if (contacts.length === 0) {
      return { data: [], total: 0, page, pageSize };
    }

    const contactIds = contacts.map((contact) => contact.id);
    const ownerIds = Array.from(new Set(contacts.map((contact) => contact.ownerUserId).filter((id): id is string => !!id)));

    const [members, activities, deals] = await Promise.all([
      ownerIds.length > 0
        ? this.prisma.membership.findMany({
            where: { tenantId: tenant.id, userId: { in: ownerIds } },
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
        : Promise.resolve([]),
      this.prisma.activity.findMany({
        where: { tenantId: tenant.id, contactId: { in: contactIds } },
        select: { contactId: true, type: true, happenedAt: true },
        orderBy: [{ happenedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.deal.findMany({
        where: { tenantId: tenant.id, contactId: { in: contactIds } },
        select: { contactId: true, amount: true, stage: { select: { name: true } } },
      }),
    ]);

    const ownerMap = new Map(
      members.map((member) => [member.userId, { ...member.user, role: member.role }]),
    );

    const latestActivityMap = new Map<string, { type: string; happenedAt: Date }>();
    for (const activity of activities) {
      if (!activity.contactId) continue;
      if (!latestActivityMap.has(activity.contactId)) {
        latestActivityMap.set(activity.contactId, { type: activity.type, happenedAt: activity.happenedAt });
      }
    }

    const dealStatsMap = new Map<string, { dealsCount: number; openDealsCount: number; openPipelineValue: number }>();
    for (const deal of deals) {
      if (!deal.contactId) continue;
      const current = dealStatsMap.get(deal.contactId) ?? { dealsCount: 0, openDealsCount: 0, openPipelineValue: 0 };
      current.dealsCount += 1;
      if (!isClosedStage(deal.stage?.name)) {
        current.openDealsCount += 1;
        current.openPipelineValue += toNumber(deal.amount);
      }
      dealStatsMap.set(deal.contactId, current);
    }

    const statusFilter = cleanString(query?.status)?.toUpperCase() as RelationshipStatus | undefined;
    const segmentFilter = cleanString(query?.segment)?.toUpperCase() as Segment | undefined;
    const hasOpenDealsFilter = toBool(query?.hasOpenDeals);
    const activityDaysFilter = Number.isFinite(query?.activityDays) ? Math.max(0, query?.activityDays ?? 0) : undefined;

    const enriched = contacts
      .map((contact) => {
        const activity = latestActivityMap.get(contact.id) ?? null;
        const stats = dealStatsMap.get(contact.id) ?? { dealsCount: 0, openDealsCount: 0, openPipelineValue: 0 };
        const relationshipStatus = deriveStatus(activity?.happenedAt ?? null, stats.openDealsCount, stats.dealsCount);
        const segment = deriveSegment(stats.openPipelineValue, stats.openDealsCount, stats.dealsCount);
        const activityAgeDays = daysSince(activity?.happenedAt ?? null);

        const tags = [
          `SEGMENT_${segment}`,
          stats.openDealsCount > 0 ? 'HAS_OPEN_DEAL' : 'NO_OPEN_DEAL',
          contact.companyId ? 'HAS_COMPANY' : 'NO_COMPANY',
          relationshipStatus,
        ];

        return {
          ...contact,
          owner: contact.ownerUserId ? ownerMap.get(contact.ownerUserId) ?? null : null,
          customerType: contact.companyId ? 'COMPANY' : 'PERSON',
          relationshipStatus,
          segment,
          lastActivityType: activity?.type ?? null,
          lastActivityAt: activity?.happenedAt ?? null,
          activityAgeDays,
          dealsCount: stats.dealsCount,
          openDealsCount: stats.openDealsCount,
          openPipelineValue: String(Math.round(stats.openPipelineValue)),
          tags,
        };
      })
      .filter((contact) => {
        if (statusFilter && contact.relationshipStatus !== statusFilter) return false;
        if (segmentFilter && contact.segment !== segmentFilter) return false;
        if (hasOpenDealsFilter !== null && (contact.openDealsCount > 0) !== hasOpenDealsFilter) return false;
        if (activityDaysFilter !== undefined) {
          if (contact.activityAgeDays === null) return false;
          if (contact.activityAgeDays > activityDaysFilter) return false;
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
    if (!canManageOwners(actor) && actor?.userId) {
      where.userId = actor.userId;
    }

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

  async getOne(tenant: TenantContext, id: string) {
    return this.prisma.contact.findFirst({
      where: { id, tenantId: tenant.id },
      select: { ...contactSelect, tenantId: true },
    });
  }

  async create(
    tenant: TenantContext,
    actor: ActorContext,
    body: {
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      companyId?: string;
      ownerUserId?: string;
    },
  ) {
    const requestedOwnerId = cleanString(body.ownerUserId);
    const nextOwnerId = requestedOwnerId ?? actor?.userId ?? null;

    if (nextOwnerId && !canManageOwners(actor) && nextOwnerId !== actor?.userId) {
      throw new ForbiddenException('FORBIDDEN_ASSIGN_OWNER');
    }

    if (nextOwnerId) {
      const ownerMembership = await this.prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId: tenant.id, userId: nextOwnerId } },
      });
      if (!ownerMembership) throw new BadRequestException('INVALID_OWNER');
    }

    return this.prisma.contact.create({
      data: {
        tenantId: tenant.id,
        firstName: body.firstName?.trim() ?? '',
        lastName: body.lastName?.trim() ?? '',
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        companyId: body.companyId || null,
        ownerUserId: nextOwnerId,
      },
      select: contactSelect,
    });
  }

  private readonly IMPORT_MAX = 200;

  async createMany(
    tenant: TenantContext,
    items: Array<{ firstName?: string; lastName?: string; fullName?: string; phone?: string; email?: string }>,
  ) {
    const toCreate = items.slice(0, this.IMPORT_MAX).map((row) => {
      let firstName = (row.firstName ?? '').trim();
      let lastName = (row.lastName ?? '').trim();
      if (!firstName && !lastName && (row.fullName ?? '').trim()) {
        const full = (row.fullName ?? '').trim();
        const space = full.indexOf(' ');
        firstName = space >= 0 ? full.slice(0, space) : full;
        lastName = space >= 0 ? full.slice(space + 1).trim() : '';
      }
      if (!firstName) firstName = '-';
      return {
        tenantId: tenant.id,
        firstName,
        lastName: lastName || '-',
        phone: (row.phone ?? '').trim() || null,
        email: (row.email ?? '').trim() || null,
      };
    });

    if (toCreate.length === 0) return { created: 0 };
    const result = await this.prisma.contact.createMany({ data: toCreate });
    return { created: result.count };
  }

  async reassign(
    tenant: TenantContext,
    actor: ActorContext,
    body: { ids?: string[]; ownerUserId?: string | null },
  ) {
    if (!canManageOwners(actor)) {
      throw new ForbiddenException('FORBIDDEN_ASSIGN_OWNER');
    }

    const ids = Array.from(new Set((body.ids ?? []).map((id) => id.trim()).filter(Boolean)));
    if (ids.length === 0) {
      throw new BadRequestException('EMPTY_IDS');
    }

    const nextOwnerId = cleanString(body.ownerUserId ?? null);
    if (nextOwnerId) {
      const ownerMembership = await this.prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId: tenant.id, userId: nextOwnerId } },
      });
      if (!ownerMembership) throw new BadRequestException('INVALID_OWNER');
    }

    const result = await this.prisma.contact.updateMany({
      where: { tenantId: tenant.id, id: { in: ids } },
      data: { ownerUserId: nextOwnerId },
    });

    return { ok: true, updated: result.count };
  }

  async update(
    tenant: TenantContext,
    actor: ActorContext,
    id: string,
    body: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
      companyId: string;
      ownerUserId: string | null;
    }>,
  ) {
    const existing = await this.prisma.contact.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, ownerUserId: true },
    });
    if (!existing) throw new NotFoundException();

    const data: any = {};
    if (body.firstName !== undefined) data.firstName = body.firstName.trim();
    if (body.lastName !== undefined) data.lastName = body.lastName.trim();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.email !== undefined) data.email = body.email?.trim() || null;
    if (body.companyId !== undefined) data.companyId = body.companyId || null;

    if (body.ownerUserId !== undefined) {
      const nextOwnerId = cleanString(body.ownerUserId);
      if (!canManageOwners(actor) && nextOwnerId !== actor?.userId && nextOwnerId !== existing.ownerUserId) {
        throw new ForbiddenException('FORBIDDEN_ASSIGN_OWNER');
      }
      if (nextOwnerId) {
        const ownerMembership = await this.prisma.membership.findUnique({
          where: { tenantId_userId: { tenantId: tenant.id, userId: nextOwnerId } },
        });
        if (!ownerMembership) throw new BadRequestException('INVALID_OWNER');
      }
      data.ownerUserId = nextOwnerId;
    }

    return this.prisma.contact.update({
      where: { id },
      data,
      select: contactSelect,
    });
  }

  async remove(tenant: TenantContext, actor: ActorContext, id: string) {
    const existing = await this.prisma.contact.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, ownerUserId: true },
    });
    if (!existing) throw new NotFoundException();

    if (!canManageOwners(actor) && existing.ownerUserId && existing.ownerUserId !== actor?.userId) {
      throw new ForbiddenException('FORBIDDEN');
    }

    await this.prisma.contact.delete({ where: { id } });
    return { ok: true };
  }
}
