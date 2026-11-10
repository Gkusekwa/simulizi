import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Language, Prisma } from '@prisma/client';
import { parseEpub } from '../content/epub';
import { PrismaService } from '../prisma/prisma.service';
import { WorksService } from './works.service';

const MAX_BYTES = 25 * 1024 * 1024;

/** Upload a work: EPUB -> a new work (or appended parts) in draft, ready to schedule. */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly works: WorksService,
  ) {}

  private parse(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Attach an .epub file as "file"');
    if (file.size > MAX_BYTES) throw new BadRequestException('EPUB larger than 25 MB');
    const isEpub = /\.epub$/i.test(file.originalname) || file.mimetype === 'application/epub+zip';
    if (!isEpub) throw new BadRequestException('Only .epub files are supported for now');
    try {
      return parseEpub(file.buffer);
    } catch (e) {
      throw new BadRequestException(`Could not read the EPUB: ${(e as Error).message}`);
    }
  }

  private language(raw: string | null, fallback: Language): Language {
    const code = (raw ?? '').toLowerCase().slice(0, 2);
    return code === 'sw' || code === 'en' ? code : fallback;
  }

  /** New work from the book's metadata, every chapter a draft part in order. */
  async createWork(ownerId: string, file: Express.Multer.File | undefined, opts: { language?: Language }) {
    const book = this.parse(file);
    if (!book.chapters.length) throw new BadRequestException('No chapters with text were found in the EPUB');
    const work = await this.works.create(ownerId, {
      title: book.title,
      synopsis: book.description ?? undefined,
      language: this.language(book.language, opts.language ?? 'sw'),
      kind: book.chapters.length > 1 ? 'series' : 'single',
    });
    const parts = await this.appendChapters(work.id, 0, book.chapters);
    this.logger.log(`imported "${book.title}": ${parts} part(s), ${book.skipped} skipped`);
    return { ...(await this.works.getMine(ownerId, work.id)), imported: parts, skipped: book.skipped, author: book.author };
  }

  /** Append the book's chapters to an existing work as draft parts. */
  async appendToWork(ownerId: string, workId: string, file: Express.Multer.File | undefined) {
    const work = await this.works.owned(ownerId, workId);
    const book = this.parse(file);
    if (!book.chapters.length) throw new BadRequestException('No chapters with text were found in the EPUB');
    const last = await this.prisma.part.aggregate({ where: { workId: work.id }, _max: { position: true } });
    const parts = await this.appendChapters(work.id, last._max.position ?? 0, book.chapters);
    return { ...(await this.works.getMine(ownerId, work.id)), imported: parts, skipped: book.skipped };
  }

  private async appendChapters(workId: string, from: number, chapters: { title: string; doc: unknown }[]) {
    await this.prisma.part.createMany({
      data: chapters.map((c, i) => ({
        workId,
        position: from + i + 1,
        title: c.title,
        kind: 'chapter',
        draftJson: c.doc as Prisma.InputJsonValue,
      })),
    });
    return chapters.length;
  }
}
