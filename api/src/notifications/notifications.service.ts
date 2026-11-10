import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationKind } from '@prisma/client';
import { createTransport, Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

/**
 * In-app notifications plus best-effort email (doc 05: in-app, email and push
 * when a followed work publishes a part; readers can switch channels off).
 * Push arrives with the Flutter app and Firebase. Email goes through SMTP_URL:
 * nasinfra's Mailpit in development, a transactional provider in production.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly mailer: Transporter | null;
  private readonly from: string;
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const smtp = config.get<string>('SMTP_URL');
    this.mailer = smtp ? createTransport(smtp) : null;
    this.from = config.get<string>('MAIL_FROM', 'Simulizi <no-reply@simulizi.tzcom.cloud>');
    this.webUrl = config.get<string>('PUBLIC_WEB_URL', 'https://simulizi.tzcom.cloud').replace(/\/$/, '');
  }

  /** Fan out "new part" to every follower of the work. Idempotent per part. */
  async partReleased(partId: string) {
    const part = await this.prisma.part.findUnique({
      where: { id: partId },
      select: {
        id: true,
        title: true,
        position: true,
        work: { select: { id: true, slug: true, title: true, ownerId: true, language: true } },
      },
    });
    if (!part) return;
    const link = `/w/${part.work.slug}/${part.position}`;
    const already = await this.prisma.notification.findFirst({ where: { kind: 'release', link }, select: { id: true } });
    if (already) return;
    const followers = await this.prisma.follow.findMany({
      where: { workId: part.work.id, userId: { not: part.work.ownerId } },
      select: { user: { select: { id: true, email: true, uiLanguage: true, emailOnRelease: true } } },
    });
    if (!followers.length) return;
    const sw = `${part.work.title}: Sehemu ya ${part.position} imetoka`;
    const en = `${part.work.title}: Part ${part.position} is out`;
    await this.prisma.notification.createMany({
      data: followers.map((f) => ({
        userId: f.user.id,
        kind: NotificationKind.release,
        title: f.user.uiLanguage === 'en' ? en : sw,
        body: part.title,
        link,
      })),
    });
    for (const f of followers) {
      if (!f.user.emailOnRelease) continue;
      const subject = f.user.uiLanguage === 'en' ? en : sw;
      const cta = f.user.uiLanguage === 'en' ? 'Read it now' : 'Isome sasa';
      await this.email(f.user.email, subject, `${part.position}. ${part.title}\n\n${cta}: ${this.webUrl}${link}`);
    }
    this.logger.log(`release notifications: ${followers.length} follower(s) of ${part.work.slug}`);
  }

  async notify(userId: string, kind: NotificationKind, title: string, body: string, link?: string) {
    return this.prisma.notification.create({ data: { userId, kind, title, body, link } });
  }

  async list(userId: string) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(userId: string, id?: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async email(to: string, subject: string, text: string) {
    if (!this.mailer) return;
    try {
      await this.mailer.sendMail({ from: this.from, to, subject, text });
    } catch (e) {
      this.logger.warn(`email to ${to} failed: ${(e as Error).message}`);
    }
  }
}
