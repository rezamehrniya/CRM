import { Controller, Get, Post, Body, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { RequestWithAuth } from './jwt.strategy';

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

  @Post('demo-session')
  async demoSession(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tenant = (req as any).tenant;
    if (!tenant || tenant.slug !== 'demo') {
      return { error: 'Demo session only available for demo tenant' };
    }
    return this.auth.createDemoSession(tenant, res);
  }
}
