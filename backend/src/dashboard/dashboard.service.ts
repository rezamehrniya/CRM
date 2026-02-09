import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';
import { Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(tenant: TenantContext, userId?: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    const [contactsCount, dealsCount, tasksDueToday, pipelineAgg, myTasksDueToday, myDealsCount] =
      await Promise.all([
        this.prisma.contact.count({ where: { tenantId: tenant.id } }),
        this.prisma.deal.count({ where: { tenantId: tenant.id } }),
        this.prisma.task.count({
          where: {
            tenantId: tenant.id,
            status: 'OPEN',
            dueAt: { gte: startOfToday, lt: endOfToday },
          },
        }),
        this.prisma.deal.aggregate({
          where: { tenantId: tenant.id },
          _sum: { amount: true },
        }),
        userId != null
          ? this.prisma.task.count({
              where: {
                tenantId: tenant.id,
                assignedToUserId: userId,
                status: 'OPEN',
                dueAt: { gte: startOfToday, lt: endOfToday },
              },
            })
          : 0,
        userId != null
          ? this.prisma.deal.count({
              where: { tenantId: tenant.id, ownerUserId: userId },
            })
          : 0,
      ]);

    const pipelineValue = pipelineAgg._sum.amount?.toString() ?? '0';
    const result: Record<string, unknown> = {
      contactsCount,
      dealsCount,
      tasksDueToday,
      pipelineValue,
    };
    if (userId != null) {
      result.myTasksDueToday = myTasksDueToday;
      result.myDealsCount = myDealsCount;
    }
    return result;
  }

  async getOwnerDashboard(tenant: TenantContext) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7)); // Monday-based
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const days30Ago = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);

    // --- KPIs ---
    const [
      newLeadsToday,
      newLeadsThisWeek,
      overdueFollowUps,
      openDealsCount,
      pipelineValueAgg,
      leadsThisMonthByStatus,
      wonDealsThisMonth,
    ] = await Promise.all([
      this.prisma.lead.count({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: startOfToday, lt: endOfToday },
        },
      }),
      this.prisma.lead.count({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: startOfWeek, lt: startOfNextMonth },
        },
      }),
      this.prisma.lead.count({
        where: {
          tenantId: tenant.id,
          followUpAt: { lt: now },
          status: { notIn: ['LOST', 'CONVERTED'] },
        },
      }),
      this.prisma.deal.count({
        where: {
          tenantId: tenant.id,
          stage: { name: { not: 'بسته شده' } },
        },
      }),
      this.prisma.deal.aggregate({
        where: {
          tenantId: tenant.id,
          stage: { name: { not: 'بسته شده' } },
        },
        _sum: { amount: true },
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: {
          tenantId: tenant.id,
          createdAt: { gte: startOfMonth, lt: startOfNextMonth },
        },
        _count: { _all: true },
      }),
      this.prisma.deal.findMany({
        where: {
          tenantId: tenant.id,
          stage: { name: 'بسته شده' },
          expectedCloseDate: { gte: startOfMonth, lt: startOfNextMonth },
        },
        select: {
          id: true,
        },
      }),
    ]);

    const pipelineValueSum = Number(pipelineValueAgg._sum.amount ?? 0);

    const wonDealsCountThisMonth = wonDealsThisMonth.length;
    const lostDealsCountThisMonth = 0; // در مدل فعلی وضعیت باخت معامله نداریم؛ بعداً می‌توان روی فیلد مجزا پیاده کرد.

    // در مدل فعلی فیلد createdAt/closedAt برای Deal نداریم؛ فعلاً مقدار میانگین را 0 برمی‌گردانیم.
    const avgDaysToClose = 0;

    // --- Charts: funnel ---
    const leadsFunnel = leadsThisMonthByStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));

    // --- Charts: pipeline by stage ---
    const openDealsWithStage = await this.prisma.deal.findMany({
      where: {
        tenantId: tenant.id,
        stage: { name: { not: 'بسته شده' } },
      },
      select: {
        amount: true,
        stage: { select: { id: true, name: true } },
      },
    });
    const pipelineByStageMap = new Map<string, { stage: string; count: number; sumAmount: number }>();
    for (const d of openDealsWithStage) {
      const key = d.stage.id;
      const existing = pipelineByStageMap.get(key) ?? {
        stage: d.stage.name,
        count: 0,
        sumAmount: 0,
      };
      existing.count += 1;
      existing.sumAmount += Number((d.amount as Prisma.Decimal | null) ?? 0);
      pipelineByStageMap.set(key, existing);
    }
    const pipelineByStage = Array.from(pipelineByStageMap.values());

    // --- Charts: trend 30d (leads, won deals, activities) ---
    const [leads30d, wonDeals30d, activities30d] = await Promise.all([
      this.prisma.lead.findMany({
        where: { tenantId: tenant.id, createdAt: { gte: days30Ago, lt: endOfToday } },
        select: { createdAt: true },
      }),
      this.prisma.deal.findMany({
        where: {
          tenantId: tenant.id,
          stage: { name: 'بسته شده' },
          expectedCloseDate: { gte: days30Ago, lt: endOfToday },
        },
        select: { expectedCloseDate: true },
      }),
      this.prisma.activity.findMany({
        where: {
          tenantId: tenant.id,
          happenedAt: { gte: days30Ago, lt: endOfToday },
        },
        select: { happenedAt: true, type: true },
      }),
    ]);

    const keyForDate = (d: Date) => d.toISOString().slice(0, 10);
    const trendMap = new Map<
      string,
      { date: string; leads: number; wonDeals: number; activities: number }
    >();
    for (let i = 0; i < 30; i++) {
      const d = new Date(days30Ago.getTime() + i * 24 * 60 * 60 * 1000);
      const key = keyForDate(d);
      trendMap.set(key, { date: key, leads: 0, wonDeals: 0, activities: 0 });
    }
    for (const l of leads30d) {
      const key = keyForDate(l.createdAt);
      const row = trendMap.get(key);
      if (row) row.leads += 1;
    }
    for (const d of wonDeals30d) {
      const key = keyForDate(d.expectedCloseDate!);
      const row = trendMap.get(key);
      if (row) row.wonDeals += 1;
    }
    for (const a of activities30d) {
      const key = keyForDate(a.happenedAt);
      const row = trendMap.get(key);
      if (row) row.activities += 1;
    }
    const trend30d = Array.from(trendMap.values());

    // --- Charts: deal aging buckets ---
    const openDealsForAging = await this.prisma.deal.findMany({
      where: { tenantId: tenant.id, stage: { name: { not: 'بسته شده' } } },
      select: { expectedCloseDate: true, amount: true },
    });
    const agingBuckets: { bucket: string; count: number; sumAmount: number }[] = [
      { bucket: '0-7', count: 0, sumAmount: 0 },
      { bucket: '8-14', count: 0, sumAmount: 0 },
      { bucket: '15-30', count: 0, sumAmount: 0 },
      { bucket: '30+', count: 0, sumAmount: 0 },
    ];
    for (const d of openDealsForAging) {
      const basis = d.expectedCloseDate ?? now;
      const ageDays = Math.max(0, (now.getTime() - basis.getTime()) / (1000 * 60 * 60 * 24));
      let idx = 0;
      if (ageDays <= 7) idx = 0;
      else if (ageDays <= 14) idx = 1;
      else if (ageDays <= 30) idx = 2;
      else idx = 3;
      agingBuckets[idx].count += 1;
      agingBuckets[idx].sumAmount += Number((d.amount as Prisma.Decimal | null) ?? 0);
    }

    // --- Charts: top sellers leaderboard (this month) ---
    const [wonDealsByOwner, activitiesByUser, openDealsByOwner] = await Promise.all([
      this.prisma.deal.groupBy({
        by: ['ownerUserId'],
        where: {
          tenantId: tenant.id,
          stage: { name: 'بسته شده' },
          expectedCloseDate: { gte: startOfMonth, lt: startOfNextMonth },
          ownerUserId: { not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.activity.groupBy({
        by: ['createdByUserId'],
        where: {
          tenantId: tenant.id,
          happenedAt: { gte: startOfMonth, lt: startOfNextMonth },
          createdByUserId: { not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.deal.groupBy({
        by: ['ownerUserId'],
        where: {
          tenantId: tenant.id,
          stage: { name: { not: 'بسته شده' } },
          ownerUserId: { not: null },
        },
        _sum: { amount: true },
      }),
    ]);

    const userIds = Array.from(
      new Set([
        ...wonDealsByOwner.map((x) => x.ownerUserId!),
        ...activitiesByUser.map((x) => x.createdByUserId!),
        ...openDealsByOwner.map((x) => x.ownerUserId!),
      ]),
    );
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, displayName: true },
        })
      : [];
    const userNameMap = new Map<string, string>();
    for (const u of users) {
      const name =
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        u.displayName ||
        'فروشنده';
      userNameMap.set(u.id, name);
    }

    const topSellers = userIds.map((userId) => {
      const wonRow = wonDealsByOwner.find((x) => x.ownerUserId === userId);
      const actRow = activitiesByUser.find((x) => x.createdByUserId === userId);
      const pipeRow = openDealsByOwner.find((x) => x.ownerUserId === userId);
      return {
        userId,
        name: userNameMap.get(userId) ?? 'فروشنده',
        wonDeals: wonRow?._count._all ?? 0,
        pipelineValue: Number((pipeRow?._sum.amount as Prisma.Decimal | null) ?? 0),
        activities: actRow?._count._all ?? 0,
      };
    }).sort((a, b) => b.wonDeals - a.wonDeals || b.pipelineValue - a.pipelineValue);

    // --- Lists: overdue leads, hot deals, recent activities ---
    const overdueLeads = await this.prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        followUpAt: { lt: now },
        status: { notIn: ['LOST', 'CONVERTED'] },
      },
      orderBy: { followUpAt: 'asc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        followUpAt: true,
        ownerUserId: true,
      },
    });

    const hotDealsRaw = await this.prisma.deal.findMany({
      where: {
        tenantId: tenant.id,
        stage: { name: { not: 'بسته شده' } },
      },
      select: {
        id: true,
        title: true,
        amount: true,
        expectedCloseDate: true,
        ownerUserId: true,
        stage: { select: { id: true, name: true, order: true } },
      },
    });
    const hotDealsScored = hotDealsRaw.map((d) => {
      const daysToClose =
        d.expectedCloseDate != null
          ? (d.expectedCloseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          : 30;
      const stageScore = d.stage.order ?? 0;
      const timeScore = daysToClose <= 0 ? 2 : daysToClose <= 7 ? 1.5 : daysToClose <= 14 ? 1 : 0.5;
      const baseAmount = Number((d.amount as Prisma.Decimal | null) ?? 0);
      const score = baseAmount * (1 + stageScore * 0.1) * timeScore;
      return { ...d, score };
    });
    hotDealsScored.sort((a, b) => b.score - a.score);
    const hotDeals = hotDealsScored.slice(0, 10).map((d) => ({
      id: d.id,
      title: d.title,
      stage: d.stage.name,
      amount: Number((d.amount as Prisma.Decimal | null) ?? 0),
      expectedCloseDate: d.expectedCloseDate,
      ownerUserId: d.ownerUserId,
    }));

    const recentActivities = await this.prisma.activity.findMany({
      where: { tenantId: tenant.id },
      orderBy: { happenedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        body: true,
        happenedAt: true,
        createdByUserId: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    return {
      kpis: {
        newLeadsToday,
        newLeadsThisWeek,
        overdueFollowUps,
        openDealsCount,
        pipelineValueSum,
        forecastToMonthEnd: pipelineValueSum, // MVP: از کل ارزش پایپ‌لاین به‌عنوان پیش‌بینی استفاده می‌کنیم
        wonDealsCountThisMonth,
        lostDealsCountThisMonth,
        avgDaysToClose,
      },
      charts: {
        leadsFunnel,
        pipelineByStage,
        trend30d,
        dealAging: agingBuckets,
        topSellers,
      },
      lists: {
        overdueLeads,
        hotDeals,
        recentActivities,
      },
    };
  }
}
