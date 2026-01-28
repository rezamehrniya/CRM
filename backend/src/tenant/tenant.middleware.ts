import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let slug = req.params['tenantSlug'];
    if (!slug && typeof req.path === 'string') {
      const match = req.path.match(/^\/?t\/([^/]+)/);
      slug = match?.[1];
    }
    if (!slug || typeof slug !== 'string') {
      return res.status(404).json({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant slug is required',
      });
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: slug.trim(), status: 'ACTIVE' },
    });

    if (!tenant) {
      return res.status(404).json({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found or inactive',
      });
    }

    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
    };
    next();
  }
}
