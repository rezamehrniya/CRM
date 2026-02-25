import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('t/:tenantSlug/billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('subscription')
  @RequirePermissions('settings.read')
  async getSubscription(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return this.billing.getSubscription(tenant.id);
  }

  @Get('usage')
  @RequirePermissions('settings.read')
  async getUsage(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return this.billing.getUsage(tenant.id);
  }

  @Get('invoices')
  @RequirePermissions('invoices.read')
  async listInvoices(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return this.billing.listInvoices(tenant.id);
  }
}
