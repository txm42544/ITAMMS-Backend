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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import {
  CreateAssetCategoryDto,
  CreateAssetStatusDto,
  CreateIncidentTypeDto,
  CreateLocationDto,
  CreateSupplierDto,
  LocationQueryDto,
  UpdateAssetCategoryDto,
  UpdateAssetStatusDto,
  UpdateIncidentTypeDto,
  UpdateLocationDto,
  UpdateSettingsDto,
  UpdateSupplierDto,
} from './dto/catalog.dto';
import { AssetCategoriesService } from './services/asset-categories.service';
import { AssetStatusesService } from './services/asset-statuses.service';
import { IncidentTypesService } from './services/incident-types.service';
import { LocationsService } from './services/locations.service';
import { SettingsService } from './services/settings.service';
import { SuppliersService } from './services/suppliers.service';

/* ===================== Vị trí ===================== */
@ApiTags('Catalog - Locations (Vị trí)')
@ApiBearerAuth('access-token')
@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @ApiOperation({ summary: 'Danh sách vị trí' })
  @Get()
  findAll(@Query() query: LocationQueryDto) {
    return this.service.findAll(query);
  }

  @ApiOperation({ summary: 'Danh sách vị trí rút gọn (dropdown)' })
  @Get('options')
  findOptions() {
    return this.service.findOptions();
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateLocationDto, @GetUserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateLocationDto,
    @GetUserId() userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.service.remove(id, userId);
  }
}

/* ===================== Nhà cung cấp ===================== */
@ApiTags('Catalog - Suppliers (Nhà cung cấp)')
@ApiBearerAuth('access-token')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @ApiOperation({ summary: 'Danh sách nhà cung cấp' })
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get('options')
  findOptions() {
    return this.service.findOptions();
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateSupplierDto, @GetUserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @GetUserId() userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.service.remove(id, userId);
  }
}

/* ===================== Loại thiết bị ===================== */
@ApiTags('Catalog - Asset Categories (Loại thiết bị)')
@ApiBearerAuth('access-token')
@Controller('asset-categories')
export class AssetCategoriesController {
  constructor(private readonly service: AssetCategoriesService) {}

  @ApiOperation({ summary: 'Danh sách loại thiết bị' })
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get('options')
  findOptions() {
    return this.service.findOptions();
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateAssetCategoryDto, @GetUserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAssetCategoryDto,
    @GetUserId() userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.service.remove(id, userId);
  }
}

/* ===================== Trạng thái thiết bị ===================== */
@ApiTags('Catalog - Asset Statuses (Trạng thái thiết bị)')
@ApiBearerAuth('access-token')
@Controller('asset-statuses')
export class AssetStatusesController {
  constructor(private readonly service: AssetStatusesService) {}

  @ApiOperation({ summary: 'Danh sách trạng thái thiết bị' })
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get('options')
  findOptions() {
    return this.service.findOptions();
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateAssetStatusDto, @GetUserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAssetStatusDto,
    @GetUserId() userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.service.remove(id, userId);
  }
}

/* ===================== Loại sự cố ===================== */
@ApiTags('Catalog - Incident Types (Loại sự cố)')
@ApiBearerAuth('access-token')
@Controller('incident-types')
export class IncidentTypesController {
  constructor(private readonly service: IncidentTypesService) {}

  @ApiOperation({ summary: 'Danh sách loại sự cố' })
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get('options')
  findOptions() {
    return this.service.findOptions();
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateIncidentTypeDto, @GetUserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateIncidentTypeDto,
    @GetUserId() userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.service.remove(id, userId);
  }
}

/* ===================== Cấu hình hệ thống ===================== */
@ApiTags('Catalog - Settings (Cấu hình hệ thống)')
@ApiBearerAuth('access-token')
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @ApiOperation({ summary: 'Danh sách cấu hình hệ thống' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Cập nhật cấu hình (nhiều khoá)' })
  @RequirePermissions(PERMISSIONS.SETTING_MANAGE)
  @Put()
  update(@Body() dto: UpdateSettingsDto, @GetUserId() userId: string) {
    return this.service.updateMany(dto, userId);
  }
}
