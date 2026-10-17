import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TicketPriority } from '../schemas/catalog.schemas';

class BaseCatalogDto {
  @ApiProperty({ example: 'CODE01' })
  @IsNotEmpty({ message: 'Mã không được để trống' })
  @IsString()
  @Matches(/^[A-Za-z0-9_\-.]+$/, {
    message: 'Mã chỉ gồm chữ, số và các ký tự _ - .',
  })
  @MaxLength(30)
  code: string;

  @ApiProperty({ example: 'Tên danh mục' })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

/* ===================== Location ===================== */
export class CreateLocationDto extends BaseCatalogDto {
  @ApiPropertyOptional({ example: 'Toà A' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: 'Tầng 3' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: 'P.301' })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  departmentId?: string;
}
export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
export class LocationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  departmentId?: string;
}

/* ===================== Supplier ===================== */
export class CreateSupplierDto extends BaseCatalogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

/* ===================== AssetCategory ===================== */
export class SpecFieldDto {
  @ApiProperty({ example: 'cpu' })
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, { message: 'key không hợp lệ' })
  key: string;

  @ApiProperty({ example: 'Bộ vi xử lý' })
  @IsNotEmpty()
  @IsString()
  label: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateAssetCategoryDto extends BaseCatalogDto {
  @ApiProperty({ example: 'LT', description: 'Tiền tố mã tài sản' })
  @IsNotEmpty({ message: 'Tiền tố mã không được để trống' })
  @Matches(/^[A-Za-z0-9]{1,10}$/, {
    message: 'Tiền tố mã gồm 1-10 chữ hoặc số',
  })
  codePrefix: string;

  @ApiPropertyOptional({ type: [SpecFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecFieldDto)
  specFields?: SpecFieldDto[];

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultMaintenanceCycleMonths?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usefulLifeYears?: number;
}
export class UpdateAssetCategoryDto extends PartialType(
  CreateAssetCategoryDto,
) {}

/* ===================== AssetStatus ===================== */
export class CreateAssetStatusDto extends BaseCatalogDto {
  @ApiPropertyOptional({ example: '#16a34a' })
  @IsOptional()
  @IsHexColor({ message: 'Màu không hợp lệ' })
  color?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowAssign?: boolean;
}
export class UpdateAssetStatusDto extends PartialType(CreateAssetStatusDto) {}

/* ===================== IncidentType ===================== */
export class CreateIncidentTypeDto extends BaseCatalogDto {
  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  defaultPriority?: TicketPriority;

  @ApiPropertyOptional({ example: 24, description: 'Thời hạn xử lý (giờ)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  slaHours?: number;
}
export class UpdateIncidentTypeDto extends PartialType(CreateIncidentTypeDto) {}

/* ===================== Setting ===================== */
export class SettingItemDto {
  @ApiProperty({ example: 'warrantyAlertDays' })
  @IsNotEmpty()
  @IsString()
  key: string;

  @ApiProperty({ example: 30 })
  @IsDefined()
  value: any;
}

export class UpdateSettingsDto {
  @ApiProperty({ type: [SettingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  items: SettingItemDto[];
}
