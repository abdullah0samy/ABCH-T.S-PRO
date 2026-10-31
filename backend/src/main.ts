// Must stay first: modules imported below read process.env at import time.
import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import { UPLOADS_DIR, AVATARS_DIR, EXPORTS_DIR } from './core/paths';

async function bootstrap() {
  // CRITICAL: Fail fast if required environment variables are not configured.
  // This mirrors the same pattern used in auth.utils.ts for JWT secrets.
  // Add any new required env vars here — never use silent fallbacks for security config.
  const requiredEnvVars: Record<string, string | undefined> = {
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    CSRF_SECRET: process.env.CSRF_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL,
  };
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missingVars.length > 0) {
    console.error(`🔴 CRITICAL: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('  Set these in your .env file or deployment environment and restart.');
    process.exit(1);
  }
  // Safe to assert non-null from this point forward — process.exit() above guarantees it.
  const CSRF_SECRET = process.env.CSRF_SECRET as string;
  const FRONTEND_URL = process.env.FRONTEND_URL as string;

  for (const dir of [UPLOADS_DIR, AVATARS_DIR, EXPORTS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // BigInt serialization fix — same as Express app
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  // Helmet security headers (matching Express app.ts config exactly)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://*"],
        connectSrc: ["'self'", "ws:", "wss:", FRONTEND_URL],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' },
  }));

  // CORS (matching Express app.ts config)
  const corsOrigins = process.env.NODE_ENV === 'production'
    ? [FRONTEND_URL]
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    // x-csrf-token is required for the double-submit CSRF check; without it the
    // browser's preflight blocks every state-changing cross-origin request.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  });

  // Body parser limit matching Express
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Deterministic, self-healing Single-Cookie HMAC CSRF Middleware.
  // Signs tokens with HMAC-SHA256 stored directly in the readable `x-csrf-token`
  // cookie (`${nonce}.${mac}`) so there is only one cookie and it can never get
  // out of sync with an httpOnly shadow cookie.
  const signCsrfToken = (nonce: string): string => {
    const mac = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
    return `${nonce}.${mac}`;
  };

  const verifyCsrfToken = (token: string | undefined): boolean => {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const expected = crypto.createHmac('sha256', CSRF_SECRET).update(parts[0]).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(parts[1], 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      return false;
    }
  };

  const setFreshCsrfCookie = (res: express.Response): string => {
    const token = signCsrfToken(crypto.randomBytes(32).toString('hex'));
    res.cookie('x-csrf-token', token, {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      httpOnly: false,
    });
    return token;
  };

  const CSRF_EXEMPT_PATHS = new Set([
    '/api/health',
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/logout',
  ]);

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Clean up legacy csrf-csrf shadow cookie if present in browser
    if (req.cookies?.['csrf-internal']) {
      res.clearCookie('csrf-internal', { path: '/' });
    }

    const cleanPath = (req.originalUrl || req.url || '').split('?')[0];
    const cookieToken = req.cookies?.['x-csrf-token'] as string | undefined;
    const isCookieValid = verifyCsrfToken(cookieToken);

    if (cleanPath === '/api/health' || !isCookieValid) {
      setFreshCsrfCookie(res);
    }

    const method = req.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method) || CSRF_EXEMPT_PATHS.has(cleanPath)) {
      return next();
    }

    const headerToken = req.headers['x-csrf-token'] as string | undefined;
    if (!headerToken || !isCookieValid || headerToken !== cookieToken) {
      setFreshCsrfCookie(res);
      return res.status(403).json({
        message: 'Invalid or missing CSRF token. Please try again.',
        code: 'CSRF_INVALID',
      });
    }

    return next();
  });

  // Swagger / OpenAPI docs (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ABCH Ticketing CRM API')
      .setDescription('REST API for ABCH Ticketing CRM — Enterprise ITSM Platform')
      .setVersion('2.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const PORT = Number(process.env.NEST_PORT) || 4000;
  await app.listen(PORT, '0.0.0.0');
  console.log(`🏥 NestJS backend running on http://localhost:${PORT}`);
}
bootstrap();
