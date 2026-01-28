import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err) {
      if (err.response?.code === 'TENANT_MISMATCH') {
        throw new ForbiddenException({ code: 'TENANT_MISMATCH', message: 'Token does not belong to this tenant' });
      }
      throw err;
    }
    if (!user) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
    return user;
  }
}
