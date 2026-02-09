import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

const leadSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  companyName: true,
  source: true,
  status: true,
  notes: true,
  followUpAt: true,
  ownerUserId: true,
  owner: { select: { id: true, phone: true, firstName: true, lastName: true } },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lead delegate. Requires `npx prisma generate` after adding Lead model. */
  private get lead(): any {
    const delegate = (this.prisma as any).lead;
    if (!delegate) {
      throw new Error(
        'Prisma client has no "lead" model. Run in backend: npx prisma generate (and npx prisma migrate dev if the Lead table does not exist yet).'
      );
    }
    return delegate;
  }

  async list(
    tenant: TenantContext,
    query?: { q?: string; page?: number; pageSize?: number; status?: string },
  ) {
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
        { companyName: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (query?.status?.trim()) {
      where.status = query.status.trim();
    }
    const [data, total] = await Promise.all([
      this.lead.findMany({
        where,
        select: leadSelect,
        orderBy: [{ followUpAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.lead.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async getOne(tenant: TenantContext, id: string) {
    return this.lead.findFirst({
      where: { id, tenantId: tenant.id },
      select: leadSelect,
    });
  }

  async create(
    tenant: TenantContext,
    body: {
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      companyName?: string;
      source?: string;
      status?: string;
      notes?: string;
      followUpAt?: string;
      ownerUserId?: string;
    },
  ) {
    const followUpAt = body.followUpAt
      ? new Date(body.followUpAt)
      : undefined;
    return this.lead.create({
      data: {
        tenantId: tenant.id,
        firstName: body.firstName?.trim() ?? '',
        lastName: body.lastName?.trim() ?? '',
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        companyName: body.companyName?.trim() || null,
        source: body.source?.trim() || null,
        status: body.status?.trim() || 'NEW',
        notes: body.notes?.trim() || null,
        followUpAt: followUpAt ?? null,
        ownerUserId: body.ownerUserId || null,
      },
      select: leadSelect,
    });
  }

  async update(
    tenant: TenantContext,
    id: string,
    body: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
      companyName: string;
      source: string;
      status: string;
      notes: string;
      followUpAt: string;
      ownerUserId: string;
    }>,
  ) {
    const existing = await this.lead.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException();
    const data: any = {};
    if (body.firstName !== undefined) data.firstName = body.firstName.trim();
    if (body.lastName !== undefined) data.lastName = body.lastName.trim();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.email !== undefined) data.email = body.email?.trim() || null;
    if (body.companyName !== undefined)
      data.companyName = body.companyName?.trim() || null;
    if (body.source !== undefined) data.source = body.source?.trim() || null;
    if (body.status !== undefined) data.status = body.status?.trim() || 'NEW';
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
    if (body.followUpAt !== undefined)
      data.followUpAt = body.followUpAt
        ? new Date(body.followUpAt)
        : null;
    if (body.ownerUserId !== undefined)
      data.ownerUserId = body.ownerUserId || null;
    return this.lead.update({
      where: { id },
      data,
      select: leadSelect,
    });
  }

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.lead.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException();
    await this.lead.delete({ where: { id } });
    return { ok: true };
  }
}
