import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { normalizeRoleKey } from '../auth/permissions.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ManagerOverviewResponse, ManagerTeamResponse, RepDashboardResponse } from './dto';

type DateRange = {
  from: Date;
  to: Date;
};

type ManagerOverviewArgs = {
  req: Request;
  from?: string;
  to?: string;
};

type ManagerTeamArgs = {
  req: Request;
  from?: string;
  to?: string;
  sortBy?: 'revenue' | 'conversion' | 'overdue';
};

type RepArgs = {
  req: Request;
  from?: string;
  to?: string;
};

const CANONICAL_STAGES: Array<{ stageKey: string; stageLabel: string }> = [
  { stageKey: 'COLD', stageLabel: 'Cold' },
  { stageKey: 'WARM', stageLabel: 'Warm' },
  { stageKey: 'QUALIFIED', stageLabel: 'Qualified' },
  { stageKey: 'QUOTE_SENT', stageLabel: 'Quote Sent' },
  { stageKey: 'NEGOTIATION', stageLabel: 'Negotiation' },
  { stageKey: 'SIGNED_CONTRACT', stageLabel: 'Signed Contract' },
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WAITING_RESPONSE_DAYS = 2;
const DEFAULT_PERSONAL_TARGET = 250_000_000;
const MANAGER_PERSONAL_TARGET = 400_000_000;
const ADMIN_PERSONAL_TARGET = 500_000_000;
const OPEN_LEAD_STATUSES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'new', 'contacted', 'qualified']);
const DONE_TASK_STATUSES = new Set(['DONE', 'done']);

type StageKey = 'COLD' | 'WARM' | 'QUALIFIED' | 'QUOTE_SENT' | 'NEGOTIATION' | 'SIGNED_CONTRACT';

type Snapshot = {
  deals: Array<{
    id: string;
    title: string;
    amount: unknown;
    sentAt: Date | null;
    expectedCloseDate: Date | null;
    ownerUserId: string | null;
    stage: { name: string };
    company: { name: string } | null;
  }>;
  leads: Array<{
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    followUpAt: Date | null;
    ownerUserId: string | null;
    createdAt: Date;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    dueAt: Date | null;
    assignedToUserId: string | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    happenedAt: Date;
    createdByUserId: string | null;
  }>;
  memberships: Array<{
    userId: string;
    role: string;
    user: {
      firstName: string | null;
      lastName: string | null;
      displayName: string | null;
      email: string | null;
      phone: string | null;
    };
  }>;
};

type StageAccumulator = {
  stageKey: StageKey;
  stageLabel: string;
  count: number;
  budgetSum: number;
  ageDaysSum: number;
  ageSamples: number;
};

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u200c/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function dateOnlyKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isInRange(value: Date, range: DateRange): boolean {
  return value.getTime() >= range.from.getTime() && value.getTime() <= range.to.getTime();
}

function daysDiff(value: Date, now: Date): number {
  return Math.max(0, Math.ceil((now.getTime() - value.getTime()) / ONE_DAY_MS));
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * ONE_DAY_MS);
}

function userLabel(user?: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
} | null): string {
  if (!user) return 'نامشخص';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.email?.trim()) return user.email.trim();
  if (user.phone?.trim()) return user.phone.trim();
  return 'نامشخص';
}

function mapLeadStatusToStageKey(status: string): StageKey | null {
  const normalized = normalizeText(status);
  if (normalized === 'new') return 'COLD';
  if (normalized === 'contacted') return 'WARM';
  if (normalized === 'qualified') return 'QUALIFIED';
  if (normalized === 'converted') return 'SIGNED_CONTRACT';
  return null;
}

function mapStageNameToKey(name: string | null | undefined): StageKey {
  const normalized = normalizeText(name);
  if (
    normalized.includes('signed contract') ||
    normalized.includes('signed') ||
    normalized.includes('امضا') ||
    normalized.includes('قرارداد') ||
    normalized.includes('بسته') ||
    normalized.includes('won') ||
    normalized.includes('close')
  ) {
    return 'SIGNED_CONTRACT';
  }
  if (normalized.includes('negotiation') || normalized.includes('مذاکره')) return 'NEGOTIATION';
  if (
    normalized.includes('quote sent') ||
    normalized.includes('quote') ||
    normalized.includes('proforma') ||
    normalized.includes('ارسال') ||
    normalized.includes('پیش')
  ) {
    return 'QUOTE_SENT';
  }
  if (normalized.includes('qualified') || normalized.includes('واجد')) return 'QUALIFIED';
  if (normalized.includes('warm') || normalized.includes('گرم') || normalized.includes('contacted')) return 'WARM';
  return 'COLD';
}

function isSignedKey(key: StageKey): boolean {
  return key === 'SIGNED_CONTRACT';
}

function isQuotePipelineKey(key: StageKey): boolean {
  return key === 'QUOTE_SENT' || key === 'NEGOTIATION';
}

function isCanceledStageName(name: string | null | undefined): boolean {
  const normalized = normalizeText(name);
  return (
    normalized.includes('lost') ||
    normalized.includes('cancel') ||
    normalized.includes('rejected') ||
    normalized.includes('از دست') ||
    normalized.includes('لغو')
  );
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getManagerOverview(args: ManagerOverviewArgs): Promise<ManagerOverviewResponse> {
    const range = this.resolveRange(args.from, args.to);
    const tenantId = (args.req as any)?.tenant?.id as string | undefined;
    if (!tenantId) return this.emptyManagerOverview(range);

    const snapshot = await this.loadSnapshot(tenantId);
    const now = new Date();
    const previousRange = this.previousRange(range);

    const userLabelById = new Map(snapshot.memberships.map((row) => [row.userId, userLabel(row.user)] as const));

    const stageRows = this.buildStageRows(snapshot, now, {
      dealsFilter: () => true,
      leadsFilter: () => true,
    });

    const signedDeals = snapshot.deals.filter((deal) => isSignedKey(mapStageNameToKey(deal.stage?.name)));
    const revenueCurrent = this.sumSignedRevenue(signedDeals, range);
    const revenuePrevious = this.sumSignedRevenue(signedDeals, previousRange);

    const quoteDeals = snapshot.deals.filter((deal) => isQuotePipelineKey(mapStageNameToKey(deal.stage?.name)));
    const openQuotesValue = quoteDeals.reduce((sum, deal) => sum + toNumber(deal.amount), 0);
    const openQuotesCount = quoteDeals.length;
    const sentDealsCount = snapshot.deals.filter((deal) => Boolean(deal.sentAt)).length;
    const quoteToInvoiceRatePct = sentDealsCount > 0 ? (signedDeals.length / sentDealsCount) * 100 : 0;

    const coldCount = stageRows.find((row) => row.stageKey === 'COLD')?.count ?? 0;
    const signedCount = stageRows.find((row) => row.stageKey === 'SIGNED_CONTRACT')?.count ?? 0;
    const totalConversionPct = coldCount > 0 ? (signedCount / coldCount) * 100 : 0;

    const bottleneckStage =
      stageRows
        .slice(1)
        .reduce<{ stageKey: StageKey; conversion: number } | null>((acc, row) => {
          if (!acc || row.conversionFromPrevPct < acc.conversion) {
            return { stageKey: row.stageKey as StageKey, conversion: row.conversionFromPrevPct };
          }
          return acc;
        }, null)?.stageKey ?? 'COLD';

    const activeTeamMembers = snapshot.memberships.filter((row) => {
      const role = normalizeRoleKey(row.role);
      return role === 'ADMIN' || role === 'SALES_MANAGER' || role === 'SALES_REP';
    });
    const teamTarget = activeTeamMembers.length * DEFAULT_PERSONAL_TARGET;
    const teamProgressPct = teamTarget > 0 ? (revenueCurrent / teamTarget) * 100 : 0;

    const todayStart = startOfUtcDay(now);
    const todayEnd = endOfUtcDay(now);
    const monthStart = startOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const weekStart = addUtcDays(startOfUtcDay(now), -6);
    const waitingThreshold = new Date(now.getTime() - WAITING_RESPONSE_DAYS * ONE_DAY_MS);

    const leadsToday = snapshot.leads.filter((lead) => isInRange(lead.createdAt, { from: todayStart, to: todayEnd })).length;
    const overdueFollowUps = snapshot.leads.filter(
      (lead) => Boolean(lead.followUpAt) && (lead.followUpAt as Date).getTime() < now.getTime() && OPEN_LEAD_STATUSES.has(lead.status),
    ).length;
    const quotesPendingApproval = snapshot.deals.filter(
      (deal) =>
        Boolean(deal.sentAt) &&
        (deal.sentAt as Date).getTime() < waitingThreshold.getTime() &&
        !isSignedKey(mapStageNameToKey(deal.stage?.name)) &&
        !isCanceledStageName(deal.stage?.name),
    ).length;
    const signedContractsThisMonth = signedDeals.filter((deal) => {
      const signedAt = this.resolveDealEventDate(deal) ?? now;
      return isInRange(signedAt, { from: monthStart, to: todayEnd });
    }).length;
    const avgRevenueUnitValue = signedDeals.length > 0 ? revenueCurrent / Math.max(signedDeals.length, 1) : null;

    const quoteStatusSeed: ManagerOverviewResponse['quoteStatus'] = [
      { status: 'DRAFT', count: 0, value: 0 },
      { status: 'SENT', count: 0, value: 0 },
      { status: 'APPROVED', count: 0, value: 0 },
      { status: 'CONVERTED', count: 0, value: 0 },
      { status: 'CANCELED', count: 0, value: 0 },
    ];
    const quoteStatusMap = new Map(quoteStatusSeed.map((row) => [row.status, row] as const));
    for (const deal of snapshot.deals) {
      const stageKey = mapStageNameToKey(deal.stage?.name);
      let bucket: 'DRAFT' | 'SENT' | 'APPROVED' | 'CONVERTED' | 'CANCELED' = 'DRAFT';
      if (isCanceledStageName(deal.stage?.name)) {
        bucket = 'CANCELED';
      } else if (stageKey === 'SIGNED_CONTRACT') {
        bucket = 'CONVERTED';
      } else if (stageKey === 'NEGOTIATION') {
        bucket = 'APPROVED';
      } else if (stageKey === 'QUOTE_SENT' || deal.sentAt) {
        bucket = 'SENT';
      }
      const row = quoteStatusMap.get(bucket);
      if (!row) continue;
      row.count += 1;
      row.value += toNumber(deal.amount);
    }

    const topOpportunities = snapshot.deals
      .filter((deal) => !isSignedKey(mapStageNameToKey(deal.stage?.name)) && !isCanceledStageName(deal.stage?.name))
      .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
      .slice(0, 10)
      .map((deal) => ({
        id: deal.id,
        company: deal.company?.name ?? deal.title,
        amount: toNumber(deal.amount),
        stage: deal.stage?.name ?? '',
        owner: deal.ownerUserId ? userLabelById.get(deal.ownerUserId) ?? 'نامشخص' : 'نامشخص',
      }));

    const overdueLeads = snapshot.leads
      .filter(
        (lead) =>
          Boolean(lead.followUpAt) && (lead.followUpAt as Date).getTime() < now.getTime() && OPEN_LEAD_STATUSES.has(lead.status),
      )
      .sort((a, b) => ((a.followUpAt as Date).getTime() - (b.followUpAt as Date).getTime()))
      .slice(0, 10)
      .map((lead) => ({
        id: lead.id,
        name: [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || 'بدون نام',
        overdueDays: daysDiff(lead.followUpAt as Date, now),
        owner: lead.ownerUserId ? userLabelById.get(lead.ownerUserId) ?? 'نامشخص' : 'نامشخص',
      }));

    const contractsThisWeek = signedDeals
      .map((deal) => {
        const signedAt = this.resolveDealEventDate(deal) ?? now;
        return { deal, signedAt };
      })
      .filter(({ signedAt }) => isInRange(signedAt, { from: weekStart, to: todayEnd }))
      .sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime())
      .slice(0, 10)
      .map(({ deal, signedAt }) => ({
        id: deal.id,
        company: deal.company?.name ?? deal.title,
        signedAt: signedAt.toISOString(),
        amount: toNumber(deal.amount),
      }));

    const signedTimeline = signedDeals
      .map((deal) => {
        const signedAt = this.resolveDealEventDate(deal);
        return signedAt ? { deal, signedAt } : null;
      })
      .filter(
        (
          row,
        ): row is {
          deal: (typeof signedDeals)[number];
          signedAt: Date;
        } => Boolean(row),
      )
      .sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());

    const signedThisMonth = signedTimeline.filter(({ signedAt }) =>
      isInRange(signedAt, { from: monthStart, to: todayEnd }),
    );
    const signedAmountThisMonth = signedThisMonth.reduce(
      (sum, { deal }) => sum + toNumber(deal.amount),
      0,
    );
    const avgSignedAmountThisMonth =
      signedThisMonth.length > 0 ? signedAmountThisMonth / signedThisMonth.length : 0;

    const signedWithSentAt = signedThisMonth.filter(({ deal }) => Boolean(deal.sentAt));
    const avgDaysFromQuoteSent =
      signedWithSentAt.length > 0
        ? signedWithSentAt.reduce((sum, { deal, signedAt }) => {
            const sentAt = deal.sentAt as Date;
            const diffDays = Math.max(
              0,
              (signedAt.getTime() - sentAt.getTime()) / ONE_DAY_MS,
            );
            return sum + diffDays;
          }, 0) / signedWithSentAt.length
        : null;

    const latestSigned = signedTimeline.slice(0, 10).map(({ deal, signedAt }) => ({
      id: deal.id,
      company: deal.company?.name ?? deal.title,
      signedAt: signedAt.toISOString(),
      amount: toNumber(deal.amount),
      owner: deal.ownerUserId ? userLabelById.get(deal.ownerUserId) ?? 'نامشخص' : 'نامشخص',
    }));

    const smsMembers =
      activeTeamMembers.filter((member) => normalizeRoleKey(member.role) === 'SALES_REP') || [];
    const smsUsers = (smsMembers.length > 0 ? smsMembers : activeTeamMembers).map((member) => member.userId);
    const smsRowsToday = await this.safeFindSmsRowsForUsersInRange(
      tenantId,
      smsUsers,
      todayStart,
      todayEnd,
    );

    const perUserSms = new Map<string, { sentToday: number; deliveredToday: number; failedToday: number }>();
    for (const userId of smsUsers) {
      perUserSms.set(userId, { sentToday: 0, deliveredToday: 0, failedToday: 0 });
    }
    for (const sms of smsRowsToday) {
      const bucket = perUserSms.get(sms.createdByUserId) ?? { sentToday: 0, deliveredToday: 0, failedToday: 0 };
      bucket.sentToday += 1;
      if (sms.status === 'DELIVERED') bucket.deliveredToday += 1;
      if (sms.status === 'FAILED') bucket.failedToday += 1;
      perUserSms.set(sms.createdByUserId, bucket);
    }

    const smsRepRows = Array.from(perUserSms.entries())
      .map(([userId, stats]) => ({
        userId,
        name: userLabelById.get(userId) ?? 'نامشخص',
        ...stats,
      }))
      .sort((a, b) => b.sentToday - a.sentToday);

    const sentToday = smsRowsToday.length;
    const deliveredToday = smsRowsToday.filter((row) => row.status === 'DELIVERED').length;
    const failedToday = smsRowsToday.filter((row) => row.status === 'FAILED').length;
    const smsFinalCount = deliveredToday + failedToday;
    const smsDeliveryRatePct = smsFinalCount > 0 ? (deliveredToday / smsFinalCount) * 100 : 0;

    return {
      hero: {
        revenue: {
          mode: 'PROXY_QUOTE_SIGNED',
          current: revenueCurrent,
          previous: revenuePrevious,
          deltaPct: this.computeDeltaPct(revenueCurrent, revenuePrevious),
          sparkline: this.buildSparkline(range, signedDeals),
        },
        pipeline: {
          openQuotesValue,
          openQuotesCount,
          quoteToInvoiceRatePct,
        },
        funnel: {
          totalConversionPct,
          bottleneckStage,
        },
        teamTarget: {
          target: teamTarget,
          achieved: revenueCurrent,
          progressPct: teamProgressPct,
        },
      },
      kpis: {
        leadsToday,
        overdueFollowUps,
        avgResponseHours: null,
        quotesPendingApproval,
        signedContractsThisMonth,
        avgRevenueUnitValue,
        avgRevenueUnitLabel: avgRevenueUnitValue !== null ? 'avgSignedQuote' : null,
      },
      funnelStages: stageRows,
      revenueTrend: this.buildRevenueTrend(range, signedDeals, teamTarget),
      quoteStatus: quoteStatusSeed,
      actionCenter: {
        topOpportunities,
        overdueLeads,
        contractsThisWeek,
      },
      quoteContract: {
        thisMonth: {
          count: signedThisMonth.length,
          amountSum: signedAmountThisMonth,
          avgAmount: avgSignedAmountThisMonth,
          avgDaysFromQuoteSent,
        },
        latestSigned,
      },
      smsToday: {
        sentToday,
        deliveredToday,
        failedToday,
        deliveryRatePct: smsDeliveryRatePct,
        reps: smsRepRows,
      },
    };
  }

  async getManagerTeam(args: ManagerTeamArgs): Promise<ManagerTeamResponse> {
    const range = this.resolveRange(args.from, args.to);
    const sortBy = args.sortBy ?? 'revenue';
    const tenantId = (args.req as any)?.tenant?.id as string | undefined;
    if (!tenantId) return { rows: [] };

    const snapshot = await this.loadSnapshot(tenantId);
    const now = new Date();

    const rows: ManagerTeamResponse['rows'] = snapshot.memberships
      .filter((membership) => {
        const role = normalizeRoleKey(membership.role);
        return role === 'ADMIN' || role === 'SALES_MANAGER' || role === 'SALES_REP';
      })
      .map((membership) => {
        const role = normalizeRoleKey(membership.role);
        const personalTarget =
          role === 'ADMIN'
            ? ADMIN_PERSONAL_TARGET
            : role === 'SALES_MANAGER'
              ? MANAGER_PERSONAL_TARGET
              : DEFAULT_PERSONAL_TARGET;

        const ownedDeals = snapshot.deals.filter((deal) => deal.ownerUserId === membership.userId);
        const signedDeals = ownedDeals.filter((deal) => {
          if (!isSignedKey(mapStageNameToKey(deal.stage?.name))) return false;
          const signedAt = this.resolveDealEventDate(deal);
          return signedAt ? isInRange(signedAt, range) : true;
        });
        const quoteDeals = ownedDeals.filter((deal) => isQuotePipelineKey(mapStageNameToKey(deal.stage?.name)));

        const sentCount = ownedDeals.filter((deal) => Boolean(deal.sentAt)).length;
        const conversionRatePct = sentCount > 0 ? (signedDeals.length / sentCount) * 100 : 0;

        const overdueTasks = snapshot.tasks.filter(
          (task) =>
            task.assignedToUserId === membership.userId &&
            Boolean(task.dueAt) &&
            (task.dueAt as Date).getTime() < now.getTime() &&
            !DONE_TASK_STATUSES.has(task.status),
        ).length;
        const overdueLeads = snapshot.leads.filter(
          (lead) =>
            lead.ownerUserId === membership.userId &&
            Boolean(lead.followUpAt) &&
            (lead.followUpAt as Date).getTime() < now.getTime() &&
            OPEN_LEAD_STATUSES.has(lead.status),
        ).length;
        const revenue = signedDeals.reduce((sum, deal) => sum + toNumber(deal.amount), 0);
        const quotesValue = quoteDeals.reduce((sum, deal) => sum + toNumber(deal.amount), 0);
        const progressPct = personalTarget > 0 ? (revenue / personalTarget) * 100 : 0;

        return {
          userId: membership.userId,
          name: userLabel(membership.user),
          revenue,
          quotesValue,
          conversionRatePct,
          overdueCount: overdueTasks + overdueLeads,
          personalTarget,
          progressPct,
        };
      });

    this.sortTeamRows(rows, sortBy);

    return { rows };
  }

  async getRepDashboard(args: RepArgs): Promise<RepDashboardResponse> {
    const range = this.resolveRange(args.from, args.to);
    const tenantId = (args.req as any)?.tenant?.id as string | undefined;
    const actorId = (args.req as any)?.user?.userId as string | undefined;
    const actorRole = normalizeRoleKey((args.req as any)?.user?.role as string | null);

    if (!tenantId || !actorId) return this.emptyRepDashboard();

    const snapshot = await this.loadSnapshot(tenantId);
    const now = new Date();
    const todayRange = { from: startOfUtcDay(now), to: endOfUtcDay(now) };
    const waitingThreshold = new Date(now.getTime() - WAITING_RESPONSE_DAYS * ONE_DAY_MS);

    const myDeals = snapshot.deals.filter((deal) => deal.ownerUserId === actorId);
    const myLeads = snapshot.leads.filter((lead) => lead.ownerUserId === actorId);
    const myTasks = snapshot.tasks.filter((task) => task.assignedToUserId === actorId);

    const tasksToday = myTasks.filter(
      (task) =>
        Boolean(task.dueAt) &&
        isInRange(task.dueAt as Date, todayRange) &&
        !DONE_TASK_STATUSES.has(task.status),
    ).length;
    const overdueTasks = myTasks.filter(
      (task) =>
        Boolean(task.dueAt) && (task.dueAt as Date).getTime() < now.getTime() && !DONE_TASK_STATUSES.has(task.status),
    );
    const overdueLeads = myLeads.filter(
      (lead) =>
        Boolean(lead.followUpAt) &&
        (lead.followUpAt as Date).getTime() < now.getTime() &&
        OPEN_LEAD_STATUSES.has(lead.status),
    );
    const callsToday = await this.safeCountCallLogs({
      tenantId,
      agentUserId: actorId,
      startedAt: { gte: todayRange.from, lte: todayRange.to },
    });
    const waitingDeals = myDeals.filter(
      (deal) =>
        Boolean(deal.sentAt) &&
        (deal.sentAt as Date).getTime() < waitingThreshold.getTime() &&
        !isSignedKey(mapStageNameToKey(deal.stage?.name)) &&
        !isCanceledStageName(deal.stage?.name),
    );
    const smsRowsToday = await this.safeGroupSmsByStatus({
      tenantId,
      createdByUserId: actorId,
      queuedAt: { gte: todayRange.from, lte: todayRange.to },
    });
    const smsCounts = new Map(smsRowsToday.map((row) => [row.status, row._count._all] as const));
    const sentSmsToday = smsRowsToday.reduce((sum, row) => sum + row._count._all, 0);
    const deliveredSmsToday = smsCounts.get('DELIVERED') ?? 0;
    const failedSmsToday = smsCounts.get('FAILED') ?? 0;
    const smsFinalCount = deliveredSmsToday + failedSmsToday;
    const smsDeliveryRatePct = smsFinalCount > 0 ? (deliveredSmsToday / smsFinalCount) * 100 : 0;

    const myStageRows = this.buildStageRows(snapshot, now, {
      dealsFilter: (deal) => deal.ownerUserId === actorId,
      leadsFilter: (lead) => lead.ownerUserId === actorId,
    });

    const myTarget =
      actorRole === 'ADMIN'
        ? ADMIN_PERSONAL_TARGET
        : actorRole === 'SALES_MANAGER'
          ? MANAGER_PERSONAL_TARGET
          : DEFAULT_PERSONAL_TARGET;
    const achieved = myDeals
      .filter((deal) => {
        if (!isSignedKey(mapStageNameToKey(deal.stage?.name))) return false;
        const signedAt = this.resolveDealEventDate(deal);
        return signedAt ? isInRange(signedAt, range) : true;
      })
      .reduce((sum, deal) => sum + toNumber(deal.amount), 0);
    const remaining = Math.max(0, myTarget - achieved);
    const progressPct = myTarget > 0 ? (achieved / myTarget) * 100 : 0;
    const pace: 'AHEAD' | 'ON_TRACK' | 'BEHIND' = progressPct >= 100 ? 'AHEAD' : progressPct >= 70 ? 'ON_TRACK' : 'BEHIND';

    return {
      today: {
        tasksToday,
        overdue: overdueTasks.length + overdueLeads.length,
        callsToday,
        pendingQuotes: waitingDeals.length,
      },
      smsToday: {
        sentToday: sentSmsToday,
        deliveredToday: deliveredSmsToday,
        failedToday: failedSmsToday,
        deliveryRatePct: smsDeliveryRatePct,
      },
      myFunnel: myStageRows.map((stage) => ({
        stageKey: stage.stageKey,
        stageLabel: stage.stageLabel,
        count: stage.count,
      })),
      myTarget: {
        target: myTarget,
        achieved,
        remaining,
        pace,
      },
      reminders: {
        urgentFollowUps: [
          ...overdueLeads.map((lead) => ({
            type: 'LEAD' as const,
            id: lead.id,
            title: [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || 'بدون نام',
            dueAt: (lead.followUpAt as Date).toISOString(),
            overdueDays: daysDiff(lead.followUpAt as Date, now),
          })),
          ...overdueTasks.map((task) => ({
            type: 'TASK' as const,
            id: task.id,
            title: task.title,
            dueAt: (task.dueAt as Date).toISOString(),
            overdueDays: daysDiff(task.dueAt as Date, now),
          })),
        ]
          .sort((a, b) => b.overdueDays - a.overdueDays)
          .slice(0, 12),
        waitingResponse: waitingDeals
          .map((deal) => ({
            id: deal.id,
            title: deal.title,
            sinceDays: daysDiff(deal.sentAt as Date, now),
          }))
          .sort((a, b) => b.sinceDays - a.sinceDays)
          .slice(0, 12),
      },
    };
  }

  private resolveRange(from?: string, to?: string): DateRange {
    const now = new Date();
    const parsedFrom = this.parseDate(from);
    const parsedTo = this.parseDate(to);
    const start = parsedFrom ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = parsedTo ? endOfUtcDay(parsedTo) : now;
    if (start.getTime() <= end.getTime()) {
      return { from: start, to: end };
    }
    return { from: end, to: start };
  }

  private parseDate(value?: string): Date | null {
    if (!value || !value.trim()) return null;
    const raw = value.trim();
    const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  private computeDeltaPct(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  private buildSparkline(
    range: DateRange,
    signedDeals: Array<{
      amount: unknown;
      sentAt: Date | null;
      expectedCloseDate: Date | null;
    }>,
  ) {
    const pointsCount = 12;
    const windowMs = Math.max(range.to.getTime() - range.from.getTime(), ONE_DAY_MS);
    const stepMs = windowMs / Math.max(pointsCount - 1, 1);
    const points = Array.from({ length: pointsCount }).map((_, idx) => ({
      x: new Date(range.from.getTime() + idx * stepMs).toISOString().slice(0, 10),
      y: 0,
    }));

    for (const deal of signedDeals) {
      const eventDate = this.resolveDealEventDate(deal) ?? range.to;
      if (!isInRange(eventDate, range)) continue;
      const idx = Math.min(pointsCount - 1, Math.max(0, Math.floor((eventDate.getTime() - range.from.getTime()) / stepMs)));
      points[idx].y += toNumber(deal.amount);
    }
    return points;
  }

  private buildRevenueTrend(
    range: DateRange,
    signedDeals: Array<{
      amount: unknown;
      sentAt: Date | null;
      expectedCloseDate: Date | null;
    }>,
    teamTarget: number,
  ) {
    const days = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / ONE_DAY_MS) + 1);
    const dailyTarget = teamTarget > 0 ? teamTarget / days : 0;
    const buckets = Array.from({ length: days }).map((_, idx) => {
      const bucketDate = new Date(range.from.getTime() + idx * ONE_DAY_MS);
      return {
        bucket: bucketDate.toISOString().slice(0, 10),
        actual: 0,
        target: dailyTarget,
      };
    });
    const bucketMap = new Map(buckets.map((item) => [item.bucket, item] as const));
    for (const deal of signedDeals) {
      const eventDate = this.resolveDealEventDate(deal) ?? range.to;
      if (!isInRange(eventDate, range)) continue;
      const key = dateOnlyKey(eventDate);
      const bucket = bucketMap.get(key);
      if (!bucket) continue;
      bucket.actual += toNumber(deal.amount);
    }
    return buckets;
  }

  private sortTeamRows(rows: ManagerTeamResponse['rows'], sortBy: NonNullable<ManagerTeamArgs['sortBy']>) {
    if (sortBy === 'conversion') {
      rows.sort((a, b) => b.conversionRatePct - a.conversionRatePct);
      return;
    }
    if (sortBy === 'overdue') {
      rows.sort((a, b) => b.overdueCount - a.overdueCount);
      return;
    }
    rows.sort((a, b) => b.revenue - a.revenue);
  }

  private async loadSnapshot(tenantId: string): Promise<Snapshot> {
    const [deals, leads, tasks, activities, memberships] = await Promise.all([
      this.prisma.deal.findMany({
        where: { tenantId },
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
      }),
      this.prisma.lead.findMany({
        where: { tenantId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          followUpAt: true,
          ownerUserId: true,
          createdAt: true,
        },
      }),
      this.prisma.task.findMany({
        where: { tenantId },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          assignedToUserId: true,
        },
      }),
      this.prisma.activity.findMany({
        where: { tenantId },
        select: {
          id: true,
          type: true,
          happenedAt: true,
          createdByUserId: true,
        },
      }),
      this.prisma.membership.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
    ]);
    return { deals, leads, tasks, activities, memberships };
  }

  private previousRange(current: DateRange): DateRange {
    const durationMs = Math.max(current.to.getTime() - current.from.getTime(), ONE_DAY_MS);
    const prevTo = new Date(current.from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - durationMs);
    return { from: prevFrom, to: prevTo };
  }

  private resolveDealEventDate(deal: { expectedCloseDate: Date | null; sentAt: Date | null }): Date | null {
    return deal.expectedCloseDate ?? deal.sentAt ?? null;
  }

  private sumSignedRevenue(
    signedDeals: Array<{
      amount: unknown;
      sentAt: Date | null;
      expectedCloseDate: Date | null;
    }>,
    range: DateRange,
  ) {
    let sum = 0;
    for (const deal of signedDeals) {
      const signedAt = this.resolveDealEventDate(deal);
      if (signedAt) {
        if (!isInRange(signedAt, range)) continue;
      } else if (range.to.getTime() < Date.now()) {
        continue;
      }
      sum += toNumber(deal.amount);
    }
    return sum;
  }

  private buildStageRows(
    snapshot: Snapshot,
    now: Date,
    filters: {
      dealsFilter: (deal: Snapshot['deals'][number]) => boolean;
      leadsFilter: (lead: Snapshot['leads'][number]) => boolean;
    },
  ): ManagerOverviewResponse['funnelStages'] {
    const acc = new Map<StageKey, StageAccumulator>(
      CANONICAL_STAGES.map((stage) => [
        stage.stageKey as StageKey,
        {
          stageKey: stage.stageKey as StageKey,
          stageLabel: stage.stageLabel,
          count: 0,
          budgetSum: 0,
          ageDaysSum: 0,
          ageSamples: 0,
        },
      ]),
    );

    for (const deal of snapshot.deals) {
      if (!filters.dealsFilter(deal)) continue;
      const key = mapStageNameToKey(deal.stage?.name);
      const row = acc.get(key);
      if (!row) continue;
      row.count += 1;
      row.budgetSum += toNumber(deal.amount);
      const ageDate = this.resolveDealEventDate(deal);
      if (ageDate) {
        row.ageDaysSum += daysDiff(ageDate, now);
        row.ageSamples += 1;
      }
    }

    for (const lead of snapshot.leads) {
      if (!filters.leadsFilter(lead)) continue;
      const key = mapLeadStatusToStageKey(lead.status);
      if (!key) continue;
      const row = acc.get(key);
      if (!row) continue;
      row.count += 1;
      row.ageDaysSum += daysDiff(lead.createdAt, now);
      row.ageSamples += 1;
    }

    const rows = CANONICAL_STAGES.map((stage) => {
      const row = acc.get(stage.stageKey as StageKey)!;
      return {
        stageKey: row.stageKey,
        stageLabel: row.stageLabel,
        count: row.count,
        budgetSum: row.budgetSum,
        conversionFromPrevPct: 0,
        avgDaysInStage: row.ageSamples > 0 ? row.ageDaysSum / row.ageSamples : 0,
      };
    });

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      rows[i].conversionFromPrevPct = prev.count > 0 ? (rows[i].count / prev.count) * 100 : 0;
    }
    return rows;
  }

  private emptyManagerOverview(range: DateRange): ManagerOverviewResponse {
    return {
      hero: {
        revenue: {
          mode: 'PROXY_QUOTE_SIGNED',
          current: 0,
          previous: 0,
          deltaPct: 0,
          sparkline: this.buildSparkline(range, []),
        },
        pipeline: {
          openQuotesValue: 0,
          openQuotesCount: 0,
          quoteToInvoiceRatePct: 0,
        },
        funnel: {
          totalConversionPct: 0,
          bottleneckStage: 'COLD',
        },
        teamTarget: {
          target: 0,
          achieved: 0,
          progressPct: 0,
        },
      },
      kpis: {
        leadsToday: 0,
        overdueFollowUps: 0,
        avgResponseHours: null,
        quotesPendingApproval: 0,
        signedContractsThisMonth: 0,
        avgRevenueUnitValue: null,
        avgRevenueUnitLabel: null,
      },
      funnelStages: CANONICAL_STAGES.map((stage) => ({
        stageKey: stage.stageKey,
        stageLabel: stage.stageLabel,
        count: 0,
        budgetSum: 0,
        conversionFromPrevPct: 0,
        avgDaysInStage: 0,
      })),
      revenueTrend: this.buildRevenueTrend(range, [], 0),
      quoteStatus: [
        { status: 'DRAFT', count: 0, value: 0 },
        { status: 'SENT', count: 0, value: 0 },
        { status: 'APPROVED', count: 0, value: 0 },
        { status: 'CONVERTED', count: 0, value: 0 },
        { status: 'CANCELED', count: 0, value: 0 },
      ],
      actionCenter: {
        topOpportunities: [],
        overdueLeads: [],
        contractsThisWeek: [],
      },
      quoteContract: {
        thisMonth: {
          count: 0,
          amountSum: 0,
          avgAmount: 0,
          avgDaysFromQuoteSent: null,
        },
        latestSigned: [],
      },
      smsToday: {
        sentToday: 0,
        deliveredToday: 0,
        failedToday: 0,
        deliveryRatePct: 0,
        reps: [],
      },
    };
  }

  private emptyRepDashboard(): RepDashboardResponse {
    return {
      today: {
        tasksToday: 0,
        overdue: 0,
        callsToday: 0,
        pendingQuotes: 0,
      },
      smsToday: {
        sentToday: 0,
        deliveredToday: 0,
        failedToday: 0,
        deliveryRatePct: 0,
      },
      myFunnel: CANONICAL_STAGES.map((stage) => ({
        stageKey: stage.stageKey,
        stageLabel: stage.stageLabel,
        count: 0,
      })),
      myTarget: {
        target: 0,
        achieved: 0,
        remaining: 0,
        pace: 'ON_TRACK',
      },
      reminders: {
        urgentFollowUps: [],
        waitingResponse: [],
      },
    };
  }

  private isMissingTableError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021'
    );
  }

  private async safeCountCallLogs(where: Prisma.CallLogWhereInput): Promise<number> {
    try {
      return await this.prisma.callLog.count({ where });
    } catch (error) {
      if (this.isMissingTableError(error)) return 0;
      throw error;
    }
  }

  private async safeFindSmsRowsForUsersInRange(
    tenantId: string,
    userIds: string[],
    from: Date,
    to: Date,
  ): Promise<Array<{ createdByUserId: string; status: string }>> {
    if (userIds.length === 0) return [];
    try {
      return await this.prisma.smsLog.findMany({
        where: {
          tenantId,
          queuedAt: { gte: from, lte: to },
          createdByUserId: { in: userIds },
        },
        select: {
          createdByUserId: true,
          status: true,
        },
      });
    } catch (error) {
      if (this.isMissingTableError(error)) return [];
      throw error;
    }
  }

  private async safeGroupSmsByStatus(
    where: Prisma.SmsLogWhereInput,
  ): Promise<Array<{ status: string; _count: { _all: number } }>> {
    try {
      const rows = await this.prisma.smsLog.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      });
      return rows.map((row) => ({
        status: row.status,
        _count: { _all: row._count._all },
      }));
    } catch (error) {
      if (this.isMissingTableError(error)) return [];
      throw error;
    }
  }
}
