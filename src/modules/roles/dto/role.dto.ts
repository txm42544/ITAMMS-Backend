import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'IT_LEAD' })
  @IsNotEmpty({ message: 'Mã vai trò không được để trống' })
  @IsString()
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'Mã vai trò chỉ gồm chữ, số và dấu gạch dưới',
  })
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Trưởng nhóm IT' })
  @IsNotEmpty({ message: 'Tên vai trò không được để trống' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: ['ticket:read_all', 'ticket:assign'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
