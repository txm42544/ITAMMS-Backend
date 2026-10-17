import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RepairRequestsService } from './repair-requests.service';
import {
  RepairRequest,
  RepairRequestSchema,
} from './schemas/repair-request.schema';
import { Ticket, TicketSchema } from './schemas/ticket.schema';
import {
  RepairRequestsController,
  TicketsController,
} from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: RepairRequest.name, schema: RepairRequestSchema },
    ]),
  ],
  controllers: [TicketsController, RepairRequestsController],
  providers: [TicketsService, RepairRequestsService],
  exports: [TicketsService, MongooseModule],
})
export class TicketsModule {}
