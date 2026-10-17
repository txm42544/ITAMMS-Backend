import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetHistoryService } from './asset-history.service';
import { AssetsExcelService } from './assets-excel.service';
import { AssetsController, QrScanController } from './assets.controller';
import { AssetsService } from './assets.service';
import { QrService } from './qr.service';
import {
  AssetHistory,
  AssetHistorySchema,
} from './schemas/asset-history.schema';
import { Asset, AssetSchema } from './schemas/asset.schema';

/** Global: AssetsService/AssetHistoryService được dùng bởi yêu cầu vòng đời, ticket, bảo trì */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Asset.name, schema: AssetSchema },
      { name: AssetHistory.name, schema: AssetHistorySchema },
    ]),
  ],
  controllers: [AssetsController, QrScanController],
  providers: [
    AssetsService,
    AssetHistoryService,
    QrService,
    AssetsExcelService,
  ],
  exports: [AssetsService, AssetHistoryService, MongooseModule],
})
export class AssetsModule {}
