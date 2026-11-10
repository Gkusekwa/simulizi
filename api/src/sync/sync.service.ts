import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { partSummary } from '../works/works.service';
import { ProgressBatchDto } from './dto/sync.dto';

/**
 * Delta sync for the app (doc 06): one request with the last cursor returns
 * only what changed for the reader's followed works -- new or edited public
 * parts with their text, the current list of readable part ids per work (so
 * the app prunes unpublished/removed/deleted copies), and progress saved on
 * other devices. The app pushes its outbox of reading positions in one batch.
 */
@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async pull(userId: string, since?: Date) {
    const now = new Date();
    const follows = await this.prisma.follow.findMany({
      where: { userId, work: { deletedAt: null } },
      select: {
        work: {
          select: {
            id: true,
            slug: true,
            title: true,
            synopsis: true,
            language: true,
            kind: true,
            volumes: true,
            status: true,
            access: true,
            previewParts: true,
            lastPublicAt: true,
            updatedAt: true,
            owner: { select: { handle: true, displayName: true } },
            parts: { where: { state: 'public' }, orderBy: { position: 'asc' }, select: { id: true, position: true, version: true } },
          },
        },
      },
    });
    const works = follows.map((f) => f.work);
    const workIds = works.map((w) => w.id);
    const changedParts = await this.prisma.part.findMany({
      where: {
        workId: { in: workIds },
        state: 'public',
        ...(since ? { OR: [{ updatedAt: { gt: since } }, { releasedAt: { gt: since } }] } : {}),
      },
      orderBy: [{ workId: 'asc' }, { position: 'asc' }],
      select: { ...partSummary, bodyJson: true, bodyHtml: true },
    });
    const progress = await this.prisma.readingProgress.findMany({
      where: { userId, part: { workId: { in: workIds } }, ...(since ? { updatedAt: { gt: since } } : {}) },
      select: { partId: true, paragraphIndex: true, fraction: true, finished: true, updatedAt: true },
    });
    return {
      cursor: now.toISOString(),
      works: works.map((w) => ({ ...w, partIds: w.parts.map((p) => p.id), parts: undefined })),
      parts: changedParts,
      progress,
    };
  }

  /** Outbox: last write wins by the client's updatedAt (doc 06 conflicts). */
  async pushProgress(userId: string, dto: ProgressBatchDto) {
    let applied = 0;
    for (const item of dto.items) {
      const existing = await this.prisma.readingProgress.findUnique({ where: { userId_partId: { userId, partId: item.partId } } });
      const clientTime = new Date(item.updatedAt);
      if (existing && existing.updatedAt > clientTime) continue;
      const part = await this.prisma.part.findUnique({ where: { id: item.partId }, select: { id: true } });
      if (!part) continue;
      await this.prisma.readingProgress.upsert({
        where: { userId_partId: { userId, partId: item.partId } },
        create: { userId, partId: item.partId, paragraphIndex: item.paragraphIndex, fraction: item.fraction, finished: item.finished },
        update: { paragraphIndex: item.paragraphIndex, fraction: item.fraction, finished: item.finished },
      });
      applied++;
    }
    return { applied };
  }

  async registerDevice(userId: string, token: string, platform: string) {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeen: new Date() },
    });
    return { ok: true };
  }

  async removeDevice(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
    return { ok: true };
  }
}
