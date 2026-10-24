import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketQueryService } from './ticket-query.service';
import { TicketBulkActionsService } from './ticket-bulk-actions.service';

@Module({
  imports: [PrismaModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketQueryService, TicketBulkActionsService],
  exports: [TicketsService, TicketQueryService, TicketBulkActionsService],
})
export class TicketsModule {}
