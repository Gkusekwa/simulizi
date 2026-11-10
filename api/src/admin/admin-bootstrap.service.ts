import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

/**
 * On startup, make sure ADMIN_EMAIL is an admin: promote the account if it
 * exists (never touching its password), or create it with ADMIN_PASSWORD.
 * Empty ADMIN_EMAIL disables seeding. Same pattern as familia.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config.get<string>('ADMIN_EMAIL')?.trim();
    if (!email) return;
    const emailNormalized = email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { emailNormalized } });
    if (existing) {
      if (existing.role !== 'admin') {
        await this.prisma.user.update({ where: { id: existing.id }, data: { role: 'admin' } });
        this.logger.log(`promoted ${existing.handle} to admin`);
      }
      return;
    }
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!password || password.length < 8) {
      this.logger.warn('ADMIN_EMAIL set but no account exists and ADMIN_PASSWORD is missing or short; skipping');
      return;
    }
    const base = emailNormalized.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'admin';
    let handle = base;
    for (let i = 1; await this.prisma.user.findUnique({ where: { handle } }); i++) handle = `${base}${i}`;
    await this.prisma.user.create({
      data: {
        email,
        emailNormalized,
        passwordHash: await argon2.hash(password),
        handle,
        displayName: this.config.get<string>('ADMIN_DISPLAY_NAME', 'Admin'),
        role: 'admin',
        birthYear: 1990,
        profilePublic: true,
      },
    });
    this.logger.log(`created admin account @${handle}`);
  }
}
