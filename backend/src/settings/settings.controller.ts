import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { SettingsService } from './settings.service';

@Controller('t/:tenantSlug/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions('settings.read')
  getSettings(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return { ok: true, tenantId: tenant.id };
  }

  @Get('members')
  @RequirePermissions('users.read')
  listMembers(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return [];
    return this.settings.listMembers(tenant);
  }

  @Post('members')
  @RequirePermissions('users.write')
  addMember(
    @Req() req: Request,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      password?: string;
      roleKey?: string;
    },
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.settings.addMember(tenant, {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      password: body.password,
      roleKey: body.roleKey,
    });
  }

  @Patch('members/:membershipId/role')
  @RequirePermissions('users.manage')
  updateMemberRole(
    @Req() req: Request,
    @Param('membershipId') membershipId: string,
    @Body() body: { roleKey?: string },
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.settings.updateMemberRole(tenant, membershipId, body.roleKey);
  }

  @Get('roles')
  @RequirePermissions('users.read')
  listRoles(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return [];
    return this.settings.listRoles(tenant);
  }

  @Get('permissions')
  @RequirePermissions('users.read')
  listPermissions(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return [];
    return this.settings.listPermissions(tenant);
  }
}
