import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ModerationService } from '../moderation/moderation.service';
import { PrismaService } from '../prisma/prisma.service';
import { partSummary } from '../works/works.service';
import { CommentDto, ProgressDto } from './dto/reading.dto';
import { WorkSocialService } from './work-social.service';

const workCard = {
  id: true,
  slug: true,
  title: true,
  synopsis: true,
  language: true,
  kind: true,
  genre: true,
  tags: true,
  rating: true,
  status: true,
  access: true,
  previewParts: true,
  coverKey: true,
  releasePlan: true,
  releaseTime: true,
  releaseWeekdays: true,
  firstPublicAt: true,
  lastPublicAt: true,
  owner: { select: { id: true, handle: true, displayName: true } },
  _count: { select: { follows: true, parts: { where: { state: 'public' } } } },
} satisfies Prisma.WorkSelect;

/** Public counts hide anything under 5 (doc 16). */
function fewerThanFive(n: number): number | string {
  return n < 5 ? 'fewer than 5' : n;
}

@Injectable()
export class ReadingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly social: WorkSocialService,
  ) {}

  /** Signed-out readers must not see Mature works; signed-in only if opted in. */
  async canSeeMature(userId?: string): Promise<boolean> {
    if (!userId) return false;
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { mature: true } });
    return !!u?.mature;
  }

  private async ratingFilter(userId?: string): Promise<Prisma.WorkWhereInput> {
    return (await this.canSeeMature(userId)) ? {} : { rating: { not: 'mature' } };
  }

  async discover(userId?: string, language?: 'sw' | 'en') {
    const where: Prisma.WorkWhereInput = {
      deletedAt: null,
      firstPublicAt: { not: null },
      ...(language ? { language } : {}),
      ...(await this.ratingFilter(userId)),
    };
    const [latest, trending] = await Promise.all([
      this.prisma.work.findMany({ where, orderBy: { lastPublicAt: 'desc' }, take: 20, select: workCard }),
      this.prisma.work.findMany({
        where,
        orderBy: { follows: { _count: 'desc' } },
        take: 10,
        select: workCard,
      }),
    ]);
    return { latest, trending };
  }

  async work(slug: string, userId?: string) {
    const work = await this.prisma.work.findFirst({
      where: { slug, deletedAt: null },
      select: { ...workCard, ownerId: true, timezone: true },
    });
    if (!work || (!work.firstPublicAt && work.ownerId !== userId)) throw new NotFoundException('No such work');
    if (work.rating === 'mature') {
      const ok = userId
        ? (await this.prisma.user.findUnique({ where: { id: userId }, select: { mature: true } }))?.mature
        : false;
      if (!ok && work.ownerId !== userId) throw new ForbiddenException('Mature work: sign in and opt in');
    }
    const parts = await this.prisma.part.findMany({
      where: { workId: work.id, state: { in: ['public', 'scheduled'] } },
      orderBy: { position: 'asc' },
      select: { ...partSummary, _count: { select: { likes: true } } },
    });
    const [following, progress] = userId
      ? await Promise.all([
          this.prisma.follow.findUnique({ where: { userId_workId: { userId, workId: work.id } } }),
          this.prisma.readingProgress.findMany({
            where: { userId, part: { workId: work.id } },
            select: { partId: true, paragraphIndex: true, fraction: true, finished: true, updatedAt: true },
          }),
        ])
      : [null, []];
    const nextRelease = parts.find((p) => p.state === 'scheduled');
    const readerCount = await this.uniqueReaders(work.id);
    const isOwner = work.ownerId === userId;
    const social = await this.social.summary(work.id, userId);
    return {
      ...work,
      ...social,
      parts: parts.map((p) => ({
        ...p,
        // Scheduled parts show only their title and time to readers.
        likes: p.state === 'public' ? fewerThanFive(p._count.likes) : undefined,
        _count: undefined,
        progress: progress.find((x) => x.partId === p.id) ?? null,
        // Locked = needs an account under the writer's access setting (doc 13).
        locked: !isOwner && ReadingService.needsAccount(work, p.position, userId),
      })),
      following: !!following,
      followers: fewerThanFive(work._count.follows),
      readers: readerCount < 5 ? 'fewer than 5' : `about ${Math.round(readerCount / 10) * 10}`,
      nextRelease: nextRelease ? { position: nextRelease.position, title: nextRelease.title, publicAt: nextRelease.publicAt } : null,
      isOwner,
    };
  }

  /** The writer's access rule: public = never; members = always for guests; preview = beyond N parts for guests. */
  static needsAccount(work: { access: 'public' | 'preview' | 'members'; previewParts: number }, position: number, userId?: string) {
    if (userId) return false;
    if (work.access === 'members') return true;
    if (work.access === 'preview') return position > work.previewParts;
    return false;
  }

  async part(slug: string, position: number, userId?: string, anonId?: string) {
    const work = await this.prisma.work.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, ownerId: true, title: true, slug: true, rating: true, language: true, access: true, previewParts: true, owner: { select: { handle: true, displayName: true } } },
    });
    if (!work) throw new NotFoundException('No such work');
    const part = await this.prisma.part.findUnique({
      where: { workId_position: { workId: work.id, position } },
      select: { ...partSummary, bodyHtml: true },
    });
    const isOwner = work.ownerId === userId;
    if (!part || (part.state !== 'public' && !isOwner)) {
      if (part?.state === 'unpublished') throw new NotFoundException('This part is unavailable');
      if (part?.state === 'removed') throw new NotFoundException('Removed for breaking the rules');
      throw new NotFoundException('No such part');
    }
    if (!isOwner && ReadingService.needsAccount(work, position, userId)) {
      // 401 with a stable code so the apps can show the sign-in prompt in place.
      throw new UnauthorizedException({ message: 'Sign in to read this part', error: 'account_required' });
    }
    if (work.rating === 'mature' && !isOwner) {
      const ok = userId
        ? (await this.prisma.user.findUnique({ where: { id: userId }, select: { mature: true } }))?.mature
        : false;
      if (!ok) throw new ForbiddenException('Mature work: sign in and opt in');
    }
    const [prev, next] = await Promise.all([
      this.prisma.part.findFirst({
        where: { workId: work.id, position: { lt: position }, state: 'public' },
        orderBy: { position: 'desc' },
        select: { position: true, title: true },
      }),
      this.prisma.part.findFirst({
        where: { workId: work.id, position: { gt: position }, state: { in: ['public', 'scheduled'] } },
        orderBy: { position: 'asc' },
        select: { position: true, title: true, state: true, publicAt: true },
      }),
    ]);
    const progress = userId
      ? await this.prisma.readingProgress.findUnique({ where: { userId_partId: { userId, partId: part.id } } })
      : null;
    const liked = userId
      ? !!(await this.prisma.like.findUnique({ where: { userId_partId: { userId, partId: part.id } } }))
      : false;
    if (part.state === 'public' && !isOwner) await this.countRead(part.id, userId, anonId);
    return { work, part, prev, next, progress, liked };
  }

  /** One read per reader per part per day (doc 16). Opted-out readers count anonymously by date only. */
  private async countRead(partId: string, userId?: string, anonId?: string) {
    if (!userId && !anonId) return;
    const day = new Date(new Date().toISOString().slice(0, 10));
    let uid: string | null = userId ?? null;
    let aid: string | null = userId ? null : anonId ?? null;
    if (userId) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { analyticsOptOut: true } });
      if (u?.analyticsOptOut) {
        uid = null;
        aid = null;
      }
    }
    try {
      await this.prisma.readEvent.create({ data: { partId, userId: uid, anonId: aid, day } });
    } catch {
      // unique violation = already counted today
    }
  }

  private async uniqueReaders(workId: string) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.readEvent.findMany({
      where: { part: { workId }, createdAt: { gte: since } },
      select: { userId: true, anonId: true },
      distinct: ['userId', 'anonId'],
    });
    return rows.length;
  }

  // ------------------------------------------------------------------ actions

  async follow(userId: string, slug: string, on: boolean) {
    const work = await this.prisma.work.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
    if (!work) throw new NotFoundException('No such work');
    if (on) {
      await this.prisma.follow.upsert({
        where: { userId_workId: { userId, workId: work.id } },
        create: { userId, workId: work.id },
        update: {},
      });
    } else {
      await this.prisma.follow.deleteMany({ where: { userId, workId: work.id } });
    }
    return { following: on };
  }

  async like(userId: string, partId: string, on: boolean) {
    const part = await this.prisma.part.findUnique({ where: { id: partId }, select: { state: true } });
    if (!part || part.state !== 'public') throw new NotFoundException('No such part');
    if (on) {
      await this.prisma.like.upsert({
        where: { userId_partId: { userId, partId } },
        create: { userId, partId },
        update: {},
      });
    } else {
      await this.prisma.like.deleteMany({ where: { userId, partId } });
    }
    return { liked: on };
  }

  async saveProgress(userId: string, partId: string, dto: ProgressDto) {
    const part = await this.prisma.part.findUnique({ where: { id: partId }, select: { state: true } });
    if (!part) throw new NotFoundException('No such part');
    return this.prisma.readingProgress.upsert({
      where: { userId_partId: { userId, partId } },
      create: { userId, partId, paragraphIndex: dto.paragraphIndex, fraction: dto.fraction ?? 0, finished: !!dto.finished },
      update: { paragraphIndex: dto.paragraphIndex, fraction: dto.fraction ?? 0, finished: dto.finished ?? undefined },
    });
  }

  /** Followed works with where the reader is in each (doc 05 library). */
  async library(userId: string) {
    const follows = await this.prisma.follow.findMany({
      where: { userId, work: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      select: { work: { select: workCard } },
    });
    const workIds = follows.map((f) => f.work.id);
    const progress = await this.prisma.readingProgress.findMany({
      where: { userId, part: { workId: { in: workIds } } },
      select: { partId: true, finished: true, paragraphIndex: true, fraction: true, updatedAt: true, part: { select: { workId: true, position: true, title: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const items = follows.map(({ work }) => {
      const mine = progress.filter((p) => p.part.workId === work.id);
      const current = mine[0] ?? null;
      const finishedCount = mine.filter((p) => p.finished).length;
      const total = work._count.parts;
      return {
        work,
        current: current ? { position: current.part.position, title: current.part.title, paragraphIndex: current.paragraphIndex, fraction: current.fraction, finished: current.finished, updatedAt: current.updatedAt } : null,
        finishedParts: finishedCount,
        totalParts: total,
        unread: Math.max(0, total - finishedCount),
        done: total > 0 && finishedCount >= total && work.status === 'completed',
      };
    });
    const continueReading = items
      .filter((i) => i.current && !i.done)
      .sort((a, b) => (b.current!.updatedAt.getTime() - a.current!.updatedAt.getTime()))
      .slice(0, 1)[0] ?? null;
    return { items, continueReading };
  }

  // ----------------------------------------------------------------- comments

  async comments(partId: string, viewerId?: string) {
    // Blocks hide comments in both directions (doc 10 harassment rule).
    const hidden = viewerId ? await this.moderation.blockedIds(viewerId) : [];
    const rows = await this.prisma.comment.findMany({
      where: { partId, hiddenAt: null, ...(hidden.length ? { userId: { notIn: hidden } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, parentId: true, body: true, createdAt: true, user: { select: { handle: true, displayName: true } } },
    });
    return rows;
  }

  async addComment(userId: string, partId: string, dto: CommentDto) {
    const part = await this.prisma.part.findUnique({ where: { id: partId }, select: { state: true } });
    if (!part || part.state !== 'public') throw new NotFoundException('No such part');
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: dto.parentId }, select: { partId: true, parentId: true } });
      if (!parent || parent.partId !== partId) throw new BadRequestException('Bad parent');
      if (parent.parentId) throw new BadRequestException('Only one level of replies');
    }
    // New accounts: no links in comments for 7 days (doc 10 spam rule).
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
    if (Date.now() - u.createdAt.getTime() < 7 * 86_400_000 && /https?:\/\//i.test(dto.body)) {
      throw new BadRequestException('New accounts cannot post links yet');
    }
    return this.prisma.comment.create({
      data: { userId, partId, parentId: dto.parentId, body: dto.body.trim() },
      select: { id: true, parentId: true, body: true, createdAt: true, user: { select: { handle: true, displayName: true } } },
    });
  }
}
