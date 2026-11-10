import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Part, PartState, Prisma, Work, WorkKind } from '@prisma/client';
import { randomBytes } from 'crypto';
import { docFromText, poemFromText, PMNode, readMinutes, render } from '../content/prosemirror';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartDto, CreateWorkDto, MovePartDto, SaveDraftDto, UpdatePartDto, UpdateWorkDto } from './dto/work.dto';
import { StorageService } from '../storage/storage.service';
import * as fs from 'node:fs/promises';
import { nextSlots } from './release/slots';

/** States that count as "released" for the gap rule (doc 14 §2). */
const RELEASED: PartState[] = ['public', 'unpublished', 'removed'];
const QUEUED: PartState[] = ['ready', 'scheduled'];

export const partSummary = {
  id: true,
  workId: true,
  position: true,
  title: true,
  kind: true,
  state: true,
  wordCount: true,
  readMinutes: true,
  version: true,
  publicAt: true,
  releasedAt: true,
  updatedAt: true,
  volume: true,
  audioSeconds: true,
  audioMime: true,
} satisfies Prisma.PartSelect;

/** Kinds whose parts are poems. */
export const POEM_KINDS: WorkKind[] = ['poem', 'poem_collection'];
/** Kinds that may carry audio narration. */
export const BOOK_KINDS: WorkKind[] = ['book', 'book_collection'];
const AUDIO_MIME = new Set(['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/wav', 'audio/x-wav', 'audio/flac']);

@Injectable()
export class WorksService {
  private readonly logger = new Logger(WorksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // ------------------------------------------------------------------ works

  async create(ownerId: string, dto: CreateWorkDto) {
    const slug = await this.uniqueSlug(dto.title);
    const kind = dto.kind ?? 'book';
    return this.prisma.work.create({
      data: {
        ownerId,
        slug,
        title: dto.title.trim(),
        synopsis: dto.synopsis?.trim() ?? '',
        language: dto.language,
        kind,
        volumes: kind === 'book_collection' ? (dto.volumes ?? []).map((v) => v.trim()).filter(Boolean) : [],
        genre: dto.genre,
        tags: dto.tags ?? [],
        rating: dto.rating ?? 'general',
        access: dto.access ?? 'public',
        previewParts: dto.previewParts ?? 10,
      },
    });
  }

  listMine(ownerId: string) {
    return this.prisma.work.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { parts: true, follows: true } },
      },
    });
  }

  async getMine(ownerId: string, workId: string) {
    const work = await this.owned(ownerId, workId);
    const parts = await this.prisma.part.findMany({
      where: { workId },
      orderBy: { position: 'asc' },
      select: { ...partSummary, draftJson: true },
    });
    const next = nextSlots(work, new Date(), 1)[0] ?? null;
    return {
      ...work,
      parts: parts.map((p) => ({ ...p, hasDraft: p.draftJson != null, draftJson: undefined })),
      nextSlot: next,
      followers: await this.prisma.follow.count({ where: { workId } }),
    };
  }

  async update(ownerId: string, workId: string, dto: UpdateWorkDto) {
    const work = await this.owned(ownerId, workId);
    if (dto.language && dto.language !== work.language) {
      const publicCount = await this.prisma.part.count({ where: { workId, state: 'public' } });
      if (publicCount > 0) {
        throw new BadRequestException('Language can only change while no part is public');
      }
    }
    const data: Prisma.WorkUpdateInput = { ...dto };
    const kind = dto.kind ?? work.kind;
    if (dto.kind && dto.kind !== work.kind) {
      const [partCount, withAudio] = await Promise.all([
        this.prisma.part.count({ where: { workId } }),
        this.prisma.part.count({ where: { workId, audioKey: { not: null } } }),
      ]);
      if (dto.kind === 'poem' && partCount > 1) throw new BadRequestException('A single poem has one part; make it a poem collection or delete the extra parts');
      if (POEM_KINDS.includes(dto.kind) && withAudio > 0) throw new BadRequestException('Remove the audio from its parts before turning this into a poem');
      if (POEM_KINDS.includes(dto.kind)) await this.prisma.part.updateMany({ where: { workId }, data: { kind: 'poem' } });
      else await this.prisma.part.updateMany({ where: { workId, kind: 'poem' }, data: { kind: 'chapter' } });
    }
    if (kind !== 'book_collection') {
      data.volumes = [];
      await this.prisma.part.updateMany({ where: { workId, volume: { not: 1 } }, data: { volume: 1 } });
    } else if (dto.volumes) {
      data.volumes = dto.volumes.map((v) => v.trim()).filter(Boolean);
    }
    await this.prisma.work.update({ where: { id: workId }, data });
    await this.recomputeSchedule(workId);
    return this.getMine(ownerId, workId);
  }

  async remove(ownerId: string, workId: string) {
    await this.owned(ownerId, workId);
    // Soft delete; a nightly job purges after the 14-day retention (doc 14 §4).
    await this.prisma.work.update({ where: { id: workId }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  // ------------------------------------------------------------------ parts

  async createPart(ownerId: string, workId: string, dto: CreatePartDto) {
    const work = await this.owned(ownerId, workId);
    const last = await this.prisma.part.aggregate({ where: { workId }, _max: { position: true }, _count: true });
    if (work.kind === 'poem' && last._count > 0) {
      throw new BadRequestException('A single poem has exactly one part; change the work to a poem collection to add more');
    }
    const poem = POEM_KINDS.includes(work.kind);
    return this.prisma.part.create({
      data: {
        workId: work.id,
        position: (last._max.position ?? 0) + 1,
        title: dto.title.trim(),
        kind: poem ? 'poem' : dto.kind && dto.kind !== 'poem' ? dto.kind : 'chapter',
        volume: work.kind === 'book_collection' ? Math.min(dto.volume ?? 1, Math.max(1, work.volumes.length)) : 1,
      },
      select: partSummary,
    });
  }

  async getPart(ownerId: string, partId: string) {
    const part = await this.ownedPart(ownerId, partId);
    return part;
  }

  async updatePart(ownerId: string, partId: string, dto: UpdatePartDto) {
    const part = await this.ownedPart(ownerId, partId);
    const poem = POEM_KINDS.includes(part.work.kind);
    const data: Prisma.PartUpdateInput = {};
    if (dto.title) data.title = dto.title.trim();
    if (dto.kind) data.kind = poem ? 'poem' : dto.kind === 'poem' ? 'chapter' : dto.kind;
    if (dto.volume !== undefined) {
      data.volume = part.work.kind === 'book_collection' ? Math.min(dto.volume, Math.max(1, part.work.volumes.length)) : 1;
    }
    await this.prisma.part.update({ where: { id: partId }, data });
    return this.ownedPart(ownerId, partId);
  }

  // ------------------------------------------------------------------ audio

  /** Attach (or replace) the narration of a book part. The file is a multer temp file on disk. */
  async setAudio(ownerId: string, partId: string, file: Express.Multer.File | undefined, seconds?: number) {
    if (!file) throw new BadRequestException('Attach an audio file in the "file" field');
    const cleanup = () => fs.unlink(file.path).catch(() => undefined);
    try {
      const part = await this.ownedPart(ownerId, partId);
      if (!BOOK_KINDS.includes(part.work.kind)) throw new BadRequestException('Audio can only be attached to the parts of a book');
      const mime = (file.mimetype || '').split(';')[0].toLowerCase();
      if (!AUDIO_MIME.has(mime)) throw new BadRequestException(`Unsupported audio type ${mime || '(unknown)'}; use MP3, M4A/AAC, OGG or WAV`);
      const ext = mime.includes('mpeg') || mime.includes('mp3') ? 'mp3' : mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('webm') ? 'webm' : mime.includes('flac') ? 'flac' : 'wav';
      const key = `audio/${part.workId}/${partId}-${Date.now().toString(36)}.${ext}`;
      await this.storage.putFile(key, file.path, mime);
      const previous = (await this.prisma.part.findUnique({ where: { id: partId }, select: { audioKey: true } }))?.audioKey;
      await this.prisma.part.update({
        where: { id: partId },
        data: { audioKey: key, audioMime: mime, audioBytes: file.size, audioSeconds: seconds ?? null },
      });
      if (previous && previous !== key) await this.storage.delete(previous);
      this.logger.log(`audio for part ${partId}: ${key} (${file.size} bytes)`);
      return this.ownedPart(ownerId, partId);
    } finally {
      await cleanup();
    }
  }

  async removeAudio(ownerId: string, partId: string) {
    await this.ownedPart(ownerId, partId);
    const current = await this.prisma.part.findUnique({ where: { id: partId }, select: { audioKey: true } });
    await this.prisma.part.update({ where: { id: partId }, data: { audioKey: null, audioMime: null, audioBytes: null, audioSeconds: null } });
    if (current?.audioKey) await this.storage.delete(current.audioKey);
    return this.ownedPart(ownerId, partId);
  }

  /** Autosave target. Never touches what readers see. */
  async saveDraft(ownerId: string, partId: string, dto: SaveDraftDto) {
    const part = await this.ownedPart(ownerId, partId);
    if (part.state === 'removed') throw new ForbiddenException('Part was removed by a moderator');
    let draftJson: Prisma.InputJsonValue | undefined;
    if (dto.draftJson) draftJson = dto.draftJson as Prisma.InputJsonValue;
    else if (dto.text != null) {
      draftJson = (part.kind === 'poem' ? poemFromText(dto.text) : docFromText(dto.text)) as unknown as Prisma.InputJsonValue;
    }
    return this.prisma.part.update({
      where: { id: partId },
      data: { title: dto.title?.trim(), draftJson },
      select: { ...partSummary, draftJson: true },
    });
  }

  /** "Publish changes": the working copy becomes the live text (doc 14 §3). */
  async publishChanges(ownerId: string, partId: string) {
    const part = await this.ownedPart(ownerId, partId);
    if (!part.draftJson) throw new BadRequestException('Nothing to publish: the part has no text yet');
    const rendered = render(part.draftJson as unknown as PMNode);
    if (rendered.wordCount === 0) throw new BadRequestException('The part is empty');
    const version = part.version + 1;
    const [updated] = await this.prisma.$transaction([
      this.prisma.part.update({
        where: { id: partId },
        data: {
          bodyJson: part.draftJson as Prisma.InputJsonValue,
          bodyHtml: rendered.html,
          wordCount: rendered.wordCount,
          readMinutes: readMinutes(rendered.wordCount),
          version,
        },
        select: partSummary,
      }),
      this.prisma.partVersion.create({
        data: { partId, version, bodyJson: part.draftJson as Prisma.InputJsonValue },
      }),
    ]);
    return updated;
  }

  /** draft -> ready: joins the release queue. Publishes the working copy first if needed. */
  async markReady(ownerId: string, partId: string) {
    let part = await this.ownedPart(ownerId, partId);
    if (part.state !== 'draft') throw new BadRequestException(`Part is ${part.state}, not draft`);
    if (!part.bodyJson || part.draftJson) {
      await this.publishChanges(ownerId, partId);
      part = await this.ownedPart(ownerId, partId);
    }
    await this.prisma.part.update({ where: { id: partId }, data: { state: 'ready' } });
    await this.recomputeSchedule(part.workId);
    return this.ownedPart(ownerId, partId);
  }

  /** ready/scheduled -> draft: leaves the queue; later parts move up. */
  async unready(ownerId: string, partId: string) {
    const part = await this.ownedPart(ownerId, partId);
    if (!QUEUED.includes(part.state)) throw new BadRequestException(`Part is ${part.state}`);
    await this.prisma.part.update({ where: { id: partId }, data: { state: 'draft', publicAt: null } });
    await this.recomputeSchedule(part.workId);
    return this.ownedPart(ownerId, partId);
  }

  /** "Publish now" applies only to the next part in order (doc 14 §2). */
  async publishNow(ownerId: string, partId: string) {
    const part = await this.ownedPart(ownerId, partId);
    if (!QUEUED.includes(part.state)) throw new BadRequestException('Only a ready part can be published');
    const earlierWaiting = await this.prisma.part.count({
      where: { workId: part.workId, position: { lt: part.position }, state: { notIn: RELEASED } },
    });
    if (earlierWaiting > 0) {
      throw new BadRequestException('An earlier part is still waiting; parts release in order');
    }
    // "Publish now" sets publicAt to now even if a slot had been assigned (doc 14 §2).
    await this.goPublic([part.id], new Date(), true);
    await this.recomputeSchedule(part.workId);
    return this.ownedPart(ownerId, partId);
  }

  /** All-at-once: every ready part gets the same publicAt, now. */
  async publishAll(ownerId: string, workId: string) {
    const work = await this.owned(ownerId, workId);
    const parts = await this.prisma.part.findMany({
      where: { workId, state: { in: QUEUED } },
      orderBy: { position: 'asc' },
    });
    if (!parts.length) throw new BadRequestException('No ready parts');
    const firstWaiting = await this.prisma.part.findFirst({
      where: { workId, state: 'draft', position: { lt: parts[parts.length - 1].position } },
    });
    if (firstWaiting) {
      throw new BadRequestException(`Part ${firstWaiting.position} is still a draft; finish or move it first`);
    }
    await this.goPublic(parts.map((p) => p.id), new Date(), true);
    return this.getMine(ownerId, work.id);
  }

  async unpublish(ownerId: string, partId: string) {
    const part = await this.ownedPart(ownerId, partId);
    if (part.state !== 'public') throw new BadRequestException('Only a public part can be unpublished');
    await this.prisma.part.update({ where: { id: partId }, data: { state: 'unpublished' } });
    return this.ownedPart(ownerId, partId);
  }

  async republish(ownerId: string, partId: string) {
    const part = await this.ownedPart(ownerId, partId);
    if (part.state !== 'unpublished') throw new BadRequestException('Part is not unpublished');
    await this.prisma.part.update({ where: { id: partId }, data: { state: 'public' } });
    return this.ownedPart(ownerId, partId);
  }

  async movePart(ownerId: string, partId: string, dto: MovePartDto) {
    const part = await this.ownedPart(ownerId, partId);
    if (RELEASED.includes(part.state)) throw new BadRequestException('Released parts keep their position');
    const parts = await this.prisma.part.findMany({
      where: { workId: part.workId },
      orderBy: { position: 'asc' },
      select: { id: true, state: true },
    });
    const lastReleased = parts.map((p) => RELEASED.includes(p.state)).lastIndexOf(true);
    const target = Math.min(Math.max(dto.position, lastReleased + 2), parts.length);
    const ids = parts.map((p) => p.id).filter((id) => id !== partId);
    ids.splice(target - 1, 0, partId);
    await this.prisma.$transaction([
      // Two passes avoid the unique (workId, position) collision mid-reorder.
      ...ids.map((id, i) => this.prisma.part.update({ where: { id }, data: { position: -(i + 1) } })),
      ...ids.map((id, i) => this.prisma.part.update({ where: { id }, data: { position: i + 1 } })),
    ]);
    await this.recomputeSchedule(part.workId);
    return this.ownedPart(ownerId, partId);
  }

  async deletePart(ownerId: string, partId: string) {
    const part = await this.ownedPart(ownerId, partId);
    await this.prisma.part.delete({ where: { id: partId } });
    // Numbering closes up (doc 14 §4).
    const rest = await this.prisma.part.findMany({
      where: { workId: part.workId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await this.prisma.$transaction([
      ...rest.map((p, i) => this.prisma.part.update({ where: { id: p.id }, data: { position: -(i + 1) } })),
      ...rest.map((p, i) => this.prisma.part.update({ where: { id: p.id }, data: { position: i + 1 } })),
    ]);
    await this.recomputeSchedule(part.workId);
    return { ok: true };
  }

  // -------------------------------------------------------------- scheduling

  /**
   * Assign slots to the contiguous run of queued parts after the last released
   * one. A draft stops the queue (gaps block). Slots are always computed from
   * now, so a skipped slot is simply never banked.
   */
  async recomputeSchedule(workId: string) {
    const work = await this.prisma.work.findUniqueOrThrow({ where: { id: workId } });
    const parts = await this.prisma.part.findMany({
      where: { workId },
      orderBy: { position: 'asc' },
      select: { id: true, state: true, publicAt: true },
    });
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    const hasSlots = work.releasePlan === 'daily' || work.releasePlan === 'weekly';

    let cursor = new Date();
    let blocked = false;
    for (const p of parts) {
      if (RELEASED.includes(p.state)) continue;
      if (p.state === 'draft') {
        blocked = true;
        continue;
      }
      // ready or scheduled
      if (!hasSlots || blocked) {
        if (p.state !== 'ready' || p.publicAt) {
          updates.push(this.prisma.part.update({ where: { id: p.id }, data: { state: 'ready', publicAt: null } }));
        }
        continue;
      }
      const slot = nextSlots(work, cursor, 1)[0];
      if (!slot) continue;
      cursor = slot;
      if (p.state !== 'scheduled' || p.publicAt?.getTime() !== slot.getTime()) {
        updates.push(this.prisma.part.update({ where: { id: p.id }, data: { state: 'scheduled', publicAt: slot } }));
      }
    }
    if (updates.length) await this.prisma.$transaction(updates);
  }

  /**
   * Make parts public and stamp the work. Idempotent per part. The sweep keeps
   * the scheduled publicAt (the slot); manual publishing overwrites it with now.
   */
  async goPublic(partIds: string[], at: Date, overwritePublicAt = false) {
    if (!partIds.length) return;
    const parts = await this.prisma.part.findMany({
      where: { id: { in: partIds }, state: { in: QUEUED } },
      select: { id: true, workId: true, publicAt: true },
    });
    if (!parts.length) return;
    await this.prisma.$transaction([
      this.prisma.part.updateMany({
        where: { id: { in: parts.map((p) => p.id) } },
        data: { state: 'public', releasedAt: at },
      }),
      ...parts
        .filter((p) => overwritePublicAt || !p.publicAt)
        .map((p) => this.prisma.part.update({ where: { id: p.id }, data: { publicAt: at } })),
    ]);
    const workIds = [...new Set(parts.map((p) => p.workId))];
    for (const workId of workIds) {
      const work = await this.prisma.work.findUnique({ where: { id: workId } });
      if (!work) continue;
      await this.prisma.work.update({
        where: { id: workId },
        data: {
          firstPublicAt: work.firstPublicAt ?? at,
          lastPublicAt: at,
          status: work.status === 'draft' ? 'ongoing' : work.status,
        },
      });
    }
    this.logger.log(`released ${parts.length} part(s)`);
    // Fan out "new part" to followers; failures must never block a release.
    for (const p of parts) {
      await this.notifications.partReleased(p.id).catch((e) => this.logger.warn(`notify failed: ${(e as Error).message}`));
    }
  }

  // ---------------------------------------------------------------- helpers

  async owned(ownerId: string, workId: string): Promise<Work> {
    const work = await this.prisma.work.findFirst({ where: { id: workId, deletedAt: null } });
    if (!work) throw new NotFoundException('No such work');
    if (work.ownerId !== ownerId) throw new ForbiddenException('Not your work');
    return work;
  }

  async ownedPart(ownerId: string, partId: string): Promise<Part & { work: Work }> {
    const part = await this.prisma.part.findUnique({ where: { id: partId }, include: { work: true } });
    if (!part || part.work.deletedAt) throw new NotFoundException('No such part');
    if (part.work.ownerId !== ownerId) throw new ForbiddenException('Not your work');
    return part;
  }

  private async uniqueSlug(title: string) {
    const base =
      title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'kazi';
    for (let i = 0; i < 5; i++) {
      const slug = i === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`;
      if (!(await this.prisma.work.findUnique({ where: { slug } }))) return slug;
    }
    return `${base}-${randomBytes(4).toString('hex')}`;
  }
}
