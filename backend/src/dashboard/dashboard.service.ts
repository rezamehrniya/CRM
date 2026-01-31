import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

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
}
