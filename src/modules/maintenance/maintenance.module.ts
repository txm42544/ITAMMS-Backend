import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetsModule } from '../assets/assets.module';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SparePartsModule } from '../spare-parts/spare-parts.module';
import { UsersModule } from '../users/users.module';
import { MaintenancePlansService } from './maintenance-plans.service';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import {
  MaintenancePlansController,
  MaintenanceTasksController,
} from './maintenance.controller';
import {
  MaintenancePlan,
  MaintenancePlanSchema,
  MaintenanceTask,
  MaintenanceTaskSchema,
} from './schemas/maintenance.schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenancePlan.name, schema: MaintenancePlanSchema },
      { name: MaintenanceTask.name, schema: MaintenanceTaskSchema },
    ]),
    AssetsModule,
    CatalogsModule,
    SparePartsModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [MaintenancePlansController, MaintenanceTasksController],
  providers: [MaintenancePlansService, MaintenanceTasksService],
  exports: [MaintenancePlansService, MaintenanceTasksService, MongooseModule],
})
export class MaintenanceModule {}
