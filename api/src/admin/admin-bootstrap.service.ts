import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

/**
 * On startup, make sure the seeded accounts exist with their role:
 *   ADMIN_EMAIL / ADMIN_PASSWORD         -> admin
 *   MODERATOR_EMAIL / MODERATOR_PASSWORD -> moderator
 * An existing account is promoted (its password is never touched); a missing
 * one is created with the given password. An empty email disables that seed.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.seed('ADMIN', 'admin', this.config.get<string>('ADMIN_DISPLAY_NAME', 'Admin'));
    await this.seed('MODERATOR', 'moderator', this.config.get<string>('MODERATOR_DISPLAY_NAME', 'Msimamizi'));
  }

  private async seed(prefix: 'ADMIN' | 'MODERATOR', role: UserRole, displayName: string) {
    const email = this.config.get<string>(`${prefix}_EMAIL`)?.trim();
    if (!email) return;
    const emailNormalized = email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { emailNormalized } });
    if (existing) {
      // Never demote: an admin stays admin even if listed as the moderator.
      if (existing.role !== role && !(existing.role === 'admin' && role === 'moderator')) {
        await this.prisma.user.update({ where: { id: existing.id }, data: { role } });
        this.logger.log(`promoted @${existing.handle} to ${role}`);
      }
      return;
    }
    const password = this.config.get<string>(`${prefix}_PASSWORD`);
    if (!password || password.length < 8) {
      this.logger.warn(`${prefix}_EMAIL is set but no account exists and ${prefix}_PASSWORD is missing or short; skipping`);
      return;
    }
    const base = emailNormalized.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 24) || role;
    let handle = base;
    for (let i = 1; await this.prisma.user.findUnique({ where: { handle } }); i++) handle = `${base}${i}`;
    await this.prisma.user.create({
      data: {
        email,
        emailNormalized,
        passwordHash: await argon2.hash(password),
        handle,
        displayName,
        role,
        birthYear: 1990,
        profilePublic: true,
      },
    });
    this.logger.log(`created ${role} account @${handle}`);
  }
}
