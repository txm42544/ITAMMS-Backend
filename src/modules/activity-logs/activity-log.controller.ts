import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  GetUserId,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { ActivityLogQueryDto } from './activity-log.dto';
import { ActivityLogService } from './activity-log.service';

@ApiTags('Activity Logs (Nhật ký hoạt động)')
@ApiBearerAuth('access-token')
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @ApiOperation({ summary: 'Nhật ký hoạt động toàn hệ thống' })
  @RequirePermissions(PERMISSIONS.ACTIVITY_LOG_READ)
  @Get()
  findAll(@Query() query: ActivityLogQueryDto) {
    return this.activityLogService.findAll(query);
  }

  @ApiOperation({ summary: 'Nhật ký hoạt động của bản thân' })
  @Get('me')
  findMe(@Query() query: ActivityLogQueryDto, @GetUserId() userId: string) {
    return this.activityLogService.findAll({ ...query, userId });
  }
}
