import { Controller, Get, Post, Patch, Body, Req, Res, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { RequestWithAuth } from './jwt.strategy';
import type { UploadedAvatarFile } from './auth.service';

const ALLOWED_AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

@Controller('t/:tenantSlug/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { phoneOrEmail?: string; password?: string },
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return this.auth.login(tenant, body, res);
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return this.auth.refresh(tenant, req, res);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tenant = (req as any).tenant;
    if (!tenant) return { error: 'Tenant not found' };
    return this.auth.logout(tenant, req as RequestWithAuth, res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) return { user: null };
    return this.auth.me(tenant, req as RequestWithAuth);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: Request,
    @Body() body: { firstName?: string; lastName?: string; displayName?: string; avatarUrl?: string },
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.auth.updateProfile(tenant, req as RequestWithAuth, body);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: MAX_AVATAR_BYTES },
      fileFilter: (_req, file, cb) => {
        if (file && ALLOWED_AVATAR_MIMES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('فقط تصاویر (JPEG، PNG، GIF، WebP) مجاز است'), false);
        }
      },
    }),
  )
  async uploadAvatar(@Req() req: Request, @UploadedFile() file: UploadedAvatarFile) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.auth.uploadAvatar(tenant, req as RequestWithAuth, file);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: Request,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new Error('Tenant not found');
    return this.auth.changePassword(tenant, req as RequestWithAuth, body);
  }

  @Post('demo-session')
  async demoSession(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tenant = (req as any).tenant;
    if (!tenant || tenant.slug !== 'demo') {
      return { error: 'Demo session only available for demo tenant' };
    }
    return this.auth.createDemoSession(tenant, res);
  }
}
