import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DealsService } from './deals.service';
import { SubscriptionActiveGuard } from '../billing/subscription.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller(['t/:tenantSlug/deals', 't/:tenantSlug/quotes'])
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  @RequirePermissions('quotes.read')
  async list(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) return { data: [], total: 0 };
    return this.deals.list(tenant, {
      q,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('invoices')
  @RequirePermissions('invoices.read')
  async listInvoices(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('dealId') dealId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) return { data: [], total: 0, page: 1, pageSize: 25 };
    return this.deals.listInvoices(tenant, {
      q,
      status,
      dealId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('invoices/:invoiceId')
  @RequirePermissions('invoices.read')
  async getInvoice(@Req() req: Request, @Param('invoiceId') invoiceId: string) {
    const tenant = (req as any).tenant;
    if (!tenant) return null;
    return this.deals.getInvoice(tenant, invoiceId);
  }

  @Get(':id')
  @RequirePermissions('quotes.read')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenant = (req as any).tenant;
    if (!tenant) return null;
    return this.deals.getOne(tenant, id);
  }

  @Post()
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('quotes.write')
  async create(@Req() req: Request, @Body() body: any) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.deals.create(tenant, body);
  }

  @Post(':id/send')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('quotes.write')
  async send(@Req() req: Request, @Param('id') id: string) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.deals.send(tenant, id);
  }

  @Post(':id/convert-to-invoice')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('invoices.write')
  async convertToInvoice(@Req() req: Request, @Param('id') id: string) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.deals.convertToInvoice(tenant, id);
  }

  @Patch(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('quotes.write')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.deals.update(tenant, id, body);
  }

  @Delete(':id')
  @UseGuards(SubscriptionActiveGuard)
  @RequirePermissions('quotes.manage')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.deals.remove(tenant, id);
  }
}
