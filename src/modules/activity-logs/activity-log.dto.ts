import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';
import {
  DateRangeQueryDto,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';

export class ActivityLogQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeQueryDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ example: 'assets' })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ example: 'CREATE' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ enum: ['success', 'failure'] })
  @IsOptional()
  @IsIn(['success', 'failure'])
  status?: string;
}
