import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('Users (Tài khoản)')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Danh sách tài khoản (lọc theo phòng ban, vai trò, roleCode)',
  })
  @RequirePermissions(PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE)
  @Get()
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @ApiOperation({ summary: 'Chi tiết tài khoản' })
  @RequirePermissions(PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE)
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Tạo tài khoản' })
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateUserDto, @GetUserId() userId: string) {
    return this.usersService.create(dto, userId);
  }

  @ApiOperation({ summary: 'Cập nhật tài khoản' })
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUserDto,
    @GetUserId() userId: string,
  ) {
    return this.usersService.update(id, dto, userId);
  }

  @ApiOperation({ summary: 'Khoá / mở khoá tài khoản' })
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @GetUserId() userId: string,
  ) {
    return this.usersService.setLocked(id, dto.isLocked, userId);
  }

  @ApiOperation({ summary: 'Đặt lại mật khẩu' })
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @Patch(':id/reset-password')
  resetPassword(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @GetUserId() userId: string,
  ) {
    return this.usersService.resetPassword(id, dto, userId);
  }

  @ApiOperation({ summary: 'Xoá tài khoản' })
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.usersService.remove(id, userId);
  }
}
