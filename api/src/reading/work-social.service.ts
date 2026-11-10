import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommentDto } from './dto/reading.dto';

const MIN_RATINGS_SHOWN = 5;

/** Likes, ratings and comments on a whole work (publication), doc 05. */
@Injectable()
export class WorkSocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  private async workId(slug: string) {
    const w = await this.prisma.work.findFirst({ where: { slug, deletedAt: null, firstPublicAt: { not: null } }, select: { id: true } });
    if (!w) throw new NotFoundException('No such work');
    return w.id;
  }

  /** Everything the work page shows: counts (hidden under 5), my like, star rating. Named `stars` so it never shadows Work.rating (the content rating). */
  async summary(workId: string, userId?: string) {
    const [likes, agg, mine, myLike] = await Promise.all([
      this.prisma.workLike.count({ where: { workId } }),
      this.prisma.rating.aggregate({ where: { workId }, _avg: { stars: true }, _count: { stars: true } }),
      userId ? this.prisma.rating.findUnique({ where: { userId_workId: { userId, workId } } }) : null,
      userId ? this.prisma.workLike.findUnique({ where: { userId_workId: { userId, workId } } }) : null,
    ]);
    const count = agg._count.stars;
    return {
      likes: likes < 5 ? 'fewer than 5' : likes,
      liked: !!myLike,
      stars: {
        average: count >= MIN_RATINGS_SHOWN ? Math.round((agg._avg.stars ?? 0) * 10) / 10 : null,
        count: count >= MIN_RATINGS_SHOWN ? count : null,
        mine: mine?.stars ?? null,
        canRate: userId ? await this.hasFinishedAPart(userId, workId) : false,
      },
    };
  }

  private async hasFinishedAPart(userId: string, workId: string) {
    const done = await this.prisma.readingProgress.findFirst({ where: { userId, finished: true, part: { workId } }, select: { partId: true } });
    return !!done;
  }

  async like(userId: string, slug: string, on: boolean) {
    const workId = await this.workId(slug);
    if (on) {
      await this.prisma.workLike.upsert({ where: { userId_workId: { userId, workId } }, create: { userId, workId }, update: {} });
    } else {
      await this.prisma.workLike.deleteMany({ where: { userId, workId } });
    }
    return { liked: on };
  }

  async rate(userId: string, slug: string, stars: number) {
    const workId = await this.workId(slug);
    if (!(await this.hasFinishedAPart(userId, workId))) {
      throw new BadRequestException('Finish at least one part before rating');
    }
    const r = await this.prisma.rating.upsert({
      where: { userId_workId: { userId, workId } },
      create: { userId, workId, stars },
      update: { stars },
    });
    return { stars: r.stars };
  }

  async unrate(userId: string, slug: string) {
    const workId = await this.workId(slug);
    await this.prisma.rating.deleteMany({ where: { userId, workId } });
    return { stars: null };
  }

  async comments(slug: string, viewerId?: string) {
    const workId = await this.workId(slug);
    const hidden = viewerId ? await this.moderation.blockedIds(viewerId) : [];
    return this.prisma.comment.findMany({
      where: { workId, hiddenAt: null, ...(hidden.length ? { userId: { notIn: hidden } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, parentId: true, body: true, createdAt: true, user: { select: { handle: true, displayName: true } } },
    });
  }

  async addComment(userId: string, slug: string, dto: CommentDto) {
    const workId = await this.workId(slug);
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: dto.parentId }, select: { workId: true, parentId: true } });
      if (!parent || parent.workId !== workId) throw new BadRequestException('Bad parent');
      if (parent.parentId) throw new BadRequestException('Only one level of replies');
    }
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
    if (Date.now() - u.createdAt.getTime() < 7 * 86_400_000 && /https?:\/\//i.test(dto.body)) {
      throw new BadRequestException('New accounts cannot post links yet');
    }
    return this.prisma.comment.create({
      data: { userId, workId, parentId: dto.parentId, body: dto.body.trim() },
      select: { id: true, parentId: true, body: true, createdAt: true, user: { select: { handle: true, displayName: true } } },
    });
  }
}
