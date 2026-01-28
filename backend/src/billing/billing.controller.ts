import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('t/:tenantSlug/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('subscription')
  async getSubscription(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return this.billing.getSubscription(tenant.id);
  }

  @Get('usage')
  async getUsage(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return this.billing.getUsage(tenant.id);
  }

  @Get('invoices')
  async listInvoices(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return this.billing.listInvoices(tenant.id);
  }
}
