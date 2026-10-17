import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  CurrentUser,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { dateStamp, fileResponse } from '../../common/utils/file-response.util';
import { ReportsService } from './reports.service';

@ApiTags('Reports (Báo cáo / Dashboard)')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({
    summary:
      'Dashboard tổng quan (số liệu tài sản, sự cố, bảo trì, tồn kho). Phạm vi theo quyền báo cáo.',
  })
  @RequirePermissions(
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.REPORT_VIEW_DEPARTMENT,
  )
  @Get('dashboard')
  dashboard(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.dashboard(
      { fromDate, toDate, departmentId },
      user,
    );
  }

  @ApiOperation({
    summary:
      'Báo cáo tài sản (theo trạng thái, loại, phòng ban, tuổi thiết bị, bảo hành)',
  })
  @RequirePermissions(
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.REPORT_VIEW_DEPARTMENT,
  )
  @Get('assets')
  assets(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.assetsReport(
      { fromDate, toDate, departmentId },
      user,
    );
  }

  @ApiOperation({
    summary:
      'Báo cáo chi phí bảo trì (theo tháng, loại, phòng ban, top tài sản tốn kém; tách linh kiện/nhân công/thuê ngoài)',
  })
  @RequirePermissions(
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.REPORT_VIEW_DEPARTMENT,
  )
  @Get('maintenance-cost')
  maintenanceCost(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.maintenanceCostReport(
      { fromDate, toDate, departmentId },
      user,
    );
  }

  @ApiOperation({
    summary:
      'Báo cáo hiệu suất IT (số sự cố, TG phản hồi/xử lý TB, tỉ lệ đúng SLA, thống kê theo KTV, điểm đánh giá TB)',
  })
  @RequirePermissions(
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.REPORT_VIEW_DEPARTMENT,
  )
  @Get('it-performance')
  itPerformance(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.itPerformanceReport(
      { fromDate, toDate, departmentId },
      user,
    );
  }

  @ApiOperation({ summary: 'Xuất báo cáo tài sản ra Excel' })
  @RequirePermissions(
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.REPORT_VIEW_DEPARTMENT,
  )
  @Get('assets/export')
  async exportAssets(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.reportsService.exportAssets(
      { fromDate, toDate, departmentId },
      user,
    );
    return fileResponse(res, buffer, `bao-cao-tai-san-${dateStamp()}.xlsx`);
  }

  @ApiOperation({ summary: 'Xuất báo cáo chi phí bảo trì ra Excel' })
  @RequirePermissions(
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.REPORT_VIEW_DEPARTMENT,
  )
  @Get('maintenance-cost/export')
  async exportMaintenanceCost(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.reportsService.exportMaintenanceCost(
      { fromDate, toDate, departmentId },
      user,
    );
    return fileResponse(
      res,
      buffer,
      `bao-cao-chi-phi-bao-tri-${dateStamp()}.xlsx`,
    );
  }

  @ApiOperation({ summary: 'Xuất báo cáo hiệu suất IT ra Excel' })
  @RequirePermissions(
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.REPORT_VIEW_DEPARTMENT,
  )
  @Get('it-performance/export')
  async exportItPerformance(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.reportsService.exportItPerformance(
      { fromDate, toDate, departmentId },
      user,
    );
    return fileResponse(
      res,
      buffer,
      `bao-cao-hieu-suat-it-${dateStamp()}.xlsx`,
    );
  }
}
