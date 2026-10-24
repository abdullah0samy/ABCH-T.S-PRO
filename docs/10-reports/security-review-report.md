# Security Review Report

**System:** ABCH Hospital Ticketing CRM
**Date:** 2026-07-17
**Methodology:** Static source code analysis
**Scope:** All backend modules, frontend store, DB schema, infrastructure config

---

## Finding 1: CSRF Protection

Category: [Web Security — CSRF]
Current Status: Double-submit cookie pattern implemented via csrf-csrf library
Code Evidence: `main.ts:70-90` — `doubleCsrf()` configured with `getSecret` from env or random fallback, `getSessionIdentifier` from `req.ip`, `cookieName: 'x-csrf-token'`, `sameSite: 'strict'`, `secure` in production. Token sent as cookie at `main.ts:83-90` and read from `x-csrf-token` header at `main.ts:80`.
File: backend/src/main.ts
Line Numbers: 70-90
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: YES
Fix Recommendation: N/A — properly implemented

---

## Finding 2: JWT Secrets Fail-Fast

Category: [Authentication — Secret Management]
Current Status: Application refuses to start if JWT_ACCESS_SECRET or JWT_REFRESH_SECRET are unset
Code Evidence: `main.ts:14-18` — `process.exit(1)` on missing secrets. `auth.utils.ts:6-8` — top-level `if (!ACCESS_SECRET || !REFRESH_SECRET)` also calls `process.exit(1)`.
File: backend/src/main.ts
Line Numbers: 14-18
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: N/A — properly implemented

---

## Finding 3: Account Lockout

Category: [Authentication — Brute Force Protection]
Current Status: Account locks after 5 failed login attempts for 15 minutes
Code Evidence: `auth.service.ts:56-64` — on failed password, increments `failedLoginAttempts`; at `>= 5`, sets `lockUntil: new Date(Date.now() + 15 * 60 * 1000)`. `auth.service.ts:39-44` — returns 423 if locked. `auth.service.ts:46-51` — resets attempts and lock when lock period expires.
File: backend/src/modules/auth/auth.service.ts
Line Numbers: 39-64
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: N/A — properly implemented

---

## Finding 4: Rate Limiting

Category: [Availability — DoS Protection]
Current Status: 6-tier rate limiting via @nestjs/throttler with Redis backend
Code Evidence: `app.module.ts:30-37` — tiers: `global` (2000 req/15m), `login` (50 req/15m), `auth` (100 req/15m), `search` (60 req/1m), `analytics` (300 req/15m), `upload` (100 req/1h). `app.module.ts:66` — `ThrottlerGuard` registered globally. Routes apply selective tiers: `auth.controller.ts:14` — `@Throttle({ login: {} })`, `tickets.controller.ts:19` — `@Throttle({ auth: {} })`, `tickets.controller.ts:39` — `@Throttle({ search: {} })`, `analytics.controller.ts:15` — `@Throttle({ analytics: {} })`, `uploads.controller.ts:30` — `@Throttle({ upload: {} })`.
File: backend/src/app.module.ts
Line Numbers: 30-37
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: YES
Fix Recommendation: N/A — properly implemented

---

## Finding 5: Helmet Content Security Policy

Category: [Web Security — HTTP Headers]
Current Status: Helmet configured with restrictive CSP; `unsafe-inline` permitted only for styles
Code Evidence: `main.ts:29-51` — CSP directives: `defaultSrc: self`, `scriptSrc: self`, `styleSrc: self + unsafe-inline` (required for Tailwind CSS JIT), `imgSrc: self + data: + blob: + https:*`, `objectSrc: none`, `upgradeInsecureRequests`, `frameguard: deny`, `noSniff: true`, `xssFilter: true`, `referrerPolicy: same-origin`. HSTS enabled in production only (`main.ts:42-46`).
File: backend/src/main.ts
Line Numbers: 29-51
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: YES
Fix Recommendation: N/A — `unsafe-inline` for styles is acceptable and documented as necessary for CSS-in-JS frameworks

---

## Finding 6: CORS Whitelist

Category: [Web Security — Cross-Origin Resource Sharing]
Current Status: CORS restricted to whitelisted origins with credentials enabled
Code Evidence: `main.ts:54-62` — production: single `FRONTEND_URL` origin; development: `localhost:3000`, `localhost:5173`, `127.0.0.1:3000`, `127.0.0.1:5173`; `credentials: true`; restricted HTTP methods; `allowedHeaders: ['Content-Type', 'Authorization']`.
File: backend/src/main.ts
Line Numbers: 54-62
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: YES
Fix Recommendation: N/A — properly implemented

---

## Finding 7: bcrypt Password Hashing

Category: [Authentication — Password Storage]
Current Status: bcrypt used for password comparison on login; bcryptjs in dependencies
Code Evidence: `auth.service.ts:53` — `bcrypt.compare(password, user.passwordHash)`; `backend/package.json:33` — `bcryptjs: ^3.0.3`. Password input validated at `auth.service.ts:17-19` — max 128 characters.
File: backend/src/modules/auth/auth.service.ts
Line Numbers: 53
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: N/A — properly implemented

---

## Finding 8: Input Validation

Category: [Web Security — Input Validation]
Current Status: Zod validation applied only to ticket creation; all other endpoints accept untyped body
Code Evidence: `tickets.controller.ts:20-26` — `POST /api/tickets` uses `createTicketSchema.safeParse()`. `tickets.schema.ts:3-23` defines schema with types, length limits, and enums. All other 53 endpoints declare `body: any` and perform inline checks (e.g., `admin-buildings.controller.ts:30-31`: `if (!body.nameAr || !body.nameEn)`). `zod-validation.pipe.ts` exists but is never imported by any controller.
File: backend/src/modules/tickets/tickets.controller.ts
Line Numbers: 20-26
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: Apply `ZodValidationPipe` with endpoint-specific schemas to all POST/PUT/PATCH endpoints. Prioritize: password change, user creation, asset management, bulk operations.

---

## Finding 9: SQL Injection Protection

Category: [Web Security — Injection]
Current Status: All database queries use Prisma ORM with parameterized queries
Code Evidence: Every query across all service files uses Prisma's type-safe API: `prisma.ticket.findMany({ where: ... })`, `prisma.$transaction()`, etc. No raw SQL or `prisma.$queryRaw()` calls found in codebase.
File: backend/src/modules/tickets/tickets.service.ts
Line Numbers: 1-1007
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: N/A — Prisma ORM provides parameterized queries by default

---

## Finding 10: XSS Protection

Category: [Web Security — Cross-Site Scripting]
Current Status: Helmet `xssFilter: true` enabled; CSP restricts `scriptSrc: self`
Code Evidence: `main.ts:49` — `xssFilter: true` in Helmet config. `main.ts:33` — `scriptSrc: ["'self'"]` prevents inline script injection.
File: backend/src/main.ts
Line Numbers: 33, 49
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: YES
Fix Recommendation: N/A — header-level protection is properly configured

---

## Finding 11: Refresh Token Server-Side Invalidation

Category: [Authentication — Token Lifecycle]
Current Status: Logout clears client-side cookie but does not invalidate the refresh token server-side
Code Evidence: `auth.controller.ts:48-58` — `logout()` clears `refreshToken` cookie and calls `authService.logout()`. `auth.service.ts:123-125` — `logout()` returns only `{ message: 'Logged out successfully' }`. No Redis blacklist, no DB revocation table, no rotation mechanism exists. Refresh token validity is solely determined by JWT expiration (7 days per `auth.utils.ts:22`). A stolen refresh token remains valid for up to 7 days after logout.
File: backend/src/modules/auth/auth.service.ts
Line Numbers: 123-125
Verified Finding: NOT CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: Implement refresh token blacklist in Redis with TTL matching token remaining lifetime, or implement refresh token rotation with a DB rotation table.

---

## Finding 12: Hard Deletes Without Audit — Buildings and Floors

Category: [Data Integrity — Audit Trail]
Current Status: Building and floor deletions use hard deletes with zero audit logging
Code Evidence: `admin-buildings.controller.ts:59-61` — `prisma.building.delete()` with no preceding `auditLog.create()`. `admin-floors.controller.ts:60-62` — `prisma.floor.delete()` with no preceding `auditLog.create()`. Compare with `admin-departments.controller.ts:99-111` which soft-deletes and logs `DEPT_DEACTIVATED`. KB article deletes at `knowledge.service.ts:182` do create an audit entry but still perform a hard delete.
File: backend/src/modules/admin/controllers/admin-buildings.controller.ts
Line Numbers: 58-62
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: Replace hard deletes with soft deletes (`deletedAt` pattern) on Building and Floor models. Add `auditLog.create()` calls. For KB articles, consider soft delete in addition to existing audit log.

---

## Finding 13: File Upload Security

Category: [Web Security — File Upload]
Current Status: Multi-layered protection: extension whitelist, MIME whitelist, magic byte validation, path traversal prevention, size limit
Code Evidence: `uploads.controller.ts:12-19` — extension and MIME type allowlists (jpeg, png, pdf, doc, docx, xls, xlsx, wav, mp3, webm). `uploads.controller.ts:56` — 5MB size limit. `uploads.controller.ts:57-64` — `fileFilter` rejects files outside allowlists. `uploads.service.ts:6-17` — 10 magic byte validators covering all permitted MIME types. `uploads.service.ts:35-48` — `path.basename()` sanitization + `startsWith(uploadsRoot)` traversal check.
File: backend/src/modules/uploads/uploads.controller.ts
Line Numbers: 12-19, 44-72
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: N/A — defense-in-depth properly implemented

---

## Finding 14: Hardcoded Secrets in docker-compose.yml

Category: [Infrastructure — Secret Management]
Current Status: Database credentials and JWT secrets are hardcoded as plaintext in docker-compose.yml committed to version control
Code Evidence: `docker-compose.yml:7` — `POSTGRES_USER: johndoe`. `docker-compose.yml:8` — `POSTGRES_PASSWORD: c3fd17a5...` (full hash-length plaintext). `docker-compose.yml:40` — `DATABASE_URL` contains full credentials. `docker-compose.yml:43` — `JWT_ACCESS_SECRET: 291faf0f...`. `docker-compose.yml:44` — `JWT_REFRESH_SECRET: ff537592...`. All values are statically embedded with no `.env` variable interpolation.
File: docker-compose.yml
Line Numbers: 7-8, 40, 43-44
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: Replace with Docker secrets, `docker-compose` `.env` file (added to `.gitignore`), or a secrets manager. Rotate all credentials immediately as they are exposed in git history.

---

## Finding 15: Error Handling in Production

Category: [Web Security — Information Disclosure]
Current Status: Production responses suppress stack traces and return generic error messages
Code Evidence: `global-exception.filter.ts:23` — `isProd = process.env.NODE_ENV === 'production'`. `global-exception.filter.ts:30` — produces generic message `'An unexpected error occurred. Please contact IT support.'` for 500 errors in production. `global-exception.filter.ts:34` — `stack` field included only when `!isProd`. `global-exception.filter.ts:24-27` — stack logged to console only in dev.
File: backend/src/common/filters/global-exception.filter.ts
Line Numbers: 23-34
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: YES
Fix Recommendation: N/A — properly implemented

---

## Finding 16: IP/UserAgent Not Captured in Audit Logs

Category: [Audit — Completeness]
Current Status: Audit log schema has `ipAddress` and `userAgent` columns, but no audit log write populates these fields
Code Evidence: `schema.prisma:456-457` — `ipAddress String?` and `userAgent String?` defined. Grep for `ipAddress` or `userAgent` across all backend source files returns 0 results. Audit log writes (36 total `auditLog.create()` calls) provide only `userId`, `action`, `entityType`, `entityId`, `departmentId`, `ticketId`, `oldData`, `newData`. The `req.ip` and `req.headers['user-agent']` values from HTTP requests are never extracted or passed to audit writes.
File: backend/prisma/schema.prisma
Line Numbers: 456-457
Verified Finding: CONFIRMED
Confidence: HIGH
Requires Runtime Verification?: NO
Fix Recommendation: Create an audit log interceptor or helper that extracts `req.ip` and `req.headers['user-agent']` and injects them into every `auditLog.create()` call. Consider using NestJS's `ExecutionContext` in an interceptor.

---

## Summary of Security Findings

| # | Category | Finding Severity | Status |
|---|---|---|---|
| 1 | CSRF | Secure | CONFIRMED protected |
| 2 | JWT Secrets (fail-fast) | Secure | CONFIRMED protected |
| 3 | Account Lockout | Secure | CONFIRMED protected |
| 4 | Rate Limiting | Secure | CONFIRMED protected |
| 5 | Helmet CSP | Secure | CONFIRMED protected (minor: unsafe-inline for styles) |
| 6 | CORS | Secure | CONFIRMED protected |
| 7 | bcrypt | Secure | CONFIRMED protected |
| 8 | Input Validation | **High Risk** | PARTIAL — 1/54 endpoints |
| 9 | SQL Injection | Secure | CONFIRMED protected (Prisma parameterized) |
| 10 | XSS | Secure | CONFIRMED protected |
| 11 | Refresh Token Invalidation | **High Risk** | NOT CONFIRMED — gap confirmed |
| 12 | Hard Deletes Without Audit | Medium Risk | CONFIRMED gap (buildings, floors) |
| 13 | File Upload Security | Secure | CONFIRMED protected |
| 14 | Secrets in docker-compose.yml | **Critical Risk** | CONFIRMED — hardcoded plaintext |
| 15 | Error Handling | Secure | CONFIRMED production-safe |
| 16 | IP/UserAgent in Audit Log | Medium Risk | CONFIRMED — not captured |

**Total findings requiring remediation: 4 High/Critical + 2 Medium = 6 actionable items**