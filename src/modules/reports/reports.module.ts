import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AssetCategory,
  AssetCategorySchema,
  AssetStatus,
  AssetStatusSchema,
} from '../catalogs/schemas/catalog.schemas';
import {
  Department,
  DepartmentSchema,
} from '../departments/schemas/department.schema';
import {
  MaintenanceTask,
  MaintenanceTaskSchema,
} from '../maintenance/schemas/maintenance.schemas';
import {
  SparePart,
  SparePartSchema,
} from '../spare-parts/schemas/spare-part.schema';
import { Ticket, TicketSchema } from '../tickets/schemas/ticket.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Asset, AssetSchema } from '../assets/schemas/asset.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Asset.name, schema: AssetSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: MaintenanceTask.name, schema: MaintenanceTaskSchema },
      { name: SparePart.name, schema: SparePartSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
      { name: AssetCategory.name, schema: AssetCategorySchema },
      { name: AssetStatus.name, schema: AssetStatusSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
