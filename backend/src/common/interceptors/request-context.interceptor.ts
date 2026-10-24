import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { clientIp, requestContext } from '../request-context';

/**
 * Bind the incoming request to the async context so anything downstream — in
 * particular the audit trail — can see who is calling and from where.
 *
 * Must run before the interceptors and handlers that read the context, which
 * it does by being registered first in `app.module.ts`.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    return requestContext.run(
      {
        ipAddress: clientIp(req),
        userAgent: typeof req.headers?.['user-agent'] === 'string'
          ? req.headers['user-agent'].slice(0, 400)
          : undefined,
        userId: req.user?.id,
        requestId: req.requestId,
      },
      () => next.handle(),
    );
  }
}
