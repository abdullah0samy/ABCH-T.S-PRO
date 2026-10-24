import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { requestContext } from '../common/request-context';

/**
 * Prisma client with one behaviour added: every `auditLog.create` is stamped
 * with the caller's IP address and user agent.
 *
 * Those columns have always existed but nothing wrote them, so the trail could
 * say *who* changed a record and never *from where* — precisely what an
 * incident review needs. Doing it here rather than at the ~30 call sites means
 * new audit writes are covered automatically and none can forget. An
 * explicitly supplied value always wins, so a caller can still override.
 *
 * Implemented by wrapping the delegate rather than with `$use`, which Prisma 6
 * removed, or `$extends`, which returns a different client object than the one
 * injected everywhere.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      errorFormat: 'minimal',
    });

    this.stampAuditWrites();
  }

  private stampAuditWrites() {
    const delegate: any = (this as PrismaClient).auditLog;
    const originalCreate = delegate.create.bind(delegate);

    delegate.create = (args: any = {}) => {
      const ctx = requestContext.get();
      const data = args?.data;
      if (ctx && data && !Array.isArray(data)) {
        if (data.ipAddress === undefined && ctx.ipAddress) data.ipAddress = ctx.ipAddress;
        if (data.userAgent === undefined && ctx.userAgent) data.userAgent = ctx.userAgent;
      }
      return originalCreate(args);
    };
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }
}
