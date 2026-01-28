import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    if (!sub) {
      return { status: 'EXPIRED', planCode: null, endsAt: null, seatLimit: 0 };
    }
    const now = new Date();
    const status = sub.status === 'ACTIVE' && sub.endsAt >= now ? 'ACTIVE' : 'EXPIRED';
    return {
      status,
      planCode: sub.planCode,
      startsAt: sub.startsAt,
      endsAt: sub.endsAt,
      baseSeatLimit: sub.baseSeatLimit,
      addonSeatCount: sub.addonSeatCount,
      seatLimit: sub.baseSeatLimit + sub.addonSeatCount,
    };
  }

  async getUsage(tenantId: string) {
    const activeSeats = await this.prisma.membership.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    const seatLimit = sub ? sub.baseSeatLimit + sub.addonSeatCount : 0;
    return { activeSeats, seatLimit };
  }

  async listInvoices(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    });
  }
}
