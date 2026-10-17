import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Tên đăng nhập hoặc email' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'Admin@123' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Thiếu refresh token' })
  @IsString()
  refreshToken: string;
}
