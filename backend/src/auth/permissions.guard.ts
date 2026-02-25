import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { hasAllPermissions } from './permissions.utils';

type RequestUser = {
  role?: string;
  permissions?: string[];
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!hasAllPermissions(user, requiredPermissions)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    return true;
  }
}
