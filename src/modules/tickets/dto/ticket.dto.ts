import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
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
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DateRangeQueryDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination-query.dto';
import { FileRefDto } from '../../assets/dto/asset.dto';
import { TicketPriority } from '../../catalogs/schemas/catalog.schemas';
import {
  RepairRequestStatus,
  RepairRequestType,
} from '../schemas/repair-request.schema';
import { ResolutionType, TicketSource } from '../schemas/ticket.schema';

export class CreateTicketDto {
  @ApiPropertyOptional({
    description: 'Tài sản gặp sự cố (lấy từ QR hoặc danh sách)',
  })
  @IsOptional()
  @IsMongoId()
  assetId?: string;

  @ApiProperty({ example: 'Máy không lên màn hình' })
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề sự cố' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Bật nguồn đèn sáng nhưng màn hình đen' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [FileRefDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FileRefDto)
  images?: FileRefDto[];

  @ApiPropertyOptional({
    description: 'Người báo có thể chọn sơ bộ loại sự cố',
  })
  @IsOptional()
  @IsMongoId()
  incidentTypeId?: string;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketSource, default: TicketSource.WEB })
  @IsOptional()
  @IsEnum(TicketSource)
  source?: TicketSource;
}

export class ReceiveTicketDto {
  @ApiProperty({ description: 'Phân loại sự cố' })
  @IsMongoId({ message: 'Vui lòng chọn loại sự cố' })
  incidentTypeId: string;

  @ApiPropertyOptional({
    enum: TicketPriority,
    description: 'Mặc định theo loại sự cố',
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    description: 'Phân công luôn cho KTV (có thể là chính mình)',
  })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class AssignTicketDto {
  @ApiProperty()
  @IsMongoId({ message: 'Vui lòng chọn kỹ thuật viên' })
  assigneeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class TicketNoteDto {
  @ApiProperty({ example: 'Đã kiểm tra nguồn, đang thử RAM' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung' })
  @IsString()
  note: string;
}

export class OptionalNoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class DiagnosisDto {
  @ApiProperty({ example: 'Hỏng RAM khe 2' })
  @IsNotEmpty({ message: 'Vui lòng nhập kết quả kiểm tra' })
  @IsString()
  diagnosis: string;

  @ApiPropertyOptional({ example: 'RAM lỗi do tuổi thọ' })
  @IsOptional()
  @IsString()
  rootCause?: string;
}

export class ResolveTicketDto {
  @ApiProperty({ enum: ResolutionType })
  @IsEnum(ResolutionType)
  resolutionType: ResolutionType;

  @ApiProperty({ example: 'Thay RAM mới, máy hoạt động bình thường' })
  @IsNotEmpty({ message: 'Vui lòng nhập kết quả xử lý' })
  @IsString()
  resolution: string;

  @ApiPropertyOptional({ example: 'RAM lỗi' })
  @IsOptional()
  @IsString()
  rootCause?: string;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCost?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  externalCost?: number;

  @ApiPropertyOptional({
    description:
      'Trạng thái tài sản sau xử lý (vd: Hỏng nếu không sửa được). Mặc định khôi phục trạng thái cũ',
  })
  @IsOptional()
  @IsMongoId()
  assetStatusId?: string;
}

export class AcceptTicketDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Xử lý nhanh' })
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class TicketQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeQueryDto,
) {
  @ApiPropertyOptional({
    example: 'NEW,RECEIVED',
    description: 'Một hoặc nhiều trạng thái, phân tách dấu phẩy',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    enum: ['me', 'unassigned'],
    description: 'Lọc nhanh theo người xử lý',
  })
  @IsOptional()
  @IsIn(['me', 'unassigned'])
  assignee?: 'me' | 'unassigned';

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  incidentTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  reportedBy?: string;

  @ApiPropertyOptional({
    description: 'true: chỉ sự cố quá hạn SLA chưa xử lý xong',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  overdue?: string;
}

/* ===================== Đề xuất sửa chữa / thay thế ===================== */

export class RepairRequestItemDto {
  @ApiPropertyOptional({ description: 'Linh kiện trong kho (nếu có)' })
  @IsOptional()
  @IsMongoId()
  sparePartId?: string;

  @ApiProperty({ example: 'Màn hình 14 inch FHD' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 2500000 })
  @IsNumber()
  @Min(0)
  estimatedCost: number;
}

export class CreateRepairRequestDto {
  @ApiProperty({ enum: RepairRequestType })
  @IsEnum(RepairRequestType)
  type: RepairRequestType;

  @ApiProperty({ type: [RepairRequestItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RepairRequestItemDto)
  items: RepairRequestItemDto[];

  @ApiPropertyOptional({ example: 'Trung tâm bảo hành Dell' })
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiProperty({ example: 'Màn hình vỡ, kho không có sẵn' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do đề xuất' })
  @IsString()
  reason: string;
}

export class RepairDecisionDto {
  @ApiPropertyOptional({ example: 'Đồng ý, liên hệ NCC' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RepairRequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RepairRequestStatus })
  @IsOptional()
  @IsEnum(RepairRequestStatus)
  status?: RepairRequestStatus;

  @ApiPropertyOptional({ enum: RepairRequestType })
  @IsOptional()
  @IsEnum(RepairRequestType)
  type?: RepairRequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  ticketId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assetId?: string;
}
