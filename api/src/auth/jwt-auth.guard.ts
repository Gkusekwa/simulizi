import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { UserRole } from '@prisma/client';
import { IS_PUBLIC } from './public.decorator';
import { ROLES } from './roles.decorator';

/**
 * Bearer auth by default. @Public() routes let anonymous requests through but
 * still attach req.user when a valid token is sent, so public reading pages
 * can personalise (follow state, progress). @Roles() narrows further.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);

    let ok = false;
    try {
      ok = (await super.canActivate(context)) as boolean;
    } catch (e) {
      if (!isPublic) throw e;
    }
    if (isPublic) return true;
    if (!ok) return false;
    if (roles?.length) {
      const user = context.switchToHttp().getRequest().user;
      if (!user || !roles.includes(user.role)) {
        throw new ForbiddenException('Insufficient role');
      }
    }
    return true;
  }

  // On public routes a missing/invalid token must not throw.
  override handleRequest<TUser = unknown>(err: unknown, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (err || !user) {
      if (isPublic) return undefined as TUser;
      throw err ?? new ForbiddenException();
    }
    return user;
  }
}
