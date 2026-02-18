import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

const taskSelect = {
  id: true,
  title: true,
  dueAt: true,
  status: true,
  contactId: true,
  dealId: true,
  contact: { select: { id: true, firstName: true, lastName: true } },
  deal: { select: { id: true, title: true } },
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext, query?: { q?: string; status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 25));
    const skip = (page - 1) * pageSize;
    const where: any = { tenantId: tenant.id };
    if (query?.status?.trim()) where.status = query.status.trim();
    if (query?.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { contact: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] } },
        { deal: { title: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: taskSelect,
        orderBy: [{ dueAt: 'asc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async getOne(tenant: TenantContext, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId: tenant.id },
      select: { ...taskSelect, tenantId: true },
    });
    if (!task) throw new NotFoundException();
    return task;
  }

  async create(
    tenant: TenantContext,
    body: { title: string; dueAt?: string; status?: string; contactId?: string; dealId?: string },
  ) {
    return this.prisma.task.create({
      data: {
        tenantId: tenant.id,
        title: body.title?.trim() ?? '',
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        status: body.status?.trim() === 'DONE' ? 'DONE' : 'OPEN',
        contactId: body.contactId || null,
        dealId: body.dealId || null,
      },
      select: taskSelect,
    });
  }

  async update(
    tenant: TenantContext,
    id: string,
    body: Partial<{ title: string; dueAt: string; status: string; contactId: string; dealId: string }>,
  ) {
    const existing = await this.prisma.task.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    const data: any = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.status !== undefined) data.status = body.status === 'DONE' ? 'DONE' : 'OPEN';
    if (body.contactId !== undefined) data.contactId = body.contactId || null;
    if (body.dealId !== undefined) data.dealId = body.dealId || null;
    return this.prisma.task.update({
      where: { id },
      data,
      select: taskSelect,
    });
  }

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.prisma.task.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }
}
