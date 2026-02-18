import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SettingsService } from './settings.service';

/**
 * تنظیمات Tenant — فقط OWNER.
 * مدیریت اعضا فقط با شماره تلفن؛ شماره تلفن به‌عنوان نام کاربری (برای ورود) استفاده می‌شود.
 */
@Controller('t/:tenantSlug/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSettings(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return { ok: true, tenantId: tenant.id };
  }

  @Get('members')
  listMembers(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return [];
    return this.settings.listMembers(tenant);
  }

  @Post('members')
  addMember(
    @Req() req: Request,
    @Body() body: { phone?: string; password?: string; role?: string },
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.settings.addMember(tenant, {
      phone: body.phone ?? '',
      password: body.password ?? '',
      role: body.role,
    });
  }
}
