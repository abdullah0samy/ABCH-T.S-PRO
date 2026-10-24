import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketGateway } from '../../gateways/ticket.gateway';
import fs from 'fs';
import path from 'path';
import { EXPORTS_DIR } from '../../core/paths';

@Injectable()
export class CronService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TicketGateway) private readonly ticketGateway: TicketGateway,
  ) {}

  async cleanupExports() {
    const now = new Date();
    const expiredExports = await this.prisma.exportHistory.findMany({
      where: { expiresAt: { lte: now } }
    });

    if (expiredExports.length === 0) return;

    const exportDir = EXPORTS_DIR;
    for (const rec of expiredExports) {
      if (rec.fileName) {
        const filePath = path.join(exportDir, rec.fileName);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to delete expired file ${rec.fileName}:`, err);
        }
      }
    }

    const { count } = await this.prisma.exportHistory.deleteMany({
      where: { expiresAt: { lte: now } }
    });
  }

  async slaCheck() {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const breachedTickets = await tx.ticket.findMany({
        where: {
          status: { notIn: ['resolved', 'closed'] },
          slaDeadline: { lt: now },
          slaBreachSent: false
        }
      });

      for (const ticket of breachedTickets) {
        const deptUsers = await tx.user.findMany({
          where: { departmentId: ticket.departmentId, isActive: true }
        });

        if (deptUsers.length > 0) {
          await tx.notification.createMany({
            data: deptUsers.map(u => ({
              userId: u.id,
              ticketId: ticket.id,
              eventType: 'SLA_BREACH',
              titleEn: 'SLA Breach Alert',
              titleAr: 'تنبيه تجاوز اتفاقية مستوى الخدمة',
              bodyEn: `Ticket ${ticket.ticketNumber} has breached its SLA deadline.`,
              bodyAr: `تجاوزت التذكرة رقم ${ticket.ticketNumber} الموعد النهائي المحدد.`
            }))
          });
        }

        await tx.ticket.update({
          where: { id: ticket.id },
          data: { slaBreachSent: true }
        });
        this.ticketGateway.emitToDept(ticket.departmentId, 'sla-breach', {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          deadline: ticket.slaDeadline,
        });
      }

      const pendingTickets = await tx.ticket.findMany({
        where: {
          status: { notIn: ['resolved', 'closed'] },
          slaDeadline: { gt: now },
          slaWarningSent: false
        }
      });

      for (const ticket of pendingTickets) {
        if (!ticket.slaDeadline) continue;
        const totalSlaTime = ticket.slaDeadline.getTime() - ticket.createdAt.getTime();
        const timeElapsed = now.getTime() - ticket.createdAt.getTime();
        const percentage = (timeElapsed / totalSlaTime) * 100;

        if (percentage >= 80) {
          const deptUsers = await tx.user.findMany({
            where: { departmentId: ticket.departmentId, isActive: true }
          });

          if (deptUsers.length > 0) {
            await tx.notification.createMany({
              data: deptUsers.map(u => ({
                userId: u.id,
                ticketId: ticket.id,
                eventType: 'SLA_WARNING',
                titleEn: 'SLA Warning',
                titleAr: 'تحذير اتفاقية مستوى الخدمة',
                bodyEn: `Ticket ${ticket.ticketNumber} has consumed ${Math.round(percentage)}% of its SLA time.`,
                bodyAr: `استهلكت التذكرة رقم ${ticket.ticketNumber} حوالي ${Math.round(percentage)}% من الوقت المحدد.`
              }))
            });
          }

          await tx.ticket.update({
            where: { id: ticket.id },
            data: { slaWarningSent: true }
          });
          this.ticketGateway.emitToDept(ticket.departmentId, 'sla-warning', {
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            percentage: Math.round(percentage),
          });
        }
      }
    }, {
      maxWait: 5000,
      timeout: 15000
    });
  }

  async autoArchive() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await this.prisma.$transaction(async (tx) => {
      const ticketsToArchive = await tx.ticket.findMany({
        where: {
          status: { in: ['resolved', 'closed'] },
          completedAt: { lt: thirtyDaysAgo },
          isArchived: false
        }
      });

      const systemAdmin = await tx.user.findFirst({
        where: { role: 'super_admin' }
      });

      for (const ticket of ticketsToArchive) {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { isArchived: true, archivedAt: new Date() }
        });

        await tx.auditLog.create({
          data: {
            ticketId: ticket.id,
            userId: systemAdmin?.id || 1,
            action: 'AUTO_ARCHIVED',
            departmentId: ticket.departmentId,
            newData: { reason: 'Auto-archived after 30 days of inactivity' }
          }
        });
      }
    }, {
      maxWait: 5000,
      timeout: 30000 // Archiving can take longer if there are many tickets
    });
  }
}
