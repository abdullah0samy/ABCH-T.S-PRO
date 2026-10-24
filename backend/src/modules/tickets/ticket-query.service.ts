import { Injectable, Inject } from '@nestjs/common';
import { TicketsService } from './tickets.service';

/**
 * TicketQueryService — isolated read-only service.
 *
 * Owns all list/search/get operations that do NOT mutate state.
 * Extracted from the 1 000-line TicketsService per the engineering review
 * (P3-13). Delegates to TicketsService for now; can be migrated fully
 * once the team is ready to move the underlying queries here.
 *
 * Planned queries to own directly (future migration):
 *   findMy, findDepartment, findById, search, findArchived,
 *   findTransferred, getFormData
 */
@Injectable()
export class TicketQueryService {
  constructor(
    @Inject(TicketsService) private readonly ticketsService: TicketsService,
  ) {}

  getFormData() {
    return this.ticketsService.getFormData();
  }

  findMy(userId: number, query: any) {
    return this.ticketsService.findMy(userId, query);
  }

  findDepartment(userId: number, userRole: string, userDeptId: number | null, query: any) {
    return this.ticketsService.findDepartment(userId, userRole, userDeptId, query);
  }

  search(userId: number, userRole: string, userDeptId: number | null | undefined, query: any) {
    return this.ticketsService.search(userId, userRole, userDeptId, query);
  }

  findArchived(userId: number, userRole: string, userDeptId: number | null | undefined, query: any) {
    return this.ticketsService.findArchived(userId, userRole, userDeptId, query);
  }

  findTransferred(userId: number, userRole: string, userDeptId: number | null | undefined, query: any) {
    return this.ticketsService.findTransferred(userId, userRole, userDeptId, query);
  }

  findById(ticketId: number, userId: number, userRole: string, userDeptId: number | null) {
    return this.ticketsService.findById(ticketId, userId, userRole, userDeptId);
  }
}
