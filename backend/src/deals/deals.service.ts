import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

const dealSelect = {
  id: true,
  title: true,
  amount: true,
  stageId: true,
  pipelineId: true,
  contactId: true,
  companyId: true,
  expectedCloseDate: true,
  stage: { select: { id: true, name: true } },
  pipeline: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
};

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext, query?: { q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 25));
    const skip = (page - 1) * pageSize;
    const where: any = { tenantId: tenant.id };
    if (query?.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { contact: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        select: dealSelect,
        orderBy: { id: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async getOne(tenant: TenantContext, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, tenantId: tenant.id },
      select: { ...dealSelect, tenantId: true },
    });
    if (!deal) throw new NotFoundException();
    return deal;
  }

  async create(
    tenant: TenantContext,
    body: {
      title: string;
      amount?: string | number;
      stageId: string;
      pipelineId: string;
      contactId?: string;
      companyId?: string;
      expectedCloseDate?: string;
    },
  ) {
    const amount = body.amount != null ? String(body.amount) : null;
    return this.prisma.deal.create({
      data: {
        tenantId: tenant.id,
        title: body.title?.trim() ?? '',
        amount: amount != null ? parseFloat(amount) : undefined,
        stageId: body.stageId,
        pipelineId: body.pipelineId,
        contactId: body.contactId || null,
        companyId: body.companyId || null,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
      },
      select: dealSelect,
    });
  }

  async update(
    tenant: TenantContext,
    id: string,
    body: Partial<{
      title: string;
      amount: string | number;
      stageId: string;
      pipelineId: string;
      contactId: string;
      companyId: string;
      expectedCloseDate: string;
    }>,
  ) {
    const existing = await this.prisma.deal.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    const data: any = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.amount !== undefined) data.amount = body.amount === '' || body.amount == null ? null : parseFloat(String(body.amount));
    if (body.stageId !== undefined) data.stageId = body.stageId;
    if (body.pipelineId !== undefined) data.pipelineId = body.pipelineId;
    if (body.contactId !== undefined) data.contactId = body.contactId || null;
    if (body.companyId !== undefined) data.companyId = body.companyId || null;
    if (body.expectedCloseDate !== undefined) data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null;
    return this.prisma.deal.update({
      where: { id },
      data,
      select: dealSelect,
    });
  }

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.prisma.deal.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.deal.delete({ where: { id } });
    return { ok: true };
  }
}
