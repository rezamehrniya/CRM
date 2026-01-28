import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(tenant: TenantContext) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [contactsCount, dealsCount, tasksDueToday, pipelineValue] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId: tenant.id } }),
      this.prisma.deal.count({ where: { tenantId: tenant.id } }),
      this.prisma.task.count({
        where: {
          tenantId: tenant.id,
          status: 'OPEN',
          dueAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.deal.aggregate({
        where: { tenantId: tenant.id },
        _sum: { amount: true },
      }),
    ]);

    return {
      contactsCount,
      dealsCount,
      tasksDueToday,
      pipelineValue: pipelineValue._sum.amount?.toString() ?? '0',
    };
  }
}
