import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeRoleKey } from '../auth/permissions.constants';
import { hasPermission } from '../auth/permissions.utils';
import { TenantContext } from '../tenant/tenant.middleware';

type ActorContext = {
  userId: string;
  role: string;
  permissions?: string[];
};

type ReminderScope = 'me' | 'team';

const SENT_STAGE_KEYWORDS = [
  'ارسال',
  'پیش',
  'quote',
  'proforma',
  'sent',
];

const OPEN_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'new', 'contacted', 'qualified'];
const MS_IN_DAY = 24 * 60 * 60 * 1000;

function daysFromNow(target: Date, now: Date) {
  return Math.max(0, Math.ceil((now.getTime() - target.getTime()) / MS_IN_DAY));
}

function userLabel(user?: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
} | null) {
  if (!user) return 'نامشخص';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.email?.trim()) return user.email.trim();
  if (user.phone?.trim()) return user.phone.trim();
  return 'نامشخص';
}

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveScope(requestedScope: string | undefined, actor: ActorContext): ReminderScope {
    const requested = String(requestedScope ?? '').trim().toLowerCase() === 'team' ? 'team' : 'me';
    const role = normalizeRoleKey(actor.role);
    const canTeamScope = role === 'ADMIN' || role === 'SALES_MANAGER';
    if (requested === 'team' && canTeamScope) return 'team';
    return 'me';
  }

  async summary(
    tenant: TenantContext,
    actor: ActorContext,
    requestedScope?: string,
  ) {
    const scope = this.resolveScope(requestedScope, actor);
    const now = new Date();
    const waitingResponseDays = 2;
    const waitingThreshold = new Date(now.getTime() - waitingResponseDays * MS_IN_DAY);

    let tasks: Array<{
      id: string;
      title: string;
      dueAt: string;
      overdueDays: number;
      assignedToUserId: string | null;
      assigneeName: string;
    }> = [];

    if (hasPermission(actor, 'tasks.read')) {
      const taskRows = await this.prisma.task.findMany({
        where: {
          tenantId: tenant.id,
          dueAt: { lt: now, not: null },
          NOT: [{ status: 'done' }, { status: 'DONE' }],
          ...(scope === 'me' ? { assignedToUserId: actor.userId } : {}),
        },
        select: {
          id: true,
          title: true,
          dueAt: true,
          assignedToUserId: true,
          assignee: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: 20,
      });

      tasks = taskRows
        .filter((row) => !!row.dueAt)
        .map((row) => ({
          id: row.id,
          title: row.title,
          dueAt: row.dueAt!.toISOString(),
          overdueDays: daysFromNow(row.dueAt!, now),
          assignedToUserId: row.assignedToUserId ?? null,
          assigneeName: userLabel(row.assignee),
        }));
    }

    let leads: Array<{
      id: string;
      name: string;
      followUpAt: string;
      overdueDays: number;
      ownerUserId: string | null;
      ownerName: string;
    }> = [];

    if (hasPermission(actor, 'leads.read')) {
      const leadRows = await this.prisma.lead.findMany({
        where: {
          tenantId: tenant.id,
          followUpAt: { lt: now, not: null },
          status: { in: OPEN_LEAD_STATUSES },
          ...(scope === 'me' ? { ownerUserId: actor.userId } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          followUpAt: true,
          ownerUserId: true,
        },
        orderBy: [{ followUpAt: 'asc' }, { updatedAt: 'desc' }],
        take: 20,
      });

      const ownerIds = Array.from(
        new Set(
          leadRows
            .map((row) => row.ownerUserId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const owners = ownerIds.length
        ? await this.prisma.user.findMany({
            where: { id: { in: ownerIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              phone: true,
            },
          })
        : [];
      const ownerMap = new Map(owners.map((owner) => [owner.id, owner] as const));

      leads = leadRows
        .filter((row) => !!row.followUpAt)
        .map((row) => {
          const owner = row.ownerUserId ? ownerMap.get(row.ownerUserId) : null;
          return {
            id: row.id,
            name: [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || 'بدون نام',
            followUpAt: row.followUpAt!.toISOString(),
            overdueDays: daysFromNow(row.followUpAt!, now),
            ownerUserId: row.ownerUserId ?? null,
            ownerName: userLabel(owner),
          };
        });
    }

    let quotes: Array<{
      id: string;
      title: string;
      companyName: string | null;
      sentAt: string;
      waitingDays: number;
      ownerUserId: string | null;
      ownerName: string;
    }> = [];

    if (hasPermission(actor, 'quotes.read')) {
      const quoteRows = await this.prisma.deal.findMany({
        where: {
          tenantId: tenant.id,
          sentAt: { lt: waitingThreshold, not: null },
          OR: SENT_STAGE_KEYWORDS.map((keyword) => ({
            stage: { name: { contains: keyword, mode: 'insensitive' } },
          })),
          ...(scope === 'me' ? { ownerUserId: actor.userId } : {}),
        },
        select: {
          id: true,
          title: true,
          sentAt: true,
          ownerUserId: true,
          company: { select: { name: true } },
        },
        orderBy: [{ sentAt: 'asc' }],
        take: 20,
      });

      const ownerIds = Array.from(
        new Set(
          quoteRows
            .map((row) => row.ownerUserId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const owners = ownerIds.length
        ? await this.prisma.user.findMany({
            where: { id: { in: ownerIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              phone: true,
            },
          })
        : [];
      const ownerMap = new Map(owners.map((owner) => [owner.id, owner] as const));

      quotes = quoteRows
        .filter((row) => !!row.sentAt)
        .map((row) => ({
          id: row.id,
          title: row.title,
          companyName: row.company?.name ?? null,
          sentAt: row.sentAt!.toISOString(),
          waitingDays: daysFromNow(row.sentAt!, now),
          ownerUserId: row.ownerUserId ?? null,
          ownerName: userLabel(row.ownerUserId ? ownerMap.get(row.ownerUserId) : null),
        }));
    }

    const counts = {
      overdueTasks: tasks.length,
      overdueLeads: leads.length,
      waitingQuotes: quotes.length,
      total: tasks.length + leads.length + quotes.length,
    };

    return {
      scope,
      serverNowIso: now.toISOString(),
      waitingResponseDays,
      counts,
      items: {
        tasks,
        leads,
        quotes,
      },
    };
  }
}
