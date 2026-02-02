import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

const companySelect = {
  id: true,
  name: true,
  phone: true,
  website: true,
  _count: { select: { contacts: true } },
};

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext, query?: { q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 25));
    const skip = (page - 1) * pageSize;
    const where: any = { tenantId: tenant.id };
    if (query?.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { website: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        select: companySelect,
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.company.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async getOne(tenant: TenantContext, id: string) {
    return this.prisma.company.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        ...companySelect,
        tenantId: true,
        contacts: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        deals: {
          select: {
            id: true,
            title: true,
            amount: true,
            stage: { select: { name: true } },
          },
        },
      },
    });
  }

  async create(tenant: TenantContext, body: { name: string; phone?: string; website?: string }) {
    return this.prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: body.name?.trim() ?? '',
        phone: body.phone?.trim() || null,
        website: body.website?.trim() || null,
      },
      select: companySelect,
    });
  }

  private readonly IMPORT_MAX = 200;

  async createMany(
    tenant: TenantContext,
    items: Array<{ name?: string; phone?: string; website?: string }>,
  ) {
    const toCreate = items
      .slice(0, this.IMPORT_MAX)
      .map((row) => ({
        tenantId: tenant.id,
        name: (row.name ?? '').trim() || '—',
        phone: (row.phone ?? '').trim() || null,
        website: (row.website ?? '').trim() || null,
      }));
    if (toCreate.length === 0) return { created: 0 };
    const result = await this.prisma.company.createMany({ data: toCreate });
    return { created: result.count };
  }

  async update(tenant: TenantContext, id: string, body: Partial<{ name: string; phone: string; website: string }>) {
    const existing = await this.prisma.company.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    const data: any = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.website !== undefined) data.website = body.website?.trim() || null;
    return this.prisma.company.update({
      where: { id },
      data,
      select: companySelect,
    });
  }

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.prisma.company.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.company.delete({ where: { id } });
    return { ok: true };
  }
}
