import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

const activitySelect = {
  id: true,
  type: true,
  body: true,
  happenedAt: true,
  contactId: true,
  dealId: true,
  createdByUserId: true,
  contact: { select: { id: true, firstName: true, lastName: true } },
  deal: { select: { id: true, title: true } },
  createdBy: { select: { id: true, phone: true, firstName: true, lastName: true } },
};

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenant: TenantContext,
    query?: { contactId?: string; dealId?: string; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 25));
    const skip = (page - 1) * pageSize;
    const where: any = { tenantId: tenant.id };
    if (query?.contactId) where.contactId = query.contactId;
    if (query?.dealId) where.dealId = query.dealId;
    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        select: activitySelect,
        orderBy: { happenedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.activity.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async getOne(tenant: TenantContext, id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, tenantId: tenant.id },
      select: { ...activitySelect, tenantId: true },
    });
    if (!activity) throw new NotFoundException();
    return activity;
  }

  async create(
    tenant: TenantContext,
    body: { type: string; body?: string; happenedAt: string; contactId?: string; dealId?: string },
  ) {
    const type = ['CALL', 'MEETING', 'NOTE'].includes(body.type?.trim() ?? '') ? body.type!.trim() : 'NOTE';
    return this.prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type,
        body: body.body?.trim() || null,
        happenedAt: new Date(body.happenedAt || Date.now()),
        contactId: body.contactId || null,
        dealId: body.dealId || null,
      },
      select: activitySelect,
    });
  }
}
