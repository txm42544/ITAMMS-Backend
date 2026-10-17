import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUserId } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { NotificationQueryDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications (Thông báo)')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Lịch sử thông báo của tôi' })
  @Get()
  findMine(@GetUserId() userId: string, @Query() query: NotificationQueryDto) {
    return this.notificationsService.findMine(userId, query);
  }

  @ApiOperation({ summary: 'Số thông báo chưa đọc' })
  @Get('unread-count')
  unreadCount(@GetUserId() userId: string) {
    return this.notificationsService.unreadCount(userId);
  }

  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc' })
  @Patch('read-all')
  markAllRead(@GetUserId() userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @ApiOperation({ summary: 'Đánh dấu đã đọc' })
  @Patch(':id/read')
  markRead(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.notificationsService.markRead(id, userId);
  }

  @ApiOperation({ summary: 'Xoá thông báo' })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.notificationsService.remove(id, userId);
  }
}
