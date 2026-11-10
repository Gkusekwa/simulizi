import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Postgres full-text search on title, synopsis, tags and writer handle with the
 * `simple` dictionary (doc 14 §7). Swahili stemming is a 1b question; until
 * then a prefix match on each word keeps "hadith" finding "hadithi".
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async works(q: string, opts: { language?: 'sw' | 'en'; mature: boolean; limit?: number }) {
    const terms = q
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .slice(0, 8);
    if (!terms.length) return [];
    const tsquery = terms.map((t) => `${t}:*`).join(' & ');
    const rows = await this.prisma.$queryRaw<{ id: string; rank: number }[]>`
      SELECT w.id, ts_rank(w."searchVector", to_tsquery('simple', ${tsquery})) AS rank
      FROM "Work" w
      WHERE w."deletedAt" IS NULL AND w."firstPublicAt" IS NOT NULL
        AND w."searchVector" @@ to_tsquery('simple', ${tsquery})
        ${opts.language ? Prisma.sql`AND w.language = ${opts.language}::"Language"` : Prisma.empty}
        ${opts.mature ? Prisma.empty : Prisma.sql`AND w.rating <> 'mature'::"ContentRating"`}
      ORDER BY rank DESC, w."lastPublicAt" DESC
      LIMIT ${opts.limit ?? 20}`;
    if (!rows.length) return [];
    const works = await this.prisma.work.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: {
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
      },
    });
    const order = new Map(rows.map((r, i) => [r.id, i]));
    return works.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }
}
