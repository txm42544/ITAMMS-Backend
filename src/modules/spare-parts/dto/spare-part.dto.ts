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
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DateRangeQueryDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination-query.dto';
import { RefType } from '../../../common/constants/system-codes';
import { StockTransactionType } from '../schemas/spare-part.schema';

export class CreateSparePartDto {
  @ApiProperty({ example: 'RAM-DDR4-8G' })
  @IsNotEmpty({ message: 'Mã linh kiện không được để trống' })
  @Matches(/^[A-Za-z0-9_\-.]+$/, { message: 'Mã chỉ gồm chữ, số và _ - .' })
  code: string;

  @ApiProperty({ example: 'RAM DDR4 8GB' })
  @IsNotEmpty({ message: 'Tên linh kiện không được để trống' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'thanh' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  compatibleCategoryIds?: string[];

  @ApiPropertyOptional({ example: 'DDR4 3200MHz SODIMM' })
  @IsOptional()
  @IsString()
  specification?: string;

  @ApiPropertyOptional({ example: 5, description: 'Ngưỡng cảnh báo tồn thấp' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minQuantity?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Tồn đầu kỳ (tạo phiếu nhập)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialQuantity?: number;

  @ApiPropertyOptional({ example: 450000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'Kệ A - Ngăn 2' })
  @IsOptional()
  @IsString()
  storageLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

/** Không cho sửa số lượng trực tiếp — phải qua nhập / xuất / điều chỉnh */
export class UpdateSparePartDto extends PartialType(
  OmitType(CreateSparePartDto, ['initialQuantity'] as const),
) {}

export class ImportStockDto {
  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1, { message: 'Số lượng nhập phải >= 1' })
  quantity: number;

  @ApiProperty({ example: 450000 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'HD-2026-001' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class AdjustStockDto {
  @ApiProperty({ example: 8, description: 'Số lượng thực tế sau kiểm kê' })
  @IsInt()
  @Min(0)
  actualQuantity: number;

  @ApiProperty({ example: 'Kiểm kê quý 4' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do điều chỉnh' })
  @IsString()
  note: string;
}

export class UsePartItemDto {
  @ApiProperty()
  @IsMongoId()
  sparePartId: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class UsePartsDto {
  @ApiProperty({ type: [UsePartItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UsePartItemDto)
  items: UsePartItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class SparePartQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc linh kiện tương thích với loại thiết bị',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'true: chỉ linh kiện tồn thấp' })
  @IsOptional()
  @IsIn(['true', 'false'])
  lowStock?: string;
}

export class StockTransactionQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeQueryDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  sparePartId?: string;

  @ApiPropertyOptional({ enum: StockTransactionType })
  @IsOptional()
  @IsEnum(StockTransactionType)
  type?: StockTransactionType;

  @ApiPropertyOptional({ enum: RefType })
  @IsOptional()
  @IsEnum(RefType)
  refType?: RefType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  refId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assetId?: string;
}
