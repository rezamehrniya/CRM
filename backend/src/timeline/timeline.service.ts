import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hasPermission } from '../auth/permissions.utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

type ActorContext = {
  userId: string;
  role: string;
  permissions?: string[];
};

type LeadTimelineQuery = {
  from?: string;
  to?: string;
  type?: string;
  limit?: string;
  cursor?: string;
};

type TimelineItemType =
  | 'TASK'
  | 'CALL'
  | 'SMS'
  | 'QUOTE'
  | 'NOTE'
  | 'STAGE'
  | 'ASSIGN'
  | 'LEAD_FOLLOWUP';

type TimelineItem = {
  id: string;
  type: TimelineItemType;
  ts: string;
  title: string;
  subtitle: string;
  status: string | null;
  preview: string | null;
  ref: Record<string, string>;
  meta: Record<string, unknown>;
};

type CursorPayload = {
  ts: string;
  id: string;
};

const DONE_TASK_STATUSES = new Set(['done', 'DONE']);
const WAITING_RESPONSE_DAYS = 2;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const ALL_TYPES: TimelineItemType[] = [
  'TASK',
  'CALL',
  'SMS',
  'QUOTE',
  'NOTE',
  'STAGE',
  'ASSIGN',
  'LEAD_FOLLOWUP',
];

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u200c/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizePhoneDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

function safeDate(value: string | undefined, endOfDay: boolean): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const source = raw.length === 10 ? `${raw}T00:00:00.000Z` : raw;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return null;
  if (!endOfDay || raw.length !== 10) return parsed;
  parsed.setUTCHours(23, 59, 59, 999);
  return parsed;
}

function clampLimit(raw: string | undefined): number {
  const parsed = Number(raw ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function parseTypes(raw: string | undefined): Set<TimelineItemType> {
  const allowed = new Set<TimelineItemType>(ALL_TYPES);
  const tokens = String(raw ?? '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (tokens.length === 0) return allowed;
  const result = new Set<TimelineItemType>();
  for (const token of tokens) {
    if (allowed.has(token as TimelineItemType)) {
      result.add(token as TimelineItemType);
    }
  }
  return result.size > 0 ? result : allowed;
}

function truncateText(value: string | null | undefined, max = 240): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function daysDiffFrom(now: Date, value: Date): number {
  return Math.max(0, Math.ceil((now.getTime() - value.getTime()) / (24 * 60 * 60 * 1000)));
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function decodeCursor(raw: string | undefined): CursorPayload | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<CursorPayload>;
    if (!parsed.ts || !parsed.id) return null;
    if (Number.isNaN(new Date(parsed.ts).getTime())) return null;
    return { ts: parsed.ts, id: parsed.id };
  } catch {
    return null;
  }
}

function itemSortDesc(a: TimelineItem, b: TimelineItem): number {
  const diff = new Date(b.ts).getTime() - new Date(a.ts).getTime();
  if (diff !== 0) return diff;
  return b.id.localeCompare(a.id);
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSignedStage(stageName: string | null | undefined): boolean {
  const normalized = normalizeText(stageName);
  return (
    normalized.includes('signed') ||
    normalized.includes('won') ||
    normalized.includes('قرارداد') ||
    normalized.includes('امضا') ||
    normalized.includes('بسته')
  );
}

function isCanceledStage(stageName: string | null | undefined): boolean {
  const normalized = normalizeText(stageName);
  return (
    normalized.includes('lost') ||
    normalized.includes('cancel') ||
    normalized.includes('reject') ||
    normalized.includes('لغو') ||
    normalized.includes('از دست')
  );
}

function isNegotiationStage(stageName: string | null | undefined): boolean {
  const normalized = normalizeText(stageName);
  return normalized.includes('negotiation') || normalized.includes('مذاکر');
}

function isQuoteSentStage(stageName: string | null | undefined): boolean {
  const normalized = normalizeText(stageName);
  return (
    normalized.includes('quote') ||
    normalized.includes('proforma') ||
    normalized.includes('پیش') ||
    normalized.includes('ارسال')
  );
}

function userLabel(user?: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
} | null): string {
  if (!user) return 'Unknown';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.email?.trim()) return user.email.trim();
  if (user.phone?.trim()) return user.phone.trim();
  return 'Unknown';
}

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  private isMissingTableError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021'
    );
  }

  private async safeQuery<T>(run: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (this.isMissingTableError(error)) return fallback;
      throw error;
    }
  }

  private canManageLead(actor: ActorContext): boolean {
    return hasPermission(actor, 'leads.manage');
  }

  private canAccessLead(actor: ActorContext, ownerUserId: string | null): boolean {
    if (this.canManageLead(actor)) return true;
    if (!ownerUserId) return true;
    return ownerUserId === actor.userId;
  }

  private async userNameMap(tenantId: string, userIds: string[]) {
    if (userIds.length === 0) return new Map<string, string>();
    const rows = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
      },
    });
    return new Map(rows.map((row) => [row.id, userLabel(row)] as const));
  }

  async getLeadTimeline(
    tenant: TenantContext,
    actor: ActorContext,
    leadId: string,
    query: LeadTimelineQuery,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { tenantId: tenant.id, id: leadId },
      select: {
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
      },
    });

    if (!lead) throw new NotFoundException('LEAD_NOT_FOUND');
    if (!this.canAccessLead(actor, lead.ownerUserId)) throw new NotFoundException('LEAD_NOT_FOUND');

    const hasTeamQuoteAccess = this.canManageLead(actor);
    const hasTeamTaskAccess = this.canManageLead(actor);
    const hasTeamCallAccess = hasPermission(actor, 'calls.team.read') || hasPermission(actor, 'calls.manage');
    const hasTeamSmsAccess = hasPermission(actor, 'sms.team.read') || hasPermission(actor, 'sms.manage');

    const leadFullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim();
    const leadPhoneDigits = normalizePhoneDigits(lead.phone);
    const leadPhoneTail = leadPhoneDigits.length > 10 ? leadPhoneDigits.slice(-10) : leadPhoneDigits;
    const companyNeedle = String(lead.companyName ?? '').trim();

    const [matchedCompanies, matchedContacts] = await Promise.all([
      companyNeedle
        ? this.prisma.company.findMany({
            where: { tenantId: tenant.id, name: { contains: companyNeedle, mode: 'insensitive' } },
            select: { id: true, name: true },
            take: 30,
          })
        : Promise.resolve([] as Array<{ id: string; name: string }>),
      this.safeQuery(
        async () => {
          const or: Prisma.ContactWhereInput[] = [];
          if (lead.phone) or.push({ phone: lead.phone });
          if (lead.email) or.push({ email: lead.email });
          if (companyNeedle) {
            or.push({ company: { name: { contains: companyNeedle, mode: 'insensitive' } } });
          }
          if (lead.firstName && lead.lastName) {
            or.push({
              AND: [
                { firstName: { contains: lead.firstName, mode: 'insensitive' } },
                { lastName: { contains: lead.lastName, mode: 'insensitive' } },
              ],
            });
          }
          if (or.length === 0) return [] as Array<{ id: string; companyId: string | null }>;
          return this.prisma.contact.findMany({
            where: {
              tenantId: tenant.id,
              OR: or,
            },
            select: {
              id: true,
              companyId: true,
            },
            take: 60,
          });
        },
        [] as Array<{ id: string; companyId: string | null }>,
      ),
    ]);

    const contactIds = matchedContacts.map((row) => row.id);
    const companyIds = Array.from(
      new Set([
        ...matchedCompanies.map((row) => row.id),
        ...matchedContacts.map((row) => row.companyId).filter((value): value is string => Boolean(value)),
      ]),
    );

    const deals = await this.safeQuery(
      async () => {
        const or: Prisma.DealWhereInput[] = [];
        if (contactIds.length > 0) or.push({ contactId: { in: contactIds } });
        if (companyIds.length > 0) or.push({ companyId: { in: companyIds } });
        if (companyNeedle) or.push({ company: { name: { contains: companyNeedle, mode: 'insensitive' } } });
        if (leadFullName) or.push({ title: { contains: leadFullName, mode: 'insensitive' } });
        if (or.length === 0 && lead.ownerUserId) {
          or.push({ ownerUserId: lead.ownerUserId });
        }
        if (or.length === 0) {
          return [] as Array<{
            id: string;
            title: string;
            amount: unknown;
            sentAt: Date | null;
            expectedCloseDate: Date | null;
            ownerUserId: string | null;
            stage: { name: string } | null;
            company: { name: string } | null;
          }>;
        }
        return this.prisma.deal.findMany({
          where: {
            tenantId: tenant.id,
            OR: or,
            ...(hasTeamQuoteAccess ? {} : { ownerUserId: actor.userId }),
          },
          select: {
            id: true,
            title: true,
            amount: true,
            sentAt: true,
            expectedCloseDate: true,
            ownerUserId: true,
            stage: { select: { name: true } },
            company: { select: { name: true } },
          },
          orderBy: [{ expectedCloseDate: 'desc' }, { id: 'desc' }],
          take: 120,
        });
      },
      [] as Array<{
        id: string;
        title: string;
        amount: unknown;
        sentAt: Date | null;
        expectedCloseDate: Date | null;
        ownerUserId: string | null;
        stage: { name: string } | null;
        company: { name: string } | null;
      }>,
    );

    const tasks = await this.safeQuery(
      async () => {
        const or: Prisma.TaskWhereInput[] = [];
        const dealIds = deals.map((row) => row.id);
        if (contactIds.length > 0) or.push({ contactId: { in: contactIds } });
        if (companyIds.length > 0) or.push({ companyId: { in: companyIds } });
        if (dealIds.length > 0) or.push({ dealId: { in: dealIds } });
        if (leadFullName) {
          or.push({ title: { contains: leadFullName, mode: 'insensitive' } });
          or.push({ description: { contains: leadFullName, mode: 'insensitive' } });
        }
        if (companyNeedle) {
          or.push({ title: { contains: companyNeedle, mode: 'insensitive' } });
          or.push({ description: { contains: companyNeedle, mode: 'insensitive' } });
        }
        if (or.length === 0 && lead.ownerUserId) {
          or.push({ assignedToUserId: lead.ownerUserId });
        }
        if (or.length === 0) {
          return [] as Array<{
            id: string;
            title: string;
            description: string | null;
            status: string;
            dueAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            assignedToUserId: string | null;
            createdByUserId: string | null;
            assignee: {
              firstName: string | null;
              lastName: string | null;
              displayName: string | null;
              email: string | null;
              phone: string | null;
            } | null;
            createdBy: {
              firstName: string | null;
              lastName: string | null;
              displayName: string | null;
              email: string | null;
              phone: string | null;
            } | null;
          }>;
        }

        const whereParts: Prisma.TaskWhereInput[] = [{ tenantId: tenant.id }, { OR: or }];
        if (!hasTeamTaskAccess) {
          whereParts.push({ OR: [{ assignedToUserId: actor.userId }, { createdByUserId: actor.userId }] });
        }

        return this.prisma.task.findMany({
          where: { AND: whereParts },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            dueAt: true,
            createdAt: true,
            updatedAt: true,
            assignedToUserId: true,
            createdByUserId: true,
            assignee: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true,
              },
            },
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: 160,
        });
      },
      [] as Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        dueAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        assignedToUserId: string | null;
        createdByUserId: string | null;
        assignee: {
          firstName: string | null;
          lastName: string | null;
          displayName: string | null;
          email: string | null;
          phone: string | null;
        } | null;
        createdBy: {
          firstName: string | null;
          lastName: string | null;
          displayName: string | null;
          email: string | null;
          phone: string | null;
        } | null;
      }>,
    );

    const activities = await this.safeQuery(
      async () => {
        const dealIds = deals.map((row) => row.id);
        const or: Prisma.ActivityWhereInput[] = [];
        if (contactIds.length > 0) or.push({ contactId: { in: contactIds } });
        if (dealIds.length > 0) or.push({ dealId: { in: dealIds } });
        if (leadFullName) or.push({ body: { contains: leadFullName, mode: 'insensitive' } });
        if (companyNeedle) or.push({ body: { contains: companyNeedle, mode: 'insensitive' } });
        if (or.length === 0) {
          return [] as Array<{
            id: string;
            type: string;
            body: string | null;
            happenedAt: Date;
            createdByUserId: string | null;
            contactId: string | null;
            dealId: string | null;
          }>;
        }
        return this.prisma.activity.findMany({
          where: {
            tenantId: tenant.id,
            OR: or,
          },
          select: {
            id: true,
            type: true,
            body: true,
            happenedAt: true,
            createdByUserId: true,
            contactId: true,
            dealId: true,
          },
          orderBy: [{ happenedAt: 'desc' }, { id: 'desc' }],
          take: 200,
        });
      },
      [] as Array<{
        id: string;
        type: string;
        body: string | null;
        happenedAt: Date;
        createdByUserId: string | null;
        contactId: string | null;
        dealId: string | null;
      }>,
    );

    const calls = await this.safeQuery(
      async () => {
        if (!leadPhoneTail) {
          return [] as Array<{
            id: string;
            direction: string;
            status: string;
            fromNumber: string;
            toNumber: string;
            startedAt: Date;
            endedAt: Date | null;
            durationSec: number | null;
            recordingUrl: string | null;
            agentUserId: string;
            agent: {
              firstName: string | null;
              lastName: string | null;
              displayName: string | null;
              email: string | null;
              phone: string | null;
            };
          }>;
        }
        return this.prisma.callLog.findMany({
          where: {
            tenantId: tenant.id,
            OR: [{ fromNumber: { contains: leadPhoneTail } }, { toNumber: { contains: leadPhoneTail } }],
            ...(hasTeamCallAccess ? {} : { agentUserId: actor.userId }),
          },
          select: {
            id: true,
            direction: true,
            status: true,
            fromNumber: true,
            toNumber: true,
            startedAt: true,
            endedAt: true,
            durationSec: true,
            recordingUrl: true,
            agentUserId: true,
            agent: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          take: 120,
        });
      },
      [] as Array<{
        id: string;
        direction: string;
        status: string;
        fromNumber: string;
        toNumber: string;
        startedAt: Date;
        endedAt: Date | null;
        durationSec: number | null;
        recordingUrl: string | null;
        agentUserId: string;
        agent: {
          firstName: string | null;
          lastName: string | null;
          displayName: string | null;
          email: string | null;
          phone: string | null;
        };
      }>,
    );

    const smsLogs = await this.safeQuery(
      async () => {
        if (!leadPhoneTail) {
          return [] as Array<{
            id: string;
            status: string;
            recipientPhone: string;
            recipientName: string | null;
            body: string;
            senderLine: string;
            queuedAt: Date;
            sentAt: Date | null;
            deliveredAt: Date | null;
            failedAt: Date | null;
            createdByUserId: string;
            createdBy: {
              firstName: string | null;
              lastName: string | null;
              displayName: string | null;
              email: string | null;
              phone: string | null;
            };
          }>;
        }
        return this.prisma.smsLog.findMany({
          where: {
            tenantId: tenant.id,
            recipientPhone: { contains: leadPhoneTail },
            ...(hasTeamSmsAccess ? {} : { createdByUserId: actor.userId }),
          },
          select: {
            id: true,
            status: true,
            recipientPhone: true,
            recipientName: true,
            body: true,
            senderLine: true,
            queuedAt: true,
            sentAt: true,
            deliveredAt: true,
            failedAt: true,
            createdByUserId: true,
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: [{ queuedAt: 'desc' }, { id: 'desc' }],
          take: 120,
        });
      },
      [] as Array<{
        id: string;
        status: string;
        recipientPhone: string;
        recipientName: string | null;
        body: string;
        senderLine: string;
        queuedAt: Date;
        sentAt: Date | null;
        deliveredAt: Date | null;
        failedAt: Date | null;
        createdByUserId: string;
        createdBy: {
          firstName: string | null;
          lastName: string | null;
          displayName: string | null;
          email: string | null;
          phone: string | null;
        };
      }>,
    );

    const userIds = Array.from(
      new Set(
        [
          lead.ownerUserId,
          ...deals.map((row) => row.ownerUserId),
          ...tasks.map((row) => row.assignedToUserId),
          ...tasks.map((row) => row.createdByUserId),
          ...activities.map((row) => row.createdByUserId),
          ...calls.map((row) => row.agentUserId),
          ...smsLogs.map((row) => row.createdByUserId),
        ].filter((value): value is string => Boolean(value)),
      ),
    );
    const userMap = await this.userNameMap(tenant.id, userIds);

    const items: TimelineItem[] = [];
    const now = new Date();
    const waitingThreshold = new Date(now.getTime() - WAITING_RESPONSE_DAYS * 24 * 60 * 60 * 1000);

    items.push({
      id: `lead:${lead.id}:created`,
      type: 'STAGE',
      ts: lead.createdAt.toISOString(),
      title: 'Lead created',
      subtitle: lead.status ? `Initial status: ${lead.status}` : 'Lead initialized',
      status: lead.status ?? null,
      preview: truncateText(lead.notes),
      ref: { leadId: lead.id },
      meta: {
        source: lead.source ?? null,
      },
    });

    if (lead.ownerUserId) {
      items.push({
        id: `lead:${lead.id}:owner`,
        type: 'ASSIGN',
        ts: lead.updatedAt.toISOString(),
        title: 'Lead owner assigned',
        subtitle: userMap.get(lead.ownerUserId) ?? 'Unknown',
        status: 'ASSIGNED',
        preview: null,
        ref: { leadId: lead.id, ownerUserId: lead.ownerUserId },
        meta: {},
      });
    }

    if (lead.followUpAt) {
      const overdue = lead.followUpAt.getTime() < now.getTime();
      items.push({
        id: `lead:${lead.id}:followup`,
        type: 'LEAD_FOLLOWUP',
        ts: lead.followUpAt.toISOString(),
        title: overdue ? 'Follow-up overdue' : 'Follow-up scheduled',
        subtitle: overdue
          ? `${daysDiffFrom(now, lead.followUpAt)} day(s) overdue`
          : 'Pending follow-up',
        status: overdue ? 'OVERDUE' : 'SCHEDULED',
        preview: truncateText(lead.notes),
        ref: { leadId: lead.id },
        meta: {},
      });
    }

    for (const task of tasks) {
      const assignee = userLabel(task.assignee);
      const creator = userLabel(task.createdBy);
      const dueText = task.dueAt ? `Due: ${task.dueAt.toISOString()}` : 'No due date';
      items.push({
        id: `task:${task.id}`,
        type: 'TASK',
        ts: task.updatedAt.toISOString(),
        title: task.title,
        subtitle: `${assignee} • ${dueText}`,
        status: task.status ?? null,
        preview: truncateText(task.description) ?? `Created by ${creator}`,
        ref: { taskId: task.id },
        meta: {
          dueAt: task.dueAt?.toISOString() ?? null,
          assignedToUserId: task.assignedToUserId,
          createdByUserId: task.createdByUserId,
        },
      });
    }

    for (const activity of activities) {
      const creator =
        (activity.createdByUserId && userMap.get(activity.createdByUserId)) || 'Unknown';
      items.push({
        id: `activity:${activity.id}`,
        type: 'NOTE',
        ts: activity.happenedAt.toISOString(),
        title: `Activity: ${activity.type}`,
        subtitle: creator,
        status: activity.type ?? null,
        preview: truncateText(activity.body),
        ref: { activityId: activity.id },
        meta: {
          contactId: activity.contactId,
          dealId: activity.dealId,
        },
      });
    }

    for (const deal of deals) {
      const owner =
        (deal.ownerUserId && userMap.get(deal.ownerUserId)) || 'Unknown';
      const stageName = deal.stage?.name ?? '';
      const amount = toNumber(deal.amount);
      const companyName = deal.company?.name ?? null;
      const fallbackTs = deal.expectedCloseDate ?? deal.sentAt ?? lead.updatedAt;

      if (deal.sentAt) {
        items.push({
          id: `quote:${deal.id}:sent`,
          type: 'QUOTE',
          ts: deal.sentAt.toISOString(),
          title: 'Quote sent',
          subtitle: `${companyName ?? deal.title} • ${owner}`,
          status: 'SENT',
          preview: truncateText(deal.title),
          ref: { quoteId: deal.id },
          meta: {
            stage: stageName,
            amount,
            companyName,
          },
        });
      }

      if (isSignedStage(stageName)) {
        const signedTs = (deal.expectedCloseDate ?? deal.sentAt ?? fallbackTs).toISOString();
        items.push({
          id: `quote:${deal.id}:signed`,
          type: 'QUOTE',
          ts: signedTs,
          title: 'Contract signed',
          subtitle: `${companyName ?? deal.title} • ${owner}`,
          status: 'SIGNED_CONTRACT',
          preview: truncateText(deal.title),
          ref: { quoteId: deal.id },
          meta: {
            stage: stageName,
            amount,
            companyName,
          },
        });
      } else if (isNegotiationStage(stageName)) {
        items.push({
          id: `quote:${deal.id}:negotiation`,
          type: 'QUOTE',
          ts: fallbackTs.toISOString(),
          title: 'Quote in negotiation',
          subtitle: `${companyName ?? deal.title} • ${owner}`,
          status: 'NEGOTIATION',
          preview: truncateText(deal.title),
          ref: { quoteId: deal.id },
          meta: {
            stage: stageName,
            amount,
            companyName,
          },
        });
      } else if (!deal.sentAt && isQuoteSentStage(stageName)) {
        items.push({
          id: `quote:${deal.id}:open`,
          type: 'QUOTE',
          ts: fallbackTs.toISOString(),
          title: 'Quote draft/open',
          subtitle: `${companyName ?? deal.title} • ${owner}`,
          status: 'OPEN',
          preview: truncateText(deal.title),
          ref: { quoteId: deal.id },
          meta: {
            stage: stageName,
            amount,
            companyName,
          },
        });
      }
    }

    for (const call of calls) {
      const agent = userLabel(call.agent);
      const durationLabel =
        call.durationSec && call.durationSec > 0 ? ` • ${call.durationSec}s` : '';
      items.push({
        id: `call:${call.id}`,
        type: 'CALL',
        ts: call.startedAt.toISOString(),
        title: call.direction === 'INBOUND' ? 'Inbound call' : 'Outbound call',
        subtitle: `${agent} • ${call.status}${durationLabel}`,
        status: call.status,
        preview: `${call.fromNumber} -> ${call.toNumber}`,
        ref: { callId: call.id },
        meta: {
          direction: call.direction,
          durationSec: call.durationSec,
          recordingUrl: call.recordingUrl,
          endedAt: call.endedAt?.toISOString() ?? null,
        },
      });
    }

    for (const sms of smsLogs) {
      const sender = userLabel(sms.createdBy);
      const eventTs = sms.deliveredAt ?? sms.failedAt ?? sms.sentAt ?? sms.queuedAt;
      items.push({
        id: `sms:${sms.id}`,
        type: 'SMS',
        ts: eventTs.toISOString(),
        title: `SMS ${sms.status.toLowerCase()}`,
        subtitle: `${sender} • ${sms.recipientPhone}`,
        status: sms.status,
        preview: truncateText(sms.body),
        ref: { smsId: sms.id },
        meta: {
          senderLine: sms.senderLine,
          recipientName: sms.recipientName,
          queuedAt: sms.queuedAt.toISOString(),
          sentAt: sms.sentAt?.toISOString() ?? null,
          deliveredAt: sms.deliveredAt?.toISOString() ?? null,
          failedAt: sms.failedAt?.toISOString() ?? null,
        },
      });
    }

    const from = safeDate(query.from, false);
    const to = safeDate(query.to, true);
    const typeSet = parseTypes(query.type);
    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);

    const filteredByTypeAndDate = items
      .filter((item) => typeSet.has(item.type))
      .filter((item) => {
        const ts = new Date(item.ts).getTime();
        if (from && ts < from.getTime()) return false;
        if (to && ts > to.getTime()) return false;
        return true;
      })
      .sort(itemSortDesc);

    const cursorFiltered = cursor
      ? filteredByTypeAndDate.filter((item) => {
          const itemTs = new Date(item.ts).getTime();
          const cursorTs = new Date(cursor.ts).getTime();
          if (itemTs < cursorTs) return true;
          if (itemTs > cursorTs) return false;
          return item.id < cursor.id;
        })
      : filteredByTypeAndDate;

    const pagedItems = cursorFiltered.slice(0, limit);
    const nextCursor =
      cursorFiltered.length > limit
        ? encodeCursor({
            ts: pagedItems[pagedItems.length - 1].ts,
            id: pagedItems[pagedItems.length - 1].id,
          })
        : null;

    const overdueTasks = tasks.filter(
      (task) =>
        Boolean(task.dueAt) &&
        (task.dueAt as Date).getTime() < now.getTime() &&
        !DONE_TASK_STATUSES.has(task.status),
    ).length;
    const waitingQuotes = deals.filter(
      (deal) =>
        Boolean(deal.sentAt) &&
        (deal.sentAt as Date).getTime() < waitingThreshold.getTime() &&
        !isSignedStage(deal.stage?.name) &&
        !isCanceledStage(deal.stage?.name),
    ).length;
    const lastTouch = filteredByTypeAndDate[0] ?? null;

    return {
      lead: {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        fullName: leadFullName,
        phone: lead.phone,
        email: lead.email,
        companyName: lead.companyName,
        status: lead.status,
        source: lead.source,
        followUpAt: lead.followUpAt?.toISOString() ?? null,
        ownerUserId: lead.ownerUserId,
        ownerName: lead.ownerUserId ? userMap.get(lead.ownerUserId) ?? 'Unknown' : null,
        notes: lead.notes,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      },
      summary: {
        totalItems: filteredByTypeAndDate.length,
        overdueTasks,
        waitingQuotes,
        lastTouchAt: lastTouch?.ts ?? null,
        lastTouchType: lastTouch?.type ?? null,
      },
      items: pagedItems,
      nextCursor,
    };
  }
}
