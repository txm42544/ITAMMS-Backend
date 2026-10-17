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
  GetUserId,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  DepartmentQueryDto,
  UpdateDepartmentDto,
} from './dto/department.dto';

@ApiTags('Departments (Phòng ban)')
@ApiBearerAuth('access-token')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @ApiOperation({ summary: 'Danh sách phòng ban' })
  @Get()
  findAll(@Query() query: DepartmentQueryDto) {
    return this.departmentsService.findAll(query);
  }

  @ApiOperation({ summary: 'Danh sách phòng ban rút gọn (dropdown)' })
  @Get('options')
  findOptions() {
    return this.departmentsService.findOptions();
  }

  @ApiOperation({ summary: 'Chi tiết phòng ban' })
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.departmentsService.findOne(id);
  }

  @ApiOperation({ summary: 'Thêm phòng ban' })
  @RequirePermissions(PERMISSIONS.DEPARTMENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateDepartmentDto, @GetUserId() userId: string) {
    return this.departmentsService.create(dto, userId);
  }

  @ApiOperation({ summary: 'Cập nhật phòng ban' })
  @RequirePermissions(PERMISSIONS.DEPARTMENT_MANAGE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @GetUserId() userId: string,
  ) {
    return this.departmentsService.update(id, dto, userId);
  }

  @ApiOperation({ summary: 'Xoá phòng ban' })
  @RequirePermissions(PERMISSIONS.DEPARTMENT_MANAGE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.departmentsService.remove(id, userId);
  }
}
