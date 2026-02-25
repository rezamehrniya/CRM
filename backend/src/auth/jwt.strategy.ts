import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TenantContext } from '../tenant/tenant.middleware';

export type AccessPayload = {
  sub: string;        // userId
  tid: string;        // tenantId
  role: string;       // ADMIN | SALES_MANAGER | SALES_REP | VIEWER
  roleName?: string;  // Friendly display label
  permissions: string[];
  sid: string;        // sessionId
  exp: number;
};

export type RequestWithAuth = {
  tenant?: TenantContext;
  user?: {
    userId: string;
    tenantId: string;
    role: string;
    roleName: string | null;
    permissions: string[];
    sessionId: string;
  };
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
      passReqToCallback: true,
    });
  }

  async validate(req: RequestWithAuth, payload: AccessPayload) {
    const tenant = req.tenant;
    if (!tenant) throw new UnauthorizedException('TENANT_NOT_FOUND');

    if (payload.tid !== tenant.id) {
      throw new ForbiddenException({ code: 'TENANT_MISMATCH', message: 'Token does not belong to this tenant' });
    }

    return {
      userId: payload.sub,
      tenantId: payload.tid,
      role: payload.role,
      roleName: payload.roleName ?? null,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      sessionId: payload.sid,
    };
  }
}
