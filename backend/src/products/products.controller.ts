import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { SubscriptionActiveGuard } from '../billing/subscription.guard';
import { TenantContext } from '../tenant/tenant.middleware';
import { ProductsService } from './products.service';

type AuthenticatedRequest = Request & {
  tenant?: TenantContext;
  user?: { userId: string; tenantId: string; role: string; permissions?: string[]; sessionId: string };
};

@Controller('t/:tenantSlug/products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions('products.read')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tenant = req.tenant;
    if (!tenant) return { data: [], total: 0 };
    return this.products.list(tenant, {
      q,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('import')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('imports.write')
  async importMany(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      items?: Array<{
        code?: string;
        name?: string;
        unit?: string;
        basePrice?: string | number;
        category?: string;
        isActive?: string | boolean | number;
      }>;
    },
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.products.importMany(tenant, req.user?.userId, Array.isArray(body?.items) ? body.items : []);
  }
}
