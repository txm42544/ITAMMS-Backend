import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'PKT' })
  @IsNotEmpty({ message: 'Mã phòng ban không được để trống' })
  @IsString()
  @MaxLength(30)
  code: string;

  @ApiProperty({ example: 'Phòng Kế toán' })
  @IsNotEmpty({ message: 'Tên phòng ban không được để trống' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID phòng ban cha' })
  @IsOptional()
  @IsMongoId()
  parentId?: string;

  @ApiPropertyOptional({ description: 'ID trưởng phòng' })
  @IsOptional()
  @IsMongoId()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class DepartmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  parentId?: string;
}
