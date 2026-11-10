import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ReportReason, ReportStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportDto, ResolveDto } from './dto/moderation.dto';

const URGENT: ReportReason[] = ['child_safety', 'illegal'];
const AUTO_HIDE_REPORTS = 3;
const ACCOUNT_AGE_FOR_REPORTS_MS = 7 * 86_400_000;
const STRIKES_FOR_SUSPENSION = 3;
const SUSPENSION_DAYS = 30;

/**
 * Doc 10 moderation rules, MVP subset: report button, moderator queue with
 * hide/remove/warn/suspend, strikes, blocking. Urgent reports page every
 * moderator; 3 eligible reports hide a part automatically.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async report(reporterId: string, dto: ReportDto) {
    const reporter = await this.prisma.user.findUniqueOrThrow({ where: { id: reporterId }, select: { createdAt: true } });
    const todays = await this.prisma.report.count({
      where: { reporterId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    if (todays >= 10) throw new BadRequestException('Report limit reached for today');
    await this.assertTarget(dto);
    const urgent = URGENT.includes(dto.reason);
    const report = await this.prisma.report.upsert({
      where: { reporterId_target_targetId: { reporterId, target: dto.target, targetId: dto.targetId } },
      create: { reporterId, target: dto.target, targetId: dto.targetId, reason: dto.reason, details: dto.details, urgent },
      update: { reason: dto.reason, details: dto.details, urgent },
    });

    // Automatic hiding: 3 reports from accounts at least 7 days old.
    const eligible = Date.now() - reporter.createdAt.getTime() >= ACCOUNT_AGE_FOR_REPORTS_MS;
    if (dto.target === 'part' && eligible && urgent) {
      const count = await this.prisma.report.count({
        where: {
          target: 'part',
          targetId: dto.targetId,
          status: 'open',
          reporter: { createdAt: { lte: new Date(Date.now() - ACCOUNT_AGE_FOR_REPORTS_MS) } },
        },
      });
      if (count >= AUTO_HIDE_REPORTS) await this.hidePart(dto.targetId, 'auto');
    }
    if (urgent) await this.pageModerators(report.id, dto);
    return { id: report.id, status: report.status };
  }

  private async assertTarget(dto: ReportDto) {
    const exists =
      dto.target === 'part'
        ? await this.prisma.part.findUnique({ where: { id: dto.targetId }, select: { id: true } })
        : dto.target === 'comment'
          ? await this.prisma.comment.findUnique({ where: { id: dto.targetId }, select: { id: true } })
          : await this.prisma.user.findUnique({ where: { id: dto.targetId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Nothing to report');
  }

  private async pageModerators(reportId: string, dto: ReportDto) {
    const mods = await this.prisma.user.findMany({ where: { role: { in: ['moderator', 'admin'] } }, select: { id: true, email: true } });
    for (const m of mods) {
      await this.notifications.notify(m.id, 'moderation', 'Urgent report', `${dto.target} ${dto.targetId}: ${dto.reason}`, `/mod/reports/${reportId}`);
      await this.notifications.email(m.email, `[Simulizi] Urgent report: ${dto.reason}`, `Review within 24 hours: ${dto.target} ${dto.targetId}\n${dto.details ?? ''}`);
    }
  }

  /** Hidden parts read "Removed for breaking the rules" (doc 14 §4). */
  private async hidePart(partId: string, by: string) {
    await this.prisma.part.updateMany({ where: { id: partId, state: 'public' }, data: { state: 'removed', removedAt: new Date() } });
    this.logger.warn(`part ${partId} hidden (${by})`);
  }

  // --------------------------------------------------------------- moderators

  queue(status: ReportStatus = 'open') {
    return this.prisma.report.findMany({
      where: { status },
      orderBy: [{ urgent: 'desc' }, { createdAt: 'asc' }],
      take: 100,
      include: { reporter: { select: { handle: true } } },
    });
  }

  async resolve(moderatorId: string, reportId: string, dto: ResolveDto) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('No such report');
    if (dto.status === 'open') throw new BadRequestException('Choose upheld or rejected');
    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: dto.status, resolvedById: moderatorId, resolvedAt: new Date() },
    });
    if (dto.status === 'upheld') {
      let offenderId: string | null = null;
      if (report.target === 'part') {
        await this.hidePart(report.targetId, moderatorId);
        offenderId = (await this.prisma.part.findUnique({ where: { id: report.targetId }, select: { work: { select: { ownerId: true } } } }))?.work.ownerId ?? null;
      } else if (report.target === 'comment') {
        const c = await this.prisma.comment.update({ where: { id: report.targetId }, data: { hiddenAt: new Date() }, select: { userId: true } });
        offenderId = c.userId;
      } else {
        offenderId = report.targetId;
      }
      if (offenderId) await this.strike(offenderId);
      // Also close every other open report on the same target.
      await this.prisma.report.updateMany({
        where: { target: report.target, targetId: report.targetId, status: 'open' },
        data: { status: 'upheld', resolvedById: moderatorId, resolvedAt: new Date() },
      });
    }
    return { ok: true };
  }

  /** 3 strikes in 90 days = 30-day suspension (doc 10). */
  private async strike(userId: string) {
    const u = await this.prisma.user.update({ where: { id: userId }, data: { strikes: { increment: 1 } } });
    const recent = await this.prisma.report.count({
      where: { status: 'upheld', resolvedAt: { gte: new Date(Date.now() - 90 * 86_400_000) }, OR: [{ target: 'user', targetId: userId }] },
    });
    const suspend = u.strikes >= STRIKES_FOR_SUSPENSION && recent >= 0;
    await this.notifications.notify(
      userId,
      'moderation',
      'A report against your content was upheld',
      suspend ? `Your account is suspended for ${SUSPENSION_DAYS} days.` : `Strike ${u.strikes} of ${STRIKES_FOR_SUSPENSION}.`,
    );
    if (suspend) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { suspendedUntil: new Date(Date.now() + SUSPENSION_DAYS * 86_400_000) },
      });
    }
  }

  // ------------------------------------------------------------------- blocks

  async block(blockerId: string, handle: string, on: boolean) {
    const target = await this.prisma.user.findUnique({ where: { handle }, select: { id: true } });
    if (!target) throw new NotFoundException('No such user');
    if (target.id === blockerId) throw new ForbiddenException('You cannot block yourself');
    if (on) {
      await this.prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId: target.id } },
        create: { blockerId, blockedId: target.id },
        update: {},
      });
      // Blocking stops them following my works (doc 10).
      await this.prisma.follow.deleteMany({ where: { userId: target.id, work: { ownerId: blockerId } } });
    } else {
      await this.prisma.block.deleteMany({ where: { blockerId, blockedId: target.id } });
    }
    return { blocked: on };
  }

  async blocked(userId: string) {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId },
      select: { blocked: { select: { handle: true, displayName: true } }, createdAt: true },
    });
    return rows.map((r) => ({ ...r.blocked, since: r.createdAt }));
  }

  /** Users blocked by, or blocking, `userId` -- used to filter comments. */
  async blockedIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId));
  }
}
