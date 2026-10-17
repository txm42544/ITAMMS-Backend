import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  GetUserId,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import {
  AdjustStockDto,
  CreateSparePartDto,
  ImportStockDto,
  SparePartQueryDto,
  StockTransactionQueryDto,
  UpdateSparePartDto,
} from './dto/spare-part.dto';
import { SparePartsService } from './spare-parts.service';

const READ = [
  PERMISSIONS.SPARE_PART_READ,
  PERMISSIONS.SPARE_PART_MANAGE,
  PERMISSIONS.SPARE_PART_CONSUME,
];

@ApiTags('Spare Parts (Kho linh kiện / vật tư)')
@ApiBearerAuth('access-token')
@Controller('spare-parts')
export class SparePartsController {
  constructor(private readonly service: SparePartsService) {}

  @ApiOperation({
    summary: 'Danh sách linh kiện (?lowStock=true, ?categoryId=)',
  })
  @RequirePermissions(...READ)
  @Get()
  findAll(@Query() query: SparePartQueryDto) {
    return this.service.findAll(query);
  }

  @ApiOperation({ summary: 'Danh sách rút gọn (dropdown chọn linh kiện)' })
  @RequirePermissions(...READ)
  @Get('options')
  findOptions() {
    return this.service.findOptions();
  }

  @ApiOperation({ summary: 'Linh kiện tồn dưới ngưỡng tối thiểu' })
  @RequirePermissions(...READ)
  @Get('low-stock')
  lowStock() {
    return this.service.findLowStock();
  }

  @RequirePermissions(...READ)
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Thêm linh kiện (có thể kèm tồn đầu kỳ)' })
  @RequirePermissions(PERMISSIONS.SPARE_PART_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateSparePartDto, @GetUserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.SPARE_PART_MANAGE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateSparePartDto,
    @GetUserId() userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @ApiOperation({ summary: 'Nhập kho' })
  @RequirePermissions(PERMISSIONS.SPARE_PART_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/import')
  importStock(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ImportStockDto,
    @GetUserId() userId: string,
  ) {
    return this.service.importStock(id, dto, userId);
  }

  @ApiOperation({ summary: 'Điều chỉnh tồn kho sau kiểm kê' })
  @RequirePermissions(PERMISSIONS.SPARE_PART_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/adjust')
  adjust(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AdjustStockDto,
    @GetUserId() userId: string,
  ) {
    return this.service.adjustStock(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.SPARE_PART_MANAGE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.service.remove(id, userId);
  }
}

@ApiTags('Spare Parts (Kho linh kiện / vật tư)')
@ApiBearerAuth('access-token')
@Controller('stock-transactions')
export class StockTransactionsController {
  constructor(private readonly service: SparePartsService) {}

  @ApiOperation({ summary: 'Lịch sử nhập / xuất / điều chỉnh kho' })
  @RequirePermissions(...READ)
  @Get()
  findAll(@Query() query: StockTransactionQueryDto) {
    return this.service.findTransactions(query);
  }
}
