import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DateRangeQueryDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination-query.dto';

export class FileRefDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/.../image.jpg' })
  @IsNotEmpty()
  @IsString()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateAssetDto {
  @ApiProperty({ example: 'Laptop Dell Latitude 5440' })
  @IsNotEmpty({ message: 'Tên tài sản không được để trống' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'ID loại thiết bị' })
  @IsMongoId({ message: 'categoryId không hợp lệ' })
  categoryId: string;

  @ApiPropertyOptional({ example: 'Dell' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 'Latitude 5440' })
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @ApiPropertyOptional({ example: 'CN0X1234' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    example: {
      cpu: 'Intel Core i5-1335U',
      ram: '16GB',
      storage: 'SSD 512GB',
      os: 'Windows 11 Pro',
    },
  })
  @IsOptional()
  @IsObject()
  specs?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: 22000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ example: 'HD-000123' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  warrantyStartDate?: string;

  @ApiPropertyOptional({
    example: '2029-01-15',
    description: 'Ưu tiên hơn warrantyMonths',
  })
  @IsOptional()
  @IsDateString()
  warrantyEndDate?: string;

  @ApiPropertyOptional({
    example: 36,
    description: 'Tự tính warrantyEndDate nếu không truyền',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyMonths?: number;

  @ApiPropertyOptional({ description: 'Mặc định: Trong kho (IN_STOCK)' })
  @IsOptional()
  @IsMongoId()
  statusId?: string;

  @ApiPropertyOptional({ description: 'Phòng ban quản lý / sử dụng' })
  @IsOptional()
  @IsMongoId()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiPropertyOptional({
    description:
      'Người đang sử dụng (dùng khi nhập liệu ban đầu tài sản đã cấp phát)',
  })
  @IsOptional()
  @IsMongoId()
  currentUserId?: string;

  @ApiPropertyOptional({
    example: 6,
    description: 'Mặc định theo loại thiết bị',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maintenanceCycleMonths?: number;

  @ApiPropertyOptional({ type: [FileRefDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileRefDto)
  images?: FileRefDto[];

  @ApiPropertyOptional({ type: [FileRefDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileRefDto)
  attachments?: FileRefDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/** Không cho sửa trạng thái / phòng ban / người dùng qua API cập nhật — phải qua nghiệp vụ vòng đời */
export class UpdateAssetDto extends PartialType(
  OmitType(CreateAssetDto, [
    'statusId',
    'departmentId',
    'currentUserId',
  ] as const),
) {}

export class ChangeAssetStatusDto {
  @ApiProperty({ description: 'ID trạng thái mới' })
  @IsMongoId()
  statusId: string;

  @ApiPropertyOptional({ example: 'Phát hiện mất trong đợt kiểm kê' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AssetQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeQueryDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  statusId?: string;

  @ApiPropertyOptional({
    example: 'IN_USE',
    description: 'Lọc theo mã trạng thái',
  })
  @IsOptional()
  @IsString()
  statusCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  currentUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @ApiPropertyOptional({
    enum: ['valid', 'expiring', 'expired', 'none'],
    description:
      'Tình trạng bảo hành (expiring = sắp hết theo cấu hình warrantyAlertDays)',
  })
  @IsOptional()
  @IsIn(['valid', 'expiring', 'expired', 'none'])
  warranty?: 'valid' | 'expiring' | 'expired' | 'none';

  @ApiPropertyOptional({
    description: 'true: chỉ tài sản đến hạn bảo trì trong 30 ngày',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  maintenanceDue?: string;
}

export class AssetHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'REPAIRED,MAINTAINED',
    description: 'Lọc theo action (phân tách dấu phẩy)',
  })
  @IsOptional()
  @IsString()
  actions?: string;
}

export class QrBatchDto {
  @ApiProperty({
    type: [String],
    description: 'Danh sách ID tài sản (tối đa 200)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  assetIds: string[];
}

export class QrQueryDto {
  @ApiPropertyOptional({ enum: ['json', 'png'], default: 'json' })
  @IsOptional()
  @IsIn(['json', 'png'])
  format?: 'json' | 'png';
}
