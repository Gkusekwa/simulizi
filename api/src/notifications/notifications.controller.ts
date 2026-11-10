import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOperation({ summary: 'My notifications, newest first, with the unread count' })
  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.notifications.list(u.id);
  }

  @ApiOperation({ summary: 'Mark all as read' })
  @Post('read')
  readAll(@CurrentUser() u: AuthUser) {
    return this.notifications.markRead(u.id);
  }

  @ApiOperation({ summary: 'Mark one as read' })
  @Post(':id/read')
  readOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(u.id, id);
  }
}
