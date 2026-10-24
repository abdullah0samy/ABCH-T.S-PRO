import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  userId?: number;
  requestId?: string;
}

/**
 * Per-request data available anywhere in the call stack.
 *
 * The audit trail needs the caller's IP and user agent, but audit rows are
 * written from 30-odd places deep inside services that have no access to the
 * request. Threading a context argument through every one of those signatures
 * would be churn with no upside, so the request is bound to the async context
 * once, on the way in, and read where it is needed.
 */
const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  /** Run `fn` with `context` bound for its entire async call tree. */
  run<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
  },

  get(): RequestContext | undefined {
    return storage.getStore();
  },
};

/**
 * The client's address, honouring the proxy header only when the app is
 * configured to trust one — otherwise anyone can spoof their own audit trail
 * by sending an `X-Forwarded-For` of their choosing.
 */
export function clientIp(req: any): string | undefined {
  const trustProxy = process.env.TRUST_PROXY === 'true';
  if (trustProxy) {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.ip || req.socket?.remoteAddress || undefined;
}
