import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantContext } from '../tenant/tenant.middleware';
import { SmsService } from './sms.service';

type AuthenticatedRequest = Request & {
  tenant?: TenantContext;
  user?: {
    userId: string;
    tenantId: string;
    role: string;
    permissions?: string[];
    sessionId: string;
  };
};

@Controller(['t/:tenantSlug/sms', 'api/t/:tenantSlug/sms'])
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  private getContext(req: AuthenticatedRequest) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant) throw new BadRequestException('Tenant not found');
    if (!actor) throw new BadRequestException('User not found');
    return { tenant, actor };
  }

  @Get()
  @RequirePermissions('sms.read')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('scope') scope?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('createdByUserId') createdByUserId?: string,
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.sms.list(tenant, actor, {
      scope,
      from,
      to,
      status,
      createdByUserId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('send')
  @RequirePermissions('sms.write')
  async send(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      recipientPhone?: string;
      recipientName?: string;
      body?: string;
      templateId?: string;
    },
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.sms.sendSingle(tenant, actor, body);
  }

  @Post('bulk')
  @RequirePermissions('sms.bulk.send')
  async bulk(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      recipients?: Array<{ phone?: string; name?: string }>;
      body?: string;
      templateId?: string;
      campaignName?: string;
    },
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.sms.sendBulk(tenant, actor, body);
  }

  @Get('templates')
  @RequirePermissions('sms.read')
  async listTemplates(@Req() req: AuthenticatedRequest) {
    const { tenant, actor } = this.getContext(req);
    return this.sms.listTemplates(tenant, actor);
  }

  @Post('templates')
  @RequirePermissions('sms.manage')
  async createTemplate(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name?: string; body?: string; isActive?: boolean },
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.sms.createTemplate(tenant, actor, body);
  }

  @Patch('templates/:id')
  @RequirePermissions('sms.manage')
  async updateTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { name?: string; body?: string; isActive?: boolean },
  ) {
    const { tenant } = this.getContext(req);
    return this.sms.updateTemplate(tenant, id, body);
  }

  @Delete('templates/:id')
  @RequirePermissions('sms.manage')
  async deleteTemplate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const { tenant } = this.getContext(req);
    return this.sms.deleteTemplate(tenant, id);
  }

  @Get('opt-outs')
  @RequirePermissions('sms.manage')
  async listOptOuts(@Req() req: AuthenticatedRequest) {
    const { tenant } = this.getContext(req);
    return this.sms.listOptOuts(tenant);
  }

  @Post('opt-outs')
  @RequirePermissions('sms.manage')
  async addOptOut(
    @Req() req: AuthenticatedRequest,
    @Body() body: { phone?: string; reason?: string },
  ) {
    const { tenant, actor } = this.getContext(req);
    return this.sms.addOptOut(tenant, actor, body);
  }

  @Delete('opt-outs/:phone')
  @RequirePermissions('sms.manage')
  async removeOptOut(@Req() req: AuthenticatedRequest, @Param('phone') phone: string) {
    const { tenant } = this.getContext(req);
    return this.sms.removeOptOut(tenant, phone);
  }
}
