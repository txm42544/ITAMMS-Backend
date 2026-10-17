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
import {
  PERMISSION_GROUPS,
  PERMISSIONS,
} from '../../common/constants/permissions.constant';
import {
  GetUserId,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { createApiResponse } from '../../common/utils/response.util';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles (Vai trò & phân quyền)')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({ summary: 'Danh sách vai trò' })
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE, PERMISSIONS.USER_MANAGE)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.rolesService.findAll(query);
  }

  @ApiOperation({ summary: 'Danh sách vai trò rút gọn (dropdown)' })
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE, PERMISSIONS.USER_MANAGE)
  @Get('options')
  findOptions() {
    return this.rolesService.findOptions();
  }

  @ApiOperation({ summary: 'Chi tiết vai trò' })
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @ApiOperation({ summary: 'Tạo vai trò' })
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateRoleDto, @GetUserId() userId: string) {
    return this.rolesService.create(dto, userId);
  }

  @ApiOperation({ summary: 'Cập nhật vai trò / gán quyền' })
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @GetUserId() userId: string,
  ) {
    return this.rolesService.update(id, dto, userId);
  }

  @ApiOperation({ summary: 'Xoá vai trò' })
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.rolesService.remove(id, userId);
  }
}

@ApiTags('Roles (Vai trò & phân quyền)')
@ApiBearerAuth('access-token')
@Controller('permissions')
export class PermissionsController {
  @ApiOperation({ summary: 'Cây quyền của hệ thống' })
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @Get()
  findAll() {
    return createApiResponse(
      PERMISSION_GROUPS,
      'Lấy danh sách quyền thành công',
    );
  }
}
