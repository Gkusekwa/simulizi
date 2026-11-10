import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorksService } from './works.service';

/**
 * Writer stats, MVP: reads, unique readers, followers (doc 05 / doc 16).
 * Writers see aggregates only; anything under 5 reads "fewer than 5".
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly works: WorksService,
  ) {}

  private t(n: number): number | string {
    return n < 5 ? 'fewer than 5' : n;
  }

  async forWork(ownerId: string, workId: string) {
    await this.works.owned(ownerId, workId);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const [reads, readsWeek, uniq, followers, followersWeek, parts] = await Promise.all([
      this.prisma.readEvent.count({ where: { part: { workId } } }),
      this.prisma.readEvent.count({ where: { part: { workId }, createdAt: { gte: since7 } } }),
      this.prisma.readEvent.findMany({
        where: { part: { workId }, createdAt: { gte: since30 } },
        select: { userId: true, anonId: true },
        distinct: ['userId', 'anonId'],
      }),
      this.prisma.follow.count({ where: { workId } }),
      this.prisma.follow.count({ where: { workId, createdAt: { gte: since7 } } }),
      this.prisma.part.findMany({
        where: { workId, state: 'public' },
        orderBy: { position: 'asc' },
        select: { id: true, position: true, title: true, _count: { select: { reads: true, likes: true, comments: true } } },
      }),
    ]);
    // Daily reads for the last 30 days (for a small chart).
    const rows = await this.prisma.readEvent.groupBy({
      by: ['day'],
      where: { part: { workId }, day: { gte: since30 } },
      _count: { _all: true },
      orderBy: { day: 'asc' },
    });
    return {
      reads: this.t(reads),
      readsLast7Days: this.t(readsWeek),
      uniqueReaders30Days: this.t(uniq.length),
      followers: this.t(followers),
      followersLast7Days: this.t(followersWeek),
      perPart: parts.map((p) => ({
        position: p.position,
        title: p.title,
        reads: this.t(p._count.reads),
        likes: this.t(p._count.likes),
        comments: this.t(p._count.comments),
      })),
      daily: rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), reads: r._count._all < 5 ? 0 : r._count._all })),
    };
  }
}
