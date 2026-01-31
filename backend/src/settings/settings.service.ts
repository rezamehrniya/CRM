import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(tenant: TenantContext) {
    return this.prisma.membership.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: {
          select: { id: true, email: true, phone: true, status: true },
        },
      },
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
    });
  }
}
