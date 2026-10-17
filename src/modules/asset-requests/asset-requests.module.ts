import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetRequestsController } from './asset-requests.controller';
import { AssetRequestsService } from './asset-requests.service';
import {
  AssetRequest,
  AssetRequestSchema,
} from './schemas/asset-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssetRequest.name, schema: AssetRequestSchema },
    ]),
  ],
  controllers: [AssetRequestsController],
  providers: [AssetRequestsService],
})
export class AssetRequestsModule {}
