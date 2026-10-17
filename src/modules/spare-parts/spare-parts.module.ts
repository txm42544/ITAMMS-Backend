import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SparePart,
  SparePartSchema,
  StockTransaction,
  StockTransactionSchema,
} from './schemas/spare-part.schema';
import {
  SparePartsController,
  StockTransactionsController,
} from './spare-parts.controller';
import { SparePartsService } from './spare-parts.service';

/** Global: SparePartsService.consume() được dùng bởi ticket và bảo trì */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SparePart.name, schema: SparePartSchema },
      { name: StockTransaction.name, schema: StockTransactionSchema },
    ]),
  ],
  controllers: [SparePartsController, StockTransactionsController],
  providers: [SparePartsService],
  exports: [SparePartsService, MongooseModule],
})
export class SparePartsModule {}
