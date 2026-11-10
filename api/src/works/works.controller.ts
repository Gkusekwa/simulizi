import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { RawResponse } from '../common/response.interceptor';
import { AudioMetaDto, CreatePartDto, CreateWorkDto, MovePartDto, SaveDraftDto, UpdatePartDto, UpdateWorkDto } from './dto/work.dto';
import { diskStorage } from 'multer';
import { tmpdir } from 'node:os';
import { ExportService } from './export.service';
import { ImportService } from './import.service';
import { StatsService } from './stats.service';
import { WorksService } from './works.service';

const upload = FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
// Audio is spooled to disk and streamed to object storage; never held in memory.
const audioUpload = FileInterceptor('file', { storage: diskStorage({ destination: tmpdir() }), limits: { fileSize: 400 * 1024 * 1024, files: 1 } });

/** Writer studio endpoints. Everything here is owner-only. */
@ApiTags('studio')
@ApiBearerAuth()
@Controller('studio')
export class WorksController {
  constructor(
    private readonly works: WorksService,
    private readonly stats: StatsService,
    private readonly exporter: ExportService,
    private readonly importer: ImportService,
  ) {}

  @ApiOperation({ summary: 'Upload an EPUB: creates a work with one draft part per chapter' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(upload)
  @Post('works/import')
  importWork(@CurrentUser() u: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Query('language') language?: string) {
    return this.importer.createWork(u.id, file, { language: language === 'en' || language === 'sw' ? (language as Language) : undefined });
  }

  @ApiOperation({ summary: 'Upload an EPUB: appends its chapters to this work as drafts' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(upload)
  @Post('works/:id/import')
  importInto(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.importer.appendToWork(u.id, id, file);
  }

  @ApiOperation({ summary: 'Reads, unique readers and followers for a work' })
  @Get('works/:id/stats')
  workStats(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.stats.forWork(u.id, id);
  }

  @RawResponse()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Content-Disposition', 'attachment')
  @ApiOperation({ summary: 'Export the whole work as one HTML file' })
  @Get('works/:id/export.html')
  exportHtml(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.exporter.html(u.id, id);
  }

  @RawResponse()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Content-Disposition', 'attachment')
  @ApiOperation({ summary: 'Export the whole work as plain text' })
  @Get('works/:id/export.txt')
  exportText(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.exporter.text(u.id, id);
  }

  @ApiOperation({ summary: 'My works' })
  @Get('works')
  list(@CurrentUser() u: AuthUser) {
    return this.works.listMine(u.id);
  }

  @ApiOperation({ summary: 'Create a work (poem, poem collection, book or book collection)' })
  @Post('works')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateWorkDto) {
    return this.works.create(u.id, dto);
  }

  @ApiOperation({ summary: 'A work with all its parts and the next release slot' })
  @Get('works/:id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.getMine(u.id, id);
  }

  @ApiOperation({ summary: 'Update metadata or the release plan' })
  @Patch('works/:id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateWorkDto) {
    return this.works.update(u.id, id, dto);
  }

  @ApiOperation({ summary: 'Delete a work (soft; purged after 14 days)' })
  @Delete('works/:id')
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.remove(u.id, id);
  }

  @ApiOperation({ summary: 'All-at-once: release every ready part now' })
  @Post('works/:id/publish-all')
  publishAll(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.publishAll(u.id, id);
  }

  @ApiOperation({ summary: 'Add a part at the end' })
  @Post('works/:id/parts')
  createPart(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CreatePartDto) {
    return this.works.createPart(u.id, id, dto);
  }

  @ApiOperation({ summary: 'A part with its working copy' })
  @Get('parts/:id')
  getPart(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.getPart(u.id, id);
  }

  @ApiOperation({ summary: 'Rename a part, change its kind or move it to another volume' })
  @Patch('parts/:id')
  updatePart(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdatePartDto) {
    return this.works.updatePart(u.id, id, dto);
  }

  @ApiOperation({ summary: 'Attach or replace the audio narration of a book part (MP3, M4A/AAC, OGG, WAV; up to 400 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, seconds: { type: 'integer' } } } })
  @UseInterceptors(audioUpload)
  @Put('parts/:id/audio')
  setAudio(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() meta: AudioMetaDto) {
    return this.works.setAudio(u.id, id, file, meta.seconds);
  }

  @ApiOperation({ summary: 'Remove the audio narration of a part' })
  @Delete('parts/:id/audio')
  removeAudio(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.removeAudio(u.id, id);
  }

  @ApiOperation({ summary: 'Autosave the working copy' })
  @Put('parts/:id/draft')
  saveDraft(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SaveDraftDto) {
    return this.works.saveDraft(u.id, id, dto);
  }

  @ApiOperation({ summary: 'Publish changes: working copy becomes the live text' })
  @Post('parts/:id/publish-changes')
  publishChanges(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.publishChanges(u.id, id);
  }

  @ApiOperation({ summary: 'Mark ready: join the release queue' })
  @Post('parts/:id/ready')
  ready(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.markReady(u.id, id);
  }

  @ApiOperation({ summary: 'Back to draft: leave the release queue' })
  @Post('parts/:id/unready')
  unready(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.unready(u.id, id);
  }

  @ApiOperation({ summary: 'Publish now (next part in order only)' })
  @Post('parts/:id/publish-now')
  publishNow(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.publishNow(u.id, id);
  }

  @ApiOperation({ summary: 'Unpublish a public part' })
  @Post('parts/:id/unpublish')
  unpublish(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.unpublish(u.id, id);
  }

  @ApiOperation({ summary: 'Republish an unpublished part' })
  @Post('parts/:id/republish')
  republish(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.republish(u.id, id);
  }

  @ApiOperation({ summary: 'Move an unreleased part to a new position' })
  @Post('parts/:id/move')
  move(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: MovePartDto) {
    return this.works.movePart(u.id, id, dto);
  }

  @ApiOperation({ summary: 'Delete a part; numbering closes up' })
  @Delete('parts/:id')
  deletePart(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.works.deletePart(u.id, id);
  }
}
