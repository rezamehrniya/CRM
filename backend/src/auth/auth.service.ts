import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { TenantContext } from '../tenant/tenant.middleware';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH } from './constants';
import { AccessPayload } from './jwt.strategy';

const COOKIE_PATH_PREFIX = '/api/t/';
const SALT_ROUNDS = 10;

function hashRefresh(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    tenant: TenantContext,
    body: { phoneOrEmail?: string; password?: string },
    res: Response,
  ) {
    const identifier = body.phoneOrEmail?.trim();
    const password = body.password;

    if (!identifier || !password) {
      throw new UnauthorizedException({ code: 'INVALID_INPUT', message: 'identifier and password required' });
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
        status: 'ACTIVE',
      },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid identifier or password' });
    }

    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Not a member of this tenant' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid identifier or password' });
    }

    const sessionId = randomBytes(16).toString('hex');
    const refreshToken = this.jwt.sign(
      { sub: user.id, tid: tenant.id, sid: sessionId },
      { expiresIn: AUTH.REFRESH_EXPIRES_IN },
    );
    const refreshHash = hashRefresh(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        tenantId: tenant.id,
        refreshTokenHash: refreshHash,
        expiresAt,
      },
    });

    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        tid: tenant.id,
        role: membership.role,
        sid: sessionId,
      } as Omit<AccessPayload, 'exp'>,
      { expiresIn: AUTH.ACCESS_EXPIRES_IN },
    );

    const cookiePath = `${COOKIE_PATH_PREFIX}${tenant.slug}/auth`;
    res.cookie(AUTH.COOKIE_NAME, refreshToken, {
      httpOnly: true,
      path: cookiePath,
      maxAge: 14 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return {
      accessToken,
      expiresIn: 900,
      user: { id: user.id, email: user.email, phone: user.phone },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      role: membership.role,
    };
  }

  async refresh(tenant: TenantContext, req: { cookies?: { [key: string]: string } }, res: Response) {
    const token = req.cookies?.[AUTH.COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Refresh token missing' });
    }

    let payload: { sub?: string; tid?: string; sid?: string; exp?: number };
    try {
      payload = this.jwt.verify(token);
    } catch {
      this.clearRefreshCookie(tenant, res);
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Refresh token invalid or expired' });
    }

    if (payload.tid !== tenant.id) {
      throw new ForbiddenException({ code: 'TENANT_MISMATCH', message: 'Token does not belong to this tenant' });
    }

    const refreshHash = hashRefresh(token);
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        tenantId: tenant.id,
        userId: payload.sub,
        refreshTokenHash: refreshHash,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session) {
      this.clearRefreshCookie(tenant, res);
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Session invalid or expired' });
    }

    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: session.userId } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      this.clearRefreshCookie(tenant, res);
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Membership no longer active' });
    }

    const accessToken = this.jwt.sign(
      {
        sub: session.userId,
        tid: tenant.id,
        role: membership.role,
        sid: session.id,
      } as Omit<AccessPayload, 'exp'>,
      { expiresIn: AUTH.ACCESS_EXPIRES_IN },
    );

    return {
      accessToken,
      expiresIn: 900,
      user: { id: session.user.id, email: session.user.email, phone: session.user.phone },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      role: membership.role,
    };
  }

  async logout(tenant: TenantContext, req: { cookies?: { [key: string]: string }; user?: { sessionId: string } }, res: Response) {
    const token = req.cookies?.[AUTH.COOKIE_NAME];
    if (token) {
      const payload = this.jwt.decode(token) as { sid?: string } | null;
      if (payload?.sid) {
        await this.prisma.session.deleteMany({
          where: { id: payload.sid, tenantId: tenant.id },
        });
      }
    }
    if (req.user?.sessionId) {
      await this.prisma.session.deleteMany({
        where: { id: req.user.sessionId, tenantId: tenant.id },
      });
    }
    this.clearRefreshCookie(tenant, res);
    return { ok: true };
  }

  private clearRefreshCookie(tenant: TenantContext, res: Response) {
    const path = `${COOKIE_PATH_PREFIX}${tenant.slug}/auth`;
    res.clearCookie(AUTH.COOKIE_NAME, { path, httpOnly: true });
  }

  async me(tenant: TenantContext, req: { user?: { userId: string; tenantId: string; role: string } }) {
    const u = req.user;
    if (!u || u.tenantId !== tenant.id) {
      return { user: null, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };
    }

    const user = await this.prisma.user.findFirst({
      where: { id: u.userId, status: 'ACTIVE' },
      select: { id: true, email: true, phone: true },
    });
    if (!user) return { user: null, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };

    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      return { user: null, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };
    }

    return {
      user: { id: user.id, email: user.email, phone: user.phone },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      role: membership.role,
    };
  }

  async createDemoSession(tenant: TenantContext, _res: Response) {
    if (tenant.slug !== 'demo') {
      throw new ForbiddenException('Demo session only for demo tenant');
    }
    return { ok: true, tenant: { id: tenant.id, slug: tenant.slug } };
  }
}
