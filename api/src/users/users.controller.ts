import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in account' })
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile and settings' })
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Public()
  @ApiOperation({ summary: 'Public writer profile by handle' })
  @Get('writers/:handle')
  profile(@Param('handle') handle: string) {
    return this.users.profile(handle);
  }
}
