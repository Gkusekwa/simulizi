import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { DeviceDto, ProgressBatchDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@Controller()
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @ApiOperation({ summary: 'Delta sync of followed works for the app' })
  @ApiQuery({ name: 'since', required: false, description: 'Cursor from the previous pull (ISO)' })
  @Get('sync')
  pull(@CurrentUser() u: AuthUser, @Query('since') since?: string) {
    let d: Date | undefined;
    if (since) {
      d = new Date(since);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('since must be an ISO date');
    }
    return this.sync.pull(u.id, d);
  }

  @ApiOperation({ summary: 'Push the outbox of reading positions' })
  @Post('sync/progress')
  pushProgress(@CurrentUser() u: AuthUser, @Body() dto: ProgressBatchDto) {
    return this.sync.pushProgress(u.id, dto);
  }

  @ApiOperation({ summary: 'Register a push token for this device' })
  @Post('devices')
  register(@CurrentUser() u: AuthUser, @Body() dto: DeviceDto) {
    return this.sync.registerDevice(u.id, dto.token, dto.platform ?? 'android');
  }

  @ApiOperation({ summary: 'Remove a push token (sign-out)' })
  @Delete('devices/:token')
  remove(@CurrentUser() u: AuthUser, @Param('token') token: string) {
    return this.sync.removeDevice(u.id, token);
  }
}
