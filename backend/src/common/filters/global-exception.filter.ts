import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * `csrf-csrf` rejects a request with its own `ForbiddenError`, which carries a
 * `code` of 'EBADCSRFTOKEN' (or the message below) and is not an HttpException.
 */
function isCsrfError(exception: unknown): boolean {
  const err = exception as { code?: string; message?: string } | null;
  if (!err) return false;
  return err.code === 'EBADCSRFTOKEN' || /invalid csrf token/i.test(err.message || '');
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred. Please contact IT support.';
    let code: string | undefined;
    let extraMeta: Record<string, any> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (exResponse && typeof exResponse === 'object') {
        const respObj = exResponse as any;
        message = respObj.message || respObj.error || message;
        code = respObj.code;
        if (respObj.allowedTransitions) extraMeta.allowedTransitions = respObj.allowedTransitions;
        if (respObj.lockUntil) extraMeta.lockUntil = respObj.lockUntil;
        if (respObj.errors) extraMeta.errors = respObj.errors;
      }
    } else if (isCsrfError(exception)) {
      // `csrf-csrf` throws its own ForbiddenError, not a Nest HttpException, so
      // it fell through to 500 — a stale or missing CSRF token looked like a
      // server fault and the client had no way to tell it should retry.
      status = HttpStatus.FORBIDDEN;
      code = 'CSRF_INVALID';
      message = 'Invalid or missing CSRF token. Reload the page and try again.';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.BAD_REQUEST;
        const target = exception.meta?.target as string[] | string | undefined;
        const fieldName = Array.isArray(target) ? target.join(', ') : (target || 'field');
        message = `Unique constraint violation. The provided value for ${fieldName} already exists.`;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found in the database.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database query error.';
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided for database operation.';
    }

    // SECURITY FIX: Never expose stack traces in production
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      this.logger.error(`Unhandled Error: ${exception instanceof Error ? exception.message : exception}`, 
        exception instanceof Error ? exception.stack : '');
    }

    response.status(status).json({
      message: isProd && status === HttpStatus.INTERNAL_SERVER_ERROR
        ? 'An unexpected error occurred. Please contact IT support.'
        : message,
      ...(code ? { code } : {}),
      ...extraMeta,
      requestId: request.headers['x-request-id'] || undefined,
      ...(isProd ? {} : { stack: exception instanceof Error ? exception.stack : undefined }),
    });
  }
}
