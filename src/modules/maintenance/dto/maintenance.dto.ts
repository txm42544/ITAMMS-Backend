import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DateRangeQueryDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination-query.dto';
import { FileRefDto } from '../../assets/dto/asset.dto';
import { AssetCondition, IntervalUnit } from '../schemas/maintenance.schemas';

export class ChecklistItemDto {
  @ApiProperty({ example: 'Vệ sinh bụi quạt tản nhiệt' })
  @IsNotEmpty()
  @IsString()
  item: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class PlanScopeDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  assetIds?: string[];
}

export class CreateMaintenancePlanDto {
  @ApiProperty({ example: 'Vệ sinh máy tính định kỳ 6 tháng' })
  @IsNotEmpty({ message: 'Tên kế hoạch không được để trống' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: PlanScopeDto })
  @ValidateNested()
  @Type(() => PlanScopeDto)
  scope: PlanScopeDto;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  intervalValue: number;

  @ApiProperty({ enum: IntervalUnit, example: IntervalUnit.MONTH })
  @IsEnum(IntervalUnit)
  intervalUnit: IntervalUnit;

  @ApiProperty({
    example: '2026-11-01',
    description: 'Ngày đến hạn đợt đầu tiên',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2028-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 7,
    description: 'Sinh phiếu trước bao nhiêu ngày',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadDays?: number;

  @ApiPropertyOptional({ type: [ChecklistItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  defaultAssigneeId?: string;
}

export class UpdateMaintenancePlanDto extends PartialType(
  CreateMaintenancePlanDto,
) {
  @ApiPropertyOptional({ description: 'Tạm dừng kế hoạch' })
  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;
}

export class CreateMaintenanceTaskDto {
  @ApiProperty({
    type: [String],
    description: 'Tạo phiếu bảo trì phát sinh cho các tài sản',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  assetIds: string[];

  @ApiProperty({ example: 'Cài lại hệ điều hành' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: '2026-10-20' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @ApiPropertyOptional({ type: [ChecklistItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];
}

export class AssignTaskDto {
  @ApiProperty()
  @IsMongoId()
  assigneeId: string;
}

export class ChecklistResultDto {
  @ApiProperty({ example: 'Vệ sinh bụi quạt tản nhiệt' })
  @IsNotEmpty()
  @IsString()
  item: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  ok: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CompleteTaskDto {
  @ApiPropertyOptional({ type: [ChecklistResultDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistResultDto)
  checklistResults?: ChecklistResultDto[];

  @ApiProperty({ example: 'Đã vệ sinh, thay keo tản nhiệt, máy chạy ổn định' })
  @IsNotEmpty({ message: 'Vui lòng nhập kết quả bảo trì' })
  @IsString()
  result: string;

  @ApiProperty({ enum: AssetCondition })
  @IsEnum(AssetCondition)
  conditionAfter: AssetCondition;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCost?: number;

  @ApiPropertyOptional({ type: [FileRefDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileRefDto)
  images?: FileRefDto[];

  @ApiPropertyOptional({
    description:
      'Trạng thái tài sản sau bảo trì (mặc định khôi phục trạng thái cũ)',
  })
  @IsOptional()
  @IsMongoId()
  assetStatusId?: string;
}

export class SkipTaskDto {
  @ApiProperty({ example: 'Thiết bị đang gửi bảo hành' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do' })
  @IsString()
  reason: string;
}

export class MaintenancePlanQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['true', 'false'])
  isPaused?: string;
}

export class MaintenanceTaskQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeQueryDto,
) {
  @ApiPropertyOptional({
    example: 'SCHEDULED,OVERDUE',
    description: 'Một hoặc nhiều trạng thái',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  planId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @ApiPropertyOptional({ enum: ['me', 'unassigned'] })
  @IsOptional()
  @IsIn(['me', 'unassigned'])
  assignee?: 'me' | 'unassigned';

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  departmentId?: string;
}
