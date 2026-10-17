import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { AlertsService } from './alerts.service';

@ApiTags('Alerts (Cảnh báo tự động)')
@ApiBearerAuth('access-token')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @ApiOperation({
    summary:
      'Chạy thủ công 1 job cảnh báo (warranty | maintenance | maintenance-overdue | low-stock | ticket-overdue)',
  })
  @RequirePermissions(PERMISSIONS.ALERT_RUN)
  @Post('run/:job')
  runJob(@Param('job') job: string) {
    return this.alertsService.runJob(job);
  }

  @ApiOperation({ summary: 'Chạy tất cả job cảnh báo' })
  @RequirePermissions(PERMISSIONS.ALERT_RUN)
  @Post('run-all')
  runAll() {
    return this.alertsService.runAll();
  }

  @ApiOperation({ summary: 'Lịch sử các lần gửi cảnh báo (chống trùng)' })
  @RequirePermissions(PERMISSIONS.ALERT_RUN, PERMISSIONS.REPORT_VIEW_ALL)
  @Get('logs')
  listLogs(@Query('type') type?: string, @Query('limit') limit?: string) {
    return this.alertsService.listLogs(
      type,
      limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50,
    );
  }
}
