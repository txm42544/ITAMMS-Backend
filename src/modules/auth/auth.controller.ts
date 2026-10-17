import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GetUserId, Public } from '../../common/decorators/auth.decorators';
import { ChangePasswordDto, UpdateProfileDto } from '../users/dto/user.dto';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto';

@ApiTags('Auth (Xác thực)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Đăng nhập' })
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Làm mới access token' })
  @Public()
  @HttpCode(200)
  @Post('refresh-token')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Đăng xuất (thu hồi refresh token)' })
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @Post('logout')
  logout(@GetUserId() userId: string) {
    return this.authService.logout(userId);
  }

  @ApiOperation({ summary: 'Thông tin cá nhân + danh sách quyền' })
  @ApiBearerAuth('access-token')
  @Get('me')
  getMe(@GetUserId() userId: string) {
    return this.authService.getMe(userId);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân' })
  @ApiBearerAuth('access-token')
  @Put('me')
  updateMe(@GetUserId() userId: string, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(userId, dto);
  }

  @ApiOperation({ summary: 'Đổi mật khẩu' })
  @ApiBearerAuth('access-token')
  @Put('change-password')
  changePassword(@GetUserId() userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }
}
