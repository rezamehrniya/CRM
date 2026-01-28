import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

const contactSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  companyId: true,
  ownerUserId: true,
  company: { select: { id: true, name: true } },
};

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext, query?: { q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 25));
    const skip = (page - 1) * pageSize;
    const where: any = { tenantId: tenant.id };
    if (query?.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        select: contactSelect,
        orderBy: { id: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async getOne(tenant: TenantContext, id: string) {
    return this.prisma.contact.findFirst({
      where: { id, tenantId: tenant.id },
      select: { ...contactSelect, tenantId: true },
    });
  }

  async create(tenant: TenantContext, body: { fullName: string; phone?: string; email?: string; companyId?: string; ownerUserId?: string }) {
    return this.prisma.contact.create({
      data: {
        tenantId: tenant.id,
        fullName: body.fullName?.trim() ?? '',
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        companyId: body.companyId || null,
        ownerUserId: body.ownerUserId || null,
      },
      select: contactSelect,
    });
  }

  async update(tenant: TenantContext, id: string, body: Partial<{ fullName: string; phone: string; email: string; companyId: string; ownerUserId: string }>) {
    const existing = await this.prisma.contact.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    const data: any = {};
    if (body.fullName !== undefined) data.fullName = body.fullName.trim();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.email !== undefined) data.email = body.email?.trim() || null;
    if (body.companyId !== undefined) data.companyId = body.companyId || null;
    if (body.ownerUserId !== undefined) data.ownerUserId = body.ownerUserId || null;
    return this.prisma.contact.update({
      where: { id },
      data,
      select: contactSelect,
    });
  }

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.prisma.contact.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.contact.delete({ where: { id } });
    return { ok: true };
  }
}
