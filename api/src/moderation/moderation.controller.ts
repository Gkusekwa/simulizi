import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ReportDto, ResolveDto } from './dto/moderation.dto';
import { ModerationService } from './moderation.service';

@ApiTags('moderation')
@ApiBearerAuth()
@Controller()
export class ModerationController {
  constructor(private readonly mod: ModerationService) {}

  @ApiOperation({ summary: 'Report a part, comment or account' })
  @Post('reports')
  report(@CurrentUser() u: AuthUser, @Body() dto: ReportDto) {
    return this.mod.report(u.id, dto);
  }

  @ApiOperation({ summary: 'Block a user by handle' })
  @Put('blocks/:handle')
  block(@CurrentUser() u: AuthUser, @Param('handle') handle: string) {
    return this.mod.block(u.id, handle, true);
  }

  @ApiOperation({ summary: 'Unblock a user' })
  @Delete('blocks/:handle')
  unblock(@CurrentUser() u: AuthUser, @Param('handle') handle: string) {
    return this.mod.block(u.id, handle, false);
  }

  @ApiOperation({ summary: 'Users I have blocked' })
  @Get('blocks')
  blocked(@CurrentUser() u: AuthUser) {
    return this.mod.blocked(u.id);
  }

  @Roles('moderator', 'admin')
  @ApiOperation({ summary: 'Moderator queue (urgent first, oldest first)' })
  @Get('mod/reports')
  queue(@Query('status') status?: ReportStatus) {
    return this.mod.queue(status && ['open', 'upheld', 'rejected'].includes(status) ? status : 'open');
  }

  @Roles('moderator', 'admin')
  @ApiOperation({ summary: 'Uphold (hide + strike) or reject a report' })
  @Post('mod/reports/:id/resolve')
  resolve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ResolveDto) {
    return this.mod.resolve(u.id, id, dto);
  }
}
