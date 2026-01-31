import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext) {
    return this.prisma.pipeline.findMany({
      where: { tenantId: tenant.id },
      include: {
        stages: { orderBy: { order: 'asc' } },
      },
    });
  }
}
