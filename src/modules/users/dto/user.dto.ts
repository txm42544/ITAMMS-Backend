import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
export const PASSWORD_MESSAGE = 'Mật khẩu tối thiểu 6 ký tự, gồm cả chữ và số';

export class CreateUserDto {
  @ApiProperty({ example: 'NV0001' })
  @IsNotEmpty({ message: 'Mã nhân viên không được để trống' })
  @IsString()
  employeeCode: string;

  @ApiProperty({ example: 'nguyenvana' })
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @Matches(/^[a-zA-Z0-9_.]{3,50}$/, {
    message: 'Tên đăng nhập 3-50 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới',
  })
  username: string;

  @ApiProperty({ example: 'nguyenvana@company.vn' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: 'Abc@1234' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: 'Chuyên viên' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ description: 'ID phòng ban' })
  @IsOptional()
  @IsMongoId({ message: 'departmentId không hợp lệ' })
  departmentId?: string;

  @ApiProperty({ description: 'ID vai trò' })
  @IsMongoId({ message: 'roleId không hợp lệ' })
  roleId: string;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'username'] as const),
) {}

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'true = khoá tài khoản' })
  @IsBoolean()
  isLocked: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'Abc@1234' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional({
    example: 'TECHNICIAN',
    description: 'Lọc theo mã vai trò',
  })
  @IsOptional()
  @IsString()
  roleCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isLocked?: boolean;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu hiện tại' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'Abc@12345' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;
}
