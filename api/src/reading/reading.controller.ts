import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CommentDto, ProgressDto, RateDto } from './dto/reading.dto';
import { ReadingService } from './reading.service';
import { SearchService } from './search.service';
import { WorkSocialService } from './work-social.service';

@ApiTags('reading')
@Controller()
export class ReadingController {
  constructor(
    private readonly reading: ReadingService,
    private readonly search: SearchService,
    private readonly social: WorkSocialService,
  ) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a work' })
  @Put('works/:slug/like')
  likeWork(@CurrentUser() u: AuthUser, @Param('slug') slug: string) {
    return this.social.like(u.id, slug, true);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlike a work' })
  @Delete('works/:slug/like')
  unlikeWork(@CurrentUser() u: AuthUser, @Param('slug') slug: string) {
    return this.social.like(u.id, slug, false);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate a work 1-5 (after finishing at least one part)' })
  @Put('works/:slug/rating')
  rate(@CurrentUser() u: AuthUser, @Param('slug') slug: string, @Body() dto: RateDto) {
    return this.social.rate(u.id, slug, dto.stars);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove my rating' })
  @Delete('works/:slug/rating')
  unrate(@CurrentUser() u: AuthUser, @Param('slug') slug: string) {
    return this.social.unrate(u.id, slug);
  }

  @Public()
  @ApiOperation({ summary: 'Comments on a work (newest first, one reply level)' })
  @Get('works/:slug/comments')
  workComments(@CurrentUser() u: AuthUser | undefined, @Param('slug') slug: string) {
    return this.social.comments(slug, u?.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Comment on a work' })
  @Post('works/:slug/comments')
  addWorkComment(@CurrentUser() u: AuthUser, @Param('slug') slug: string, @Body() dto: CommentDto) {
    return this.social.addComment(u.id, slug, dto);
  }

  @Public()
  @ApiOperation({ summary: 'Home feed: latest releases and most followed' })
  @Get('discover')
  discover(@CurrentUser() u: AuthUser | undefined, @Query('language') language?: 'sw' | 'en') {
    return this.reading.discover(u?.id, language === 'sw' || language === 'en' ? language : undefined);
  }

  @Public()
  @ApiOperation({ summary: 'Search works by title, synopsis, tags or writer handle' })
  @Get('search')
  async searchWorks(@CurrentUser() u: AuthUser | undefined, @Query('q') q = '', @Query('language') language?: 'sw' | 'en') {
    const mature = await this.reading.canSeeMature(u?.id);
    return this.search.works(q.slice(0, 100), { language: language === 'sw' || language === 'en' ? language : undefined, mature });
  }

  @Public()
  @ApiOperation({ summary: 'Work page: metadata, public parts, next release, follow state' })
  @Get('works/:slug')
  work(@CurrentUser() u: AuthUser | undefined, @Param('slug') slug: string) {
    return this.reading.work(slug, u?.id);
  }

  @Public()
  @ApiOperation({ summary: 'Read a part: rendered HTML, neighbours, progress. Counts a read.' })
  @Get('works/:slug/parts/:position')
  part(
    @CurrentUser() u: AuthUser | undefined,
    @Param('slug') slug: string,
    @Param('position', ParseIntPipe) position: number,
    @Headers('x-anon-id') anonId?: string,
  ) {
    return this.reading.part(slug, position, u?.id, anonId?.slice(0, 64));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a work' })
  @Put('works/:slug/follow')
  follow(@CurrentUser() u: AuthUser, @Param('slug') slug: string) {
    return this.reading.follow(u.id, slug, true);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a work' })
  @Delete('works/:slug/follow')
  unfollow(@CurrentUser() u: AuthUser, @Param('slug') slug: string) {
    return this.reading.follow(u.id, slug, false);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'My library: followed works and where I am in each' })
  @Get('library')
  library(@CurrentUser() u: AuthUser) {
    return this.reading.library(u.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save reading position (paragraph index + fraction)' })
  @Put('parts/:id/progress')
  progress(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ProgressDto) {
    return this.reading.saveProgress(u.id, id, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a part' })
  @Put('parts/:id/like')
  like(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.reading.like(u.id, id, true);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlike a part' })
  @Delete('parts/:id/like')
  unlike(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.reading.like(u.id, id, false);
  }

  @Public()
  @ApiOperation({ summary: 'Comments on a part (newest first, one reply level)' })
  @Get('parts/:id/comments')
  comments(@CurrentUser() u: AuthUser | undefined, @Param('id') id: string) {
    return this.reading.comments(id, u?.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Comment on a part' })
  @Post('parts/:id/comments')
  addComment(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CommentDto) {
    return this.reading.addComment(u.id, id, dto);
  }
}
