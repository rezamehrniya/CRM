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

type LeadQuery = {
  actor?: ActorContext;
  q?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  source?: string;
  owner?: string;
  overdue?: string;
  activityDays?: number;
};

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];
const OPEN_LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED'];

const leadSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  companyName: true,
  source: true,
  status: true,
  notes: true,
  followUpAt: true,
  ownerUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeadSelect;

function cleanString(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStatus(value?: string | null): LeadStatus {
  const candidate = String(value ?? '')
    .trim()
    .toUpperCase();
  return (LEAD_STATUSES as readonly string[]).includes(candidate) ? (candidate as LeadStatus) : 'NEW';
}

function toBool(value?: string): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return null;
}

function canManage(actor?: ActorContext): boolean {
  return hasPermission(actor, 'leads.manage');
}

function isOpenLeadStatus(status: string): boolean {
  return OPEN_LEAD_STATUSES.includes(normalizeStatus(status));
}

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private get lead(): PrismaService['lead'] {
    return this.prisma.lead;
  }

  private async ownerMap(tenantId: string, ownerIds: string[]) {
    if (ownerIds.length === 0) return new Map<string, any>();
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId, userId: { in: ownerIds } },
      select: {
        role: true,
        userId: true,
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
    });
    return new Map(memberships.map((item) => [item.userId, { ...item.user, role: item.role }]));
  }

  private canAccessLead(actor: ActorContext, lead: { ownerUserId?: string | null }) {
    if (canManage(actor)) return true;
    if (!actor?.userId) return false;
    return !lead.ownerUserId || lead.ownerUserId === actor.userId;
  }

  private buildWhere(tenant: TenantContext, query?: LeadQuery): Prisma.LeadWhereInput {
    const clauses: Prisma.LeadWhereInput[] = [{ tenantId: tenant.id }];

    const q = cleanString(query?.q);
    if (q) {
      clauses.push({
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const statuses = parseCsv(query?.status).map((item) => normalizeStatus(item));
    if (statuses.length === 1) clauses.push({ status: statuses[0] });
    if (statuses.length > 1) clauses.push({ status: { in: statuses } });

    const sources = parseCsv(query?.source);
    if (sources.length === 1) clauses.push({ source: sources[0] });
    if (sources.length > 1) clauses.push({ source: { in: sources } });

    const ownerFilter = cleanString(query?.owner);
    if (ownerFilter) {
      if (ownerFilter === 'me' && query?.actor?.userId) clauses.push({ ownerUserId: query.actor.userId });
      if (ownerFilter !== 'me' && ownerFilter !== 'all') clauses.push({ ownerUserId: ownerFilter });
    }

    if (!canManage(query?.actor) && query?.actor?.userId) {
      clauses.push({
        OR: [{ ownerUserId: query.actor.userId }, { ownerUserId: null }],
      });
    }

    const overdueFilter = toBool(query?.overdue);
    if (overdueFilter === true) {
      clauses.push({
        followUpAt: { lt: new Date() },
        status: { in: OPEN_LEAD_STATUSES },
      });
    }
    if (overdueFilter === false) {
      clauses.push({
        OR: [
          { status: { notIn: OPEN_LEAD_STATUSES } },
          { followUpAt: null },
          { followUpAt: { gte: new Date() } },
        ],
      });
    }

    if (Number.isFinite(query?.activityDays)) {
      const days = Math.max(0, query?.activityDays ?? 0);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      clauses.push({ updatedAt: { gte: since } });
    }

    return clauses.length === 1 ? clauses[0] : { AND: clauses };
  }

  private enrich(leads: Array<Prisma.LeadGetPayload<{ select: typeof leadSelect }>>, owners: Map<string, any>) {
    return leads.map((lead) => ({
      ...lead,
      status: normalizeStatus(lead.status),
      owner: lead.ownerUserId ? owners.get(lead.ownerUserId) ?? null : null,
    }));
  }

  async list(tenant: TenantContext, query?: LeadQuery) {
    const page = Math.max(1, query?.page ?? 1);
    const requestedSize = query?.pageSize ?? 25;
    const pageSize = Math.min(500, Math.max(1, requestedSize));
    const where = this.buildWhere(tenant, query);

    const [total, rows, statsRows] = await Promise.all([
      this.lead.count({ where }),
      this.lead.findMany({
        where,
        select: leadSelect,
        orderBy: [{ followUpAt: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.lead.findMany({
        where,
        select: { status: true, createdAt: true, updatedAt: true, followUpAt: true },
      }),
    ]);

    const ownerIds = Array.from(
      new Set(rows.map((lead) => lead.ownerUserId).filter((id): id is string => Boolean(id))),
    );
    const owners = await this.ownerMap(tenant.id, ownerIds);
    const data = this.enrich(rows, owners);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const now = Date.now();

    const leadsNewToday = statsRows.filter(
      (lead) => lead.createdAt >= startOfDay && lead.createdAt < endOfDay,
    ).length;
    const qualifiedCount = statsRows.filter((lead) => normalizeStatus(lead.status) === 'QUALIFIED').length;
    const overdueFollowUps = statsRows.filter(
      (lead) =>
        !!lead.followUpAt &&
        lead.followUpAt.getTime() < now &&
        isOpenLeadStatus(lead.status),
    ).length;

    const contacted = statsRows.filter((lead) =>
      ['CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'].includes(normalizeStatus(lead.status)),
    );
    const avgFirstContactHours =
      contacted.length > 0
        ? Math.round(
            contacted.reduce((sum, lead) => {
              const diff = lead.updatedAt.getTime() - lead.createdAt.getTime();
              return sum + Math.max(0, diff / (1000 * 60 * 60));
            }, 0) / contacted.length,
          )
        : 0;

    const funnel = LEAD_STATUSES.map((status) => ({
      status,
      count: statsRows.filter((lead) => normalizeStatus(lead.status) === status).length,
      overdueCount: statsRows.filter(
        (lead) =>
          normalizeStatus(lead.status) === status &&
          !!lead.followUpAt &&
          lead.followUpAt.getTime() < now &&
          isOpenLeadStatus(status),
      ).length,
    }));

    return {
      data,
      total,
      page,
      pageSize,
      kpis: {
        leadsNewToday,
        qualifiedCount,
        avgFirstContactHours,
        overdueFollowUps,
      },
      funnel,
    };
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
            avatarUrl: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { userId: 'asc' }],
    });

    return members.map((member) => ({ ...member.user, role: member.role }));
  }

  async getOne(tenant: TenantContext, actor: ActorContext, id: string) {
    const lead = await this.lead.findFirst({
      where: { id, tenantId: tenant.id },
      select: leadSelect,
    });
    if (!lead) return null;
    if (!this.canAccessLead(actor, lead)) throw new NotFoundException();
    const owners = await this.ownerMap(tenant.id, lead.ownerUserId ? [lead.ownerUserId] : []);
    return this.enrich([lead], owners)[0];
  }

  async create(
    tenant: TenantContext,
    actor: ActorContext,
    body: {
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      companyName?: string;
      source?: string;
      status?: string;
      notes?: string;
      followUpAt?: string;
      ownerUserId?: string;
    },
  ) {
    const firstName = cleanString(body.firstName);
    const lastName = cleanString(body.lastName);
    if (!firstName || !lastName) throw new BadRequestException('MISSING_NAME');

    const requestedOwnerId = cleanString(body.ownerUserId);
    const ownerUserId = canManage(actor)
      ? requestedOwnerId ?? actor?.userId ?? null
      : actor?.userId ?? null;

    return this.lead.create({
      data: {
        tenantId: tenant.id,
        firstName,
        lastName,
        phone: cleanString(body.phone),
        email: cleanString(body.email),
        companyName: cleanString(body.companyName),
        source: cleanString(body.source),
        status: normalizeStatus(body.status),
        notes: cleanString(body.notes),
        followUpAt: body.followUpAt ? new Date(body.followUpAt) : null,
        ownerUserId,
      },
      select: leadSelect,
    });
  }

  async bulkUpdate(
    tenant: TenantContext,
    actor: ActorContext,
    body: { ids?: string[]; status?: string; ownerUserId?: string | null },
  ) {
    const ids = Array.from(new Set((body.ids ?? []).map((id) => id.trim()).filter(Boolean)));
    if (ids.length === 0) throw new BadRequestException('EMPTY_IDS');

    const existing = await this.lead.findMany({
      where: { tenantId: tenant.id, id: { in: ids } },
      select: { id: true, ownerUserId: true },
    });
    if (existing.length === 0) return { ok: true, updated: 0 };

    if (!canManage(actor)) {
      const forbidden = existing.some((lead) => lead.ownerUserId && lead.ownerUserId !== actor?.userId);
      if (forbidden) throw new ForbiddenException('FORBIDDEN');
    }

    const data: Prisma.LeadUpdateManyMutationInput = {};
    if (body.status !== undefined) data.status = normalizeStatus(body.status);
    if (body.ownerUserId !== undefined) {
      if (!canManage(actor)) throw new ForbiddenException('FORBIDDEN_ASSIGN');
      data.ownerUserId = cleanString(body.ownerUserId);
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('NO_CHANGES');

    const result = await this.lead.updateMany({
      where: { tenantId: tenant.id, id: { in: existing.map((lead) => lead.id) } },
      data,
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
      companyName: string;
      source: string;
      status: string;
      notes: string;
      followUpAt: string;
      ownerUserId: string;
    }>,
  ) {
    const existing = await this.lead.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, ownerUserId: true },
    });
    if (!existing) throw new NotFoundException();
    if (!this.canAccessLead(actor, existing)) throw new ForbiddenException('FORBIDDEN');

    const data: Prisma.LeadUpdateInput = {};
    if (body.firstName !== undefined) data.firstName = cleanString(body.firstName) ?? '';
    if (body.lastName !== undefined) data.lastName = cleanString(body.lastName) ?? '';
    if (body.phone !== undefined) data.phone = cleanString(body.phone);
    if (body.email !== undefined) data.email = cleanString(body.email);
    if (body.companyName !== undefined) data.companyName = cleanString(body.companyName);
    if (body.source !== undefined) data.source = cleanString(body.source);
    if (body.status !== undefined) data.status = normalizeStatus(body.status);
    if (body.notes !== undefined) data.notes = cleanString(body.notes);
    if (body.followUpAt !== undefined) data.followUpAt = body.followUpAt ? new Date(body.followUpAt) : null;
    if (body.ownerUserId !== undefined) {
      if (!canManage(actor)) throw new ForbiddenException('FORBIDDEN_ASSIGN');
      data.ownerUserId = cleanString(body.ownerUserId);
    }

    return this.lead.update({ where: { id }, data, select: leadSelect });
  }

  async move(
    tenant: TenantContext,
    actor: ActorContext,
    id: string,
    body: { status?: string; position?: number },
  ) {
    const existing = await this.lead.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, ownerUserId: true, status: true },
    });
    if (!existing) throw new NotFoundException();
    if (!this.canAccessLead(actor, existing)) throw new ForbiddenException('FORBIDDEN');

    const nextStatus = body.status ? normalizeStatus(body.status) : normalizeStatus(existing.status);
    return this.lead.update({
      where: { id },
      data: { status: nextStatus },
      select: leadSelect,
    });
  }

  async convert(tenant: TenantContext, actor: ActorContext, id: string) {
    const existing = await this.lead.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, ownerUserId: true, status: true, notes: true },
    });
    if (!existing) throw new NotFoundException();
    if (!this.canAccessLead(actor, existing)) throw new ForbiddenException('FORBIDDEN');

    if (normalizeStatus(existing.status) === 'CONVERTED') {
      return this.lead.findUnique({ where: { id }, select: leadSelect });
    }

    const autoNote = '[AUTO] lead converted';
    const nextNotes = existing.notes ? `${existing.notes}\n${autoNote}` : autoNote;

    return this.lead.update({
      where: { id },
      data: { status: 'CONVERTED', notes: nextNotes },
      select: leadSelect,
    });
  }

  async remove(tenant: TenantContext, actor: ActorContext, id: string) {
    const existing = await this.lead.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, ownerUserId: true },
    });
    if (!existing) throw new NotFoundException();
    if (!this.canAccessLead(actor, existing)) throw new ForbiddenException('FORBIDDEN');
    await this.lead.delete({ where: { id } });
    return { ok: true };
  }
}
