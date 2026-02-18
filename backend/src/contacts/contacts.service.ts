import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

const contactSelect = {
  id: true,
  firstName: true,
  lastName: true,
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
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
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

  async create(tenant: TenantContext, body: { firstName: string; lastName: string; phone?: string; email?: string; companyId?: string; ownerUserId?: string }) {
    return this.prisma.contact.create({
      data: {
        tenantId: tenant.id,
        firstName: body.firstName?.trim() ?? '',
        lastName: body.lastName?.trim() ?? '',
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        companyId: body.companyId || null,
        ownerUserId: body.ownerUserId || null,
      },
      select: contactSelect,
    });
  }

  private readonly IMPORT_MAX = 200;

  async createMany(
    tenant: TenantContext,
    items: Array<{ firstName?: string; lastName?: string; fullName?: string; phone?: string; email?: string }>,
  ) {
    const toCreate = items.slice(0, this.IMPORT_MAX).map((row) => {
      let firstName = (row.firstName ?? '').trim();
      let lastName = (row.lastName ?? '').trim();
      if ((!firstName && !lastName) && (row.fullName ?? '').trim()) {
        const full = (row.fullName ?? '').trim();
        const space = full.indexOf(' ');
        firstName = space >= 0 ? full.slice(0, space) : full;
        lastName = space >= 0 ? full.slice(space + 1).trim() : '';
      }
      if (!firstName) firstName = '—';
      return {
        tenantId: tenant.id,
        firstName,
        lastName: lastName || '—',
        phone: (row.phone ?? '').trim() || null,
        email: (row.email ?? '').trim() || null,
      };
    });
    if (toCreate.length === 0) return { created: 0 };
    const result = await this.prisma.contact.createMany({ data: toCreate });
    return { created: result.count };
  }

  async update(tenant: TenantContext, id: string, body: Partial<{ firstName: string; lastName: string; phone: string; email: string; companyId: string; ownerUserId: string }>) {
    const existing = await this.prisma.contact.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException();
    const data: any = {};
    if (body.firstName !== undefined) data.firstName = body.firstName.trim();
    if (body.lastName !== undefined) data.lastName = body.lastName.trim();
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
