import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;

    if (!user) throw new ForbiddenException('Missing user in request');

    const userPerms = new Set(user.permissions || []);
    const missing = required.filter((p) => !userPerms.has(p));
    if (missing.length) {
      throw new ForbiddenException(`Missing permissions: ${missing.join(', ')}`);
    }

    return true;
  }
}
