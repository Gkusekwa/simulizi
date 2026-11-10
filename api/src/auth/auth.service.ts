import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const MIN_AGE = 13;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  static normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async register(dto: RegisterDto) {
    const emailNormalized = AuthService.normalizeEmail(dto.email);
    const age = new Date().getUTCFullYear() - dto.birthYear;
    if (age < MIN_AGE) {
      throw new BadRequestException(`You must be at least ${MIN_AGE} to sign up`);
    }
    const [emailTaken, handleTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { emailNormalized } }),
      this.prisma.user.findUnique({ where: { handle: dto.handle } }),
    ]);
    if (emailTaken) throw new ConflictException('Email already registered');
    if (handleTaken) throw new ConflictException('Handle already taken');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim(),
        emailNormalized,
        passwordHash: await argon2.hash(dto.password),
        handle: dto.handle,
        displayName: dto.displayName.trim(),
        birthYear: dto.birthYear,
        uiLanguage: dto.uiLanguage ?? 'sw',
        // Under-18 accounts stay private and never see Mature works (doc 10).
        mature: false,
        profilePublic: age >= 18,
      },
    });
    this.logger.log(`user registered: ${user.handle}`);
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized: AuthService.normalizeEmail(dto.email) },
    });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Wrong email or password');
    }
    if (user.disabledAt) throw new UnauthorizedException('Account disabled');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user: this.publicUser(user), ...(await this.issueTokens(user.id)) };
  }

  /** Rotate: the presented refresh token is revoked and a new pair issued. */
  async refresh(dto: RefreshDto) {
    const tokenHash = AuthService.hash(dto.refreshToken);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid');
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(row.userId);
  }

  async logout(dto: RefreshDto) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: AuthService.hash(dto.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async issueTokens(userId: string): Promise<Tokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, type: 'access' },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
      },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = Number(String(this.config.get('JWT_REFRESH_TTL', '30d')).replace(/\D/g, '')) || 30;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: AuthService.hash(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });
    return { accessToken, refreshToken };
  }

  private static hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  publicUser(u: {
    id: string;
    handle: string;
    displayName: string;
    role: string;
    uiLanguage: string;
    email: string;
    bio: string | null;
    profilePublic: boolean;
  }) {
    return {
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      role: u.role,
      uiLanguage: u.uiLanguage,
      email: u.email,
      bio: u.bio,
      profilePublic: u.profilePublic,
    };
  }
}
