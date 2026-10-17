import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { FileRefDto } from '../../assets/dto/asset.dto';
import {
  AssetRequestStatus,
  AssetRequestType,
} from '../schemas/asset-request.schema';

export class CreateAssetRequestDto {
  @ApiProperty({ enum: AssetRequestType })
  @IsEnum(AssetRequestType, { message: 'Loại yêu cầu không hợp lệ' })
  type: AssetRequestType;

  @ApiProperty({ type: [String], description: 'Danh sách tài sản (1-50)' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Chọn ít nhất 1 tài sản' })
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  assetIds: string[];

  @ApiPropertyOptional({
    description: 'Phòng ban nhận (cấp phát / điều chuyển)',
  })
  @IsOptional()
  @IsMongoId()
  toDepartmentId?: string;

  @ApiPropertyOptional({
    description: 'Người nhận (cấp phát / bàn giao / điều chuyển)',
  })
  @IsOptional()
  @IsMongoId()
  toUserId?: string;

  @ApiPropertyOptional({ description: 'Vị trí đặt tài sản sau khi thực hiện' })
  @IsOptional()
  @IsMongoId()
  toLocationId?: string;

  @ApiProperty({ example: 'Cấp máy cho nhân viên mới' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ example: '2026-10-20' })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional({
    example: 'Bán thanh lý',
    description: 'Hình thức thanh lý',
  })
  @IsOptional()
  @IsString()
  disposalMethod?: string;

  @ApiPropertyOptional({ type: [FileRefDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileRefDto)
  attachments?: FileRefDto[];
}

export class DecisionDto {
  @ApiPropertyOptional({ example: 'Đồng ý' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectDto {
  @ApiProperty({ example: 'Phòng chưa có nhu cầu' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
  @IsString()
  note: string;
}

export class ExecuteAssetRequestDto {
  @ApiPropertyOptional({ example: 'Đã bàn giao, hai bên ký biên bản' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'Bán thanh lý' })
  @IsOptional()
  @IsString()
  disposalMethod?: string;

  @ApiPropertyOptional({
    example: 1500000,
    description: 'Giá trị thu hồi khi thanh lý',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  recoveredValue?: number;

  @ApiPropertyOptional({
    type: [FileRefDto],
    description: 'Biên bản bàn giao / thanh lý',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileRefDto)
  attachments?: FileRefDto[];
}

export class AssetRequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AssetRequestType })
  @IsOptional()
  @IsEnum(AssetRequestType)
  type?: AssetRequestType;

  @ApiPropertyOptional({ enum: AssetRequestStatus })
  @IsOptional()
  @IsEnum(AssetRequestStatus)
  status?: AssetRequestStatus;

  @ApiPropertyOptional({ description: 'Phòng ban đi hoặc đến' })
  @IsOptional()
  @IsMongoId()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assetId?: string;

  @ApiPropertyOptional({
    description: 'true: chỉ các yêu cầu đang chờ tôi duyệt',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  pendingMyApproval?: string;
}
