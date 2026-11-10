import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreatePartDto, CreateWorkDto, MovePartDto, SaveDraftDto, UpdateWorkDto } from './dto/work.dto';
import { WorksService } from './works.service';

/** Writer studio endpoints. Everything here is owner-only. */
@ApiTags('studio')
@ApiBearerAuth()
@Controller('studio')
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @ApiOperation({ summary: 'My works' })
  @Get('works')
  list(@CurrentUser() u: AuthUser) {
    return this.works.listMine(u.id);
  }

  @ApiOperation({ summary: 'Create a work (single or series)' })
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
