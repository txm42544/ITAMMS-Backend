import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Asset, AssetSchema } from '../assets/schemas/asset.schema';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SparePartsModule } from '../spare-parts/spare-parts.module';
import { Ticket, TicketSchema } from '../tickets/schemas/ticket.schema';
import { AlertLog, AlertLogSchema } from './alert-log.schema';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: AlertLog.name, schema: AlertLogSchema },
      { name: Asset.name, schema: AssetSchema },
      { name: Ticket.name, schema: TicketSchema },
    ]),
    CatalogsModule,
    SparePartsModule,
    NotificationsModule,
    MaintenanceModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
