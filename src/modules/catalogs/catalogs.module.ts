import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AssetCategoriesController,
  AssetStatusesController,
  IncidentTypesController,
  LocationsController,
  SettingsController,
  SuppliersController,
} from './catalogs.controller';
import {
  AssetCategory,
  AssetCategorySchema,
  AssetStatus,
  AssetStatusSchema,
  IncidentType,
  IncidentTypeSchema,
  Location,
  LocationSchema,
  Setting,
  SettingSchema,
  Supplier,
  SupplierSchema,
} from './schemas/catalog.schemas';
import { AssetCategoriesService } from './services/asset-categories.service';
import { AssetStatusesService } from './services/asset-statuses.service';
import { IncidentTypesService } from './services/incident-types.service';
import { LocationsService } from './services/locations.service';
import { SettingsService } from './services/settings.service';
import { SuppliersService } from './services/suppliers.service';

const services = [
  LocationsService,
  SuppliersService,
  AssetCategoriesService,
  AssetStatusesService,
  IncidentTypesService,
  SettingsService,
];

/** Các danh mục hệ thống — global vì hầu hết module nghiệp vụ đều dùng */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Location.name, schema: LocationSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: AssetCategory.name, schema: AssetCategorySchema },
      { name: AssetStatus.name, schema: AssetStatusSchema },
      { name: IncidentType.name, schema: IncidentTypeSchema },
      { name: Setting.name, schema: SettingSchema },
    ]),
  ],
  controllers: [
    LocationsController,
    SuppliersController,
    AssetCategoriesController,
    AssetStatusesController,
    IncidentTypesController,
    SettingsController,
  ],
  providers: services,
  exports: [...services, MongooseModule],
})
export class CatalogsModule {}
