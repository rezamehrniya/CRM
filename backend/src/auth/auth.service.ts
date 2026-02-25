import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { TenantContext } from '../tenant/tenant.middleware';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH } from './constants';
import { AccessPayload } from './jwt.strategy';
import {
  PERMISSION_KEYS,
  PermissionKey,
  getDefaultPermissionsForRole,
  getDefaultRoleDefinition,
  normalizeRoleKey,
} from './permissions.constants';
import { ensureTenantRbac } from './rbac.utils';

/** فایل آپلود از FileInterceptor (memory storage) */
export interface UploadedAvatarFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}

const UPLOADS_AVATARS = 'uploads/avatars';
const AVATAR_URL_PREFIX = '/api/uploads/avatars/';
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const COOKIE_PATH_PREFIX = '/api/t/';
const SALT_ROUNDS = 10;
const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS);
const DEMO_PASSWORD_FALLBACKS = new Set(['12345678', '123456']);

function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

function hashRefresh(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async loadAccessContext(tenantId: string, userId: string) {
    await ensureTenantRbac(this.prisma, tenantId);

    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!membership || membership.status !== 'ACTIVE') return null;

    const normalizedRoleKey = normalizeRoleKey(membership.role);
    const fallbackRole = getDefaultRoleDefinition(normalizedRoleKey);
    let roleKey = fallbackRole.key;
    let roleName = fallbackRole.name;
    let permissions = getDefaultPermissionsForRole(normalizedRoleKey);

    const db = this.prisma as any;
    if (db?.role && db?.rolePermission && db?.permission) {
      try {
        const role = await db.role.findUnique({
          where: { tenantId_key: { tenantId, key: normalizedRoleKey } },
          select: { key: true, name: true },
        });

        const permissionRows: Array<{ permission: { key: string } }> = await db.rolePermission.findMany({
          where: {
            role: { tenantId, key: normalizedRoleKey },
          },
          select: {
            permission: { select: { key: true } },
          },
        });

        if (role?.key) roleKey = normalizeRoleKey(role.key);
        if (role?.name) roleName = role.name;
        if (permissionRows.length > 0) {
          permissions = permissionRows
            .map((item) => item.permission.key)
            .filter(isPermissionKey);
        }
      } catch {
        // Keep fallback role/permissions when RBAC tables or delegates are not ready.
      }
    }

    return {
      roleKey,
      roleName,
      permissions: Array.from(new Set(permissions)),
    };
  }

  private signAccessToken(input: {
    userId: string;
    tenantId: string;
    sessionId: string;
    roleKey: string;
    roleName: string;
    permissions: string[];
  }) {
    return this.jwt.sign(
      {
        sub: input.userId,
        tid: input.tenantId,
        role: input.roleKey,
        roleName: input.roleName,
        permissions: input.permissions,
        sid: input.sessionId,
      } as Omit<AccessPayload, 'exp'>,
      { expiresIn: AUTH.ACCESS_EXPIRES_IN },
    );
  }

  async login(
    tenant: TenantContext,
    body: { phoneOrEmail?: string; password?: string },
    res: Response,
  ) {
    const identifier = body.phoneOrEmail?.trim();
    const password = body.password;
    const normalizedIdentifier = identifier?.toLowerCase() ?? '';

    if (!identifier || !password) {
      throw new UnauthorizedException({ code: 'INVALID_INPUT', message: 'identifier and password required' });
    }

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
        status: 'ACTIVE',
      },
    });

    if (!user && tenant.slug === 'demo') {
      const aliasPhone =
        normalizedIdentifier === 'seller@demo.com'
          ? '09120000002'
          : normalizedIdentifier === 'owner@demo.com'
            ? '09120000001'
            : null;

      if (aliasPhone) {
        user = await this.prisma.user.findFirst({
          where: { phone: aliasPhone, status: 'ACTIVE' },
        });
      }
    }

    if (!user && tenant.slug === 'demo') {
      const desiredRole =
        normalizedIdentifier === 'seller@demo.com' || normalizedIdentifier === '09120000002'
          ? 'SALES_REP'
          : normalizedIdentifier === 'owner@demo.com' || normalizedIdentifier === '09120000001'
            ? 'SALES_MANAGER'
            : null;

      let fallbackMembership = await this.prisma.membership.findFirst({
        where: desiredRole
          ? { tenantId: tenant.id, status: 'ACTIVE', role: desiredRole }
          : { tenantId: tenant.id, status: 'ACTIVE' },
        select: { userId: true },
      });

      if (!fallbackMembership) {
        fallbackMembership = await this.prisma.membership.findFirst({
          where: { tenantId: tenant.id, status: 'ACTIVE' },
          select: { userId: true },
        });
      }

      if (fallbackMembership) {
        user = await this.prisma.user.findFirst({
          where: { id: fallbackMembership.userId, status: 'ACTIVE' },
        });
      }
    }

    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid identifier or password' });
    }

    const accessContext = await this.loadAccessContext(tenant.id, user.id);
    if (!accessContext) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Not a member of this tenant' });
    }

    let ok = false;
    if (user.passwordHash) {
      ok = await bcrypt.compare(password, user.passwordHash);
    }
    if (!ok && tenant.slug === 'demo' && DEMO_PASSWORD_FALLBACKS.has(password)) {
      ok = true;
      // Self-heal stale demo password hashes to prevent repeated fallbacks.
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }).catch(() => {});
    }
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

    const accessToken = this.signAccessToken({
      userId: user.id,
      tenantId: tenant.id,
      sessionId,
      roleKey: accessContext.roleKey,
      roleName: accessContext.roleName,
      permissions: accessContext.permissions,
    });

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
      role: accessContext.roleKey,
      roleName: accessContext.roleName,
      permissions: accessContext.permissions,
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

    const accessContext = await this.loadAccessContext(tenant.id, session.userId);
    if (!accessContext) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      this.clearRefreshCookie(tenant, res);
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Membership no longer active' });
    }

    const accessToken = this.signAccessToken({
      userId: session.userId,
      tenantId: tenant.id,
      sessionId: session.id,
      roleKey: accessContext.roleKey,
      roleName: accessContext.roleName,
      permissions: accessContext.permissions,
    });

    return {
      accessToken,
      expiresIn: 900,
      user: { id: session.user.id, email: session.user.email, phone: session.user.phone },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      role: accessContext.roleKey,
      roleName: accessContext.roleName,
      permissions: accessContext.permissions,
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

  async me(
    tenant: TenantContext,
    req: { user?: { userId: string; tenantId: string; role: string; roleName?: string | null; permissions?: string[] } },
  ) {
    const u = req.user;
    if (!u || u.tenantId !== tenant.id) {
      return { user: null, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };
    }

    const user = await this.prisma.user.findFirst({
      where: { id: u.userId, status: 'ACTIVE' },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, displayName: true, avatarUrl: true },
    });
    if (!user) return { user: null, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };

    const accessContext = await this.loadAccessContext(tenant.id, user.id);
    if (!accessContext) {
      return { user: null, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };
    }

    const profileUser = user as typeof user & { firstName?: string | null; lastName?: string | null; displayName?: string | null; avatarUrl?: string | null };
    const firstName = profileUser.firstName ?? null;
    const lastName = profileUser.lastName ?? null;
    const profileComplete = !!(firstName?.trim() && lastName?.trim());
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName,
        lastName,
        displayName: profileUser.displayName ?? null,
        avatarUrl: profileUser.avatarUrl ?? null,
        profileComplete,
      },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      role: accessContext.roleKey,
      roleName: accessContext.roleName,
      permissions: accessContext.permissions,
    };
  }

  async uploadAvatar(
    tenant: TenantContext,
    req: { user?: { userId: string; tenantId: string } },
    file: UploadedAvatarFile | undefined,
  ): Promise<{ avatarUrl: string }> {
    const u = req.user;
    if (!u || u.tenantId !== tenant.id) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }
    if (!file || !file.buffer) {
      throw new BadRequestException({ code: 'NO_FILE', message: 'فایلی ارسال نشده است' });
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'حداکثر حجم تصویر ۲ مگابایت است' });
    }
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException({ code: 'INVALID_TYPE', message: 'فقط تصاویر (JPEG، PNG، GIF، WebP) مجاز است' });
    }
    const ext = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/gif' ? 'gif' : 'webp';
    const dir = join(process.cwd(), UPLOADS_AVATARS);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filename = `${u.userId}_${Date.now()}.${ext}`;
    const filepath = join(dir, filename);
    await writeFile(filepath, file.buffer);
    const avatarUrl = `${AVATAR_URL_PREFIX}${filename}`;
    try {
      await this.prisma.user.update({
        where: { id: u.userId },
        data: { avatarUrl } as Record<string, unknown>,
      });
    } catch (err: unknown) {
      const msg = err && typeof (err as any).message === 'string' ? (err as any).message : '';
      if (msg.includes('avatarUrl') || msg.includes('Unknown column')) {
        throw new BadRequestException({
          code: 'MIGRATION_REQUIRED',
          message: 'ستون avatarUrl وجود ندارد. در backend اجرا کنید: npx prisma migrate deploy && npx prisma generate',
        });
      }
      throw err;
    }
    return { avatarUrl };
  }

  async updateProfile(
    tenant: TenantContext,
    req: { user?: { userId: string; tenantId: string } },
    body: { firstName?: string; lastName?: string; displayName?: string; avatarUrl?: string },
  ) {
    const u = req.user;
    if (!u || u.tenantId !== tenant.id) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }
    const data: { firstName?: string | null; lastName?: string | null; displayName?: string | null; avatarUrl?: string | null } = {};
    if (body.firstName !== undefined) {
      const v = body.firstName?.trim() ?? '';
      if (!v) throw new BadRequestException({ code: 'INVALID_INPUT', message: 'نام اجباری است' });
      data.firstName = v;
    }
    if (body.lastName !== undefined) {
      const v = body.lastName?.trim() ?? '';
      if (!v) throw new BadRequestException({ code: 'INVALID_INPUT', message: 'نام خانوادگی اجباری است' });
      data.lastName = v;
    }
    if (body.displayName !== undefined) data.displayName = body.displayName?.trim() || null;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl?.trim() || null;
    try {
      await this.prisma.user.update({
        where: { id: u.userId },
        data: data as Record<string, unknown>,
      });
    } catch (err: unknown) {
      const msg = err && typeof (err as any).message === 'string' ? (err as any).message : '';
      if (msg.includes('firstName') || msg.includes('lastName') || msg.includes('displayName') || msg.includes('avatarUrl') || msg.includes('Unknown column')) {
        throw new BadRequestException({
          code: 'MIGRATION_REQUIRED',
          message: 'ستون‌های پروفایل وجود ندارند. در backend اجرا کنید: npx prisma migrate deploy && npx prisma generate',
        });
      }
      throw err;
    }
    return { ok: true };
  }

  async changePassword(
    tenant: TenantContext,
    req: { user?: { userId: string; tenantId: string } },
    body: { currentPassword?: string; newPassword?: string },
  ) {
    const u = req.user;
    if (!u || u.tenantId !== tenant.id) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }
    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword?.trim();
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      throw new UnauthorizedException({
        code: 'INVALID_INPUT',
        message: 'currentPassword and newPassword (min 8 chars) required',
      });
    }
    const user = await this.prisma.user.findFirst({
      where: { id: u.userId, status: 'ACTIVE' },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'User has no password set' });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'رمز عبور فعلی اشتباه است' });
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: u.userId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  async createDemoSession(tenant: TenantContext, _res: Response) {
    if (tenant.slug !== 'demo') {
      throw new ForbiddenException('Demo session only for demo tenant');
    }
    return { ok: true, tenant: { id: tenant.id, slug: tenant.slug } };
  }
}
