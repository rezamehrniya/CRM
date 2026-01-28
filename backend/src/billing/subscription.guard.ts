import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.middleware';

@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const tenant: TenantContext | undefined = (req as any).tenant;
    if (!tenant) return true;

    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId: tenant.id },
    });

    const now = new Date();
    const isActive =
      sub?.status === 'ACTIVE' && sub.endsAt && sub.endsAt >= now;

    if (!isActive) {
      const response = context.switchToHttp().getResponse();
      response.status(HttpStatus.LOCKED).json({
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'اشتراک منقضی شده است. فقط مشاهده و تمدید امکان‌پذیر است.',
      });
      return false;
    }
    return true;
  }
}
