import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  CurrentUser,
  GetUserId,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { UsePartsDto } from '../spare-parts/dto/spare-part.dto';
import {
  AssignTaskDto,
  CompleteTaskDto,
  CreateMaintenanceTaskDto,
  CreateMaintenancePlanDto,
  MaintenancePlanQueryDto,
  MaintenanceTaskQueryDto,
  SkipTaskDto,
  UpdateMaintenancePlanDto,
} from './dto/maintenance.dto';
import { MaintenancePlansService } from './maintenance-plans.service';
import { MaintenanceTasksService } from './maintenance-tasks.service';

type Id = string;

@ApiTags('Maintenance (Bảo trì định kỳ)')
@ApiBearerAuth('access-token')
@Controller('maintenance-plans')
export class MaintenancePlansController {
  constructor(private readonly plansService: MaintenancePlansService) {}

  @ApiOperation({ summary: 'Danh sách kế hoạch bảo trì' })
  @RequirePermissions(
    PERMISSIONS.MAINTENANCE_PLAN,
    PERMISSIONS.MAINTENANCE_READ_ALL,
    PERMISSIONS.MAINTENANCE_READ_DEPARTMENT,
  )
  @Get()
  findAll(@Query() query: MaintenancePlanQueryDto) {
    return this.plansService.findAll(query);
  }

  @ApiOperation({
    summary:
      'Lấy các tài sản thuộc phạm vi kế hoạch (preview trước khi sinh phiếu)',
  })
  @RequirePermissions(
    PERMISSIONS.MAINTENANCE_PLAN,
    PERMISSIONS.MAINTENANCE_READ_ALL,
  )
  @Get(':id/preview')
  preview(@Param('id', ParseObjectIdPipe) id: Id) {
    return this.plansService.previewAssets(id);
  }

  @ApiOperation({ summary: 'Chi tiết kế hoạch' })
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: Id) {
    return this.plansService.findOne(id);
  }

  @ApiOperation({ summary: 'Tạo kế hoạch bảo trì' })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLAN)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateMaintenancePlanDto, @GetUserId() userId: string) {
    return this.plansService.create(dto, userId);
  }

  @ApiOperation({ summary: 'Cập nhật kế hoạch' })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLAN)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: UpdateMaintenancePlanDto,
    @GetUserId() userId: string,
  ) {
    return this.plansService.update(id, dto, userId);
  }

  @ApiOperation({ summary: 'Xoá kế hoạch (huỷ các phiếu chưa thực hiện)' })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLAN)
  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: Id, @GetUserId() userId: string) {
    return this.plansService.remove(id, userId);
  }
}

@ApiTags('Maintenance Tasks (Phiếu bảo trì)')
@ApiBearerAuth('access-token')
@Controller('maintenance-tasks')
export class MaintenanceTasksController {
  constructor(private readonly tasksService: MaintenanceTasksService) {}

  @ApiOperation({
    summary:
      'Danh sách phiếu bảo trì (lọc theo quyền: toàn bộ / phòng ban / của tôi). ?assignee=me|unassigned',
  })
  @Get()
  findAll(
    @Query() query: MaintenanceTaskQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.findAll(query, user);
  }

  @ApiOperation({ summary: 'Chi tiết phiếu bảo trì' })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: Id,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.findOne(id, user);
  }

  @ApiOperation({ summary: 'Tạo phiếu bảo trì phát sinh cho nhiều tài sản' })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLAN)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateMaintenanceTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasksService.create(dto, user);
  }

  @ApiOperation({ summary: 'Phân công kỹ thuật viên' })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLAN)
  @HttpCode(HttpStatus.OK)
  @Post(':id/assign')
  assign(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: AssignTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.assign(id, dto, user);
  }

  @ApiOperation({
    summary: 'KTV bắt đầu thực hiện (tài sản chuyển sang Đang bảo trì)',
  })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_EXECUTE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/start')
  start(@Param('id', ParseObjectIdPipe) id: Id, @CurrentUser() user: AuthUser) {
    return this.tasksService.start(id, user);
  }

  @ApiOperation({ summary: 'Ghi nhận vật tư sử dụng' })
  @RequirePermissions(PERMISSIONS.SPARE_PART_CONSUME)
  @HttpCode(HttpStatus.OK)
  @Post(':id/parts')
  useParts(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: UsePartsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.useParts(id, dto, user);
  }

  @ApiOperation({ summary: 'Hoàn thành phiếu bảo trì' })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_EXECUTE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/complete')
  complete(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: CompleteTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.complete(id, dto, user);
  }

  @ApiOperation({
    summary: 'Bỏ qua phiếu (ghi lý do, khôi phục trạng thái tài sản)',
  })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_EXECUTE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/skip')
  skip(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: SkipTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.skip(id, dto, user);
  }

  @ApiOperation({ summary: 'Xoá phiếu (chỉ khi chưa thực hiện)' })
  @RequirePermissions(PERMISSIONS.MAINTENANCE_PLAN)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: Id,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.remove(id, user.id);
  }
}
