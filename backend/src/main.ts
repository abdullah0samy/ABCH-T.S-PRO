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
import { doubleCsrf } from 'csrf-csrf';
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

  // CSRF double-submit (csrf-csrf v3).
  // The library stores `<token>|<hash>` in its OWN httpOnly cookie and returns the
  // bare token for the client to echo back in the `x-csrf-token` header.
  // We therefore keep the library cookie separate (httpOnly, not JS-readable) and
  // expose ONLY the bare token in a readable `x-csrf-token` cookie that the frontend
  // reads and sends as a header. (Previously the code overwrote the library cookie
  // with the bare token, stripping the hash and making every CSRF check fail.)
  const csrfProtection = doubleCsrf({
    getSecret: () => CSRF_SECRET,
    getSessionIdentifier: () => '',
    cookieName: 'csrf-internal',
    cookieOptions: {
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      httpOnly: true,
    },
    size: 64,
    getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
  });
  app.use(csrfProtection.doubleCsrfProtection);
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path === '/api/health' || !req.cookies?.['csrf-internal'] || !req.cookies?.['x-csrf-token']) {
      const token = csrfProtection.generateToken(req, res); // sets the httpOnly `csrf-internal` cookie
      res.cookie('x-csrf-token', token, {                   // JS-readable token for the frontend header
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    }
    next();
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
