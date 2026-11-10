import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { WorksService } from '../works.service';

const LATE_MS = 5 * 60_000;

/**
 * The minute sweep (doc 14 §2): anything scheduled whose time has passed goes
 * public. Normal latency is under a minute; a release more than five minutes
 * late is logged as an incident (the admin alert hooks in here later).
 */
@Injectable()
export class ReleaseSweep {
  private readonly logger = new Logger(ReleaseSweep.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly works: WorksService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const due = await this.prisma.part.findMany({
        where: { state: 'scheduled', publicAt: { lte: now }, work: { deletedAt: null } },
        select: { id: true, publicAt: true, workId: true },
      });
      if (!due.length) return;
      for (const p of due) {
        const lateBy = now.getTime() - (p.publicAt?.getTime() ?? now.getTime());
        if (lateBy > LATE_MS) {
          this.logger.error(`INCIDENT release late by ${Math.round(lateBy / 60_000)} min: part ${p.id}`);
        }
      }
      await this.works.goPublic(due.map((p) => p.id), now);
      for (const workId of new Set(due.map((p) => p.workId))) {
        await this.works.recomputeSchedule(workId);
      }
    } catch (e) {
      this.logger.error(`sweep failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
