import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketsService } from './tickets.service';

/**
 * TicketBulkActionsService — isolated service for operations that affect
 * many tickets at once (bulk status change, bulk assign, bulk archive).
 *
 * Extracted from the 1 000-line TicketsService to keep each service under
 * the "single responsibility" guideline (P3-13 from the engineering review).
 * All business logic remains the same — this is a structural move only.
 */
@Injectable()
export class TicketBulkActionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TicketsService) private readonly ticketsService: TicketsService,
  ) {}

  async bulkUpdateStatus(userId: number, userRole: string, userDeptId: number | null, body: any, userFullName?: string) {
    return this.ticketsService.bulkUpdateStatus(userId, userRole, userDeptId, body, userFullName);
  }

  async bulkAssign(userId: number, userRole: string, userDeptId: number | null, body: any, userFullName?: string) {
    return this.ticketsService.bulkAssign(userId, userRole, userDeptId, body, userFullName);
  }

  async bulkArchive(userId: number, userRole: string, userDeptId: number | null, body: any, userFullName?: string) {
    return this.ticketsService.bulkArchive(userId, userRole, userDeptId, body, userFullName);
  }
}
