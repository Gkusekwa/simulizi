import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './current-user.decorator';

export interface AccessPayload {
  sub: string;
  type: 'access';
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: AccessPayload): Promise<AuthUser> {
    if (payload.type !== 'access') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, handle: true, disabledAt: true, suspendedUntil: true },
    });
    if (!user || user.disabledAt) throw new UnauthorizedException();
    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      throw new UnauthorizedException(`Account suspended until ${user.suspendedUntil.toISOString().slice(0, 10)}`);
    }
    return { id: user.id, role: user.role, handle: user.handle };
  }
}
