# Production Readiness Report

**System:** ABCH Hospital Ticketing CRM
**Date:** 2026-07-17
**Methodology:** Static source code analysis
**Scope:** 54 API endpoints, 24+ DB tables, 18 React pages, 25 test files

---

## Executive Summary

The ABCH Hospital Ticketing CRM is a production-capable hospital help desk system with strong foundational security controls. All critical authentication and session mechanisms are confirmed. Key remaining gaps center on input validation coverage, refresh token lifecycle management, and audit logging completeness.

**Overall Assessment: READY WITH CAVEATS** — deployable for internal hospital use after addressing Critical and High items listed below.

---

## 1. Authentication & Session

| Control | Status | Evidence |
|---|---|---|
| JWT fail-fast on missing secrets | CONFIRMED | `main.ts:14-18` — `process.exit(1)` if secrets absent; `auth.utils.ts:6-8` — module-level fail-fast |
| bcrypt password hashing | CONFIRMED | `auth.service.ts:53` — `bcrypt.compare()` on login; `admin-users.controller.ts` uses `bcrypt.hash()` on create/update |
| Account lockout | CONFIRMED | `auth.service.ts:39-44` — 423 response if `lockUntil > now`; `auth.service.ts:56-64` — locks at 5 failed attempts for 15 minutes |
| CSRF protection | CONFIRMED | `main.ts:70-90` — `csrf-csrf` double-cookie pattern with `sameSite: 'strict'` |
| Rate limiting | CONFIRMED | `app.module.ts:30-37` — 6 tiers: global (2000/15m), login (50/15m), auth (100/15m), search (60/1m), analytics (300/15m), upload (100/1h) |
| Refresh token server-side invalidation | NOT CONFIRMED | `auth.service.ts:123-125` — `logout()` returns static message only; `auth.controller.ts:48-58` — clears client cookie but no Redis blacklist or DB revocation list |

---

## 2. API Security

| Control | Status | Evidence |
|---|---|---|
| All endpoints JWT-protected | CONFIRMED | Every controller (except Health) applies `@UseGuards(JwtAuthGuard)` at class level; custom guard at `jwt-auth.guard.ts:9-32` verifies token, user existence, isActive, deletedAt |
| Role guards on admin routes | CONFIRMED | All admin controllers use `@UseGuards(RolesGuard)` + `@Roles('super_admin', ...)` per route; `roles.guard.ts:9-33` enforces role membership |
| Input validation (Zod) | NOT CONFIRMED adequately | Only `tickets.controller.ts:20-26` (`POST /api/tickets`) uses `createTicketSchema.safeParse()`. Of 54 endpoints, only 1 uses Zod validation. Remaining 53 endpoints accept `body: any` with ad-hoc checks (e.g., `if (!body.nameAr)`) |

---

## 3. Data Integrity

| Control | Status | Evidence |
|---|---|---|
| Prisma transactions on mutations | CONFIRMED | `tickets.service.ts:139` (create), `:443` (updateStatus), `:513` (assign), `:570` (transfer), `:664` (confirmResolution), `:698` (bulkStatus), `:746` (bulkAssign), `:981` (bulkArchive) all use `this.prisma.$transaction(async (tx) => ...)` |
| Soft deletes on users/departments/tickets | CONFIRMED | `schema.prisma:123` — `deletedAt DateTime?`; `admin-departments.controller.ts:99-101` — sets `deletedAt: new Date(), isActive: false`; ticket archive sets `isArchived: true` |
| Hard deletes on buildings/floors/KB articles | NOT CONFIRMED | `admin-buildings.controller.ts:59-61` — `prisma.building.delete()`; `admin-floors.controller.ts:60-62` — `prisma.floor.delete()`; `knowledge.service.ts:182` — `prisma.knowledgeArticle.delete()`; none use soft delete |

---

## 4. Monitoring & Logging

| Control | Status | Evidence |
|---|---|---|
| Audit logging | CONFIRMED | 36 `auditLog.create()` calls across `tickets.service.ts`, `knowledge.service.ts`, `admin-*/controllers/*.ts`, `assets.service.ts`, `cron.service.ts` — nearly all mutations logged |
| Console logging | CONFIRMED | `main.ts:66` — `morgan('dev')`; `app.module.ts:64` — `MutationLoggerInterceptor` global interceptor; `RequestIdInterceptor` adds `x-request-id` |
| Structured logging (JSON) | NOT CONFIRMED | `mutation-logger.interceptor.ts` uses `Logger.log()` with string interpolation; no JSON/pino/winston found in `package.json` |

---

## 5. Performance

| Control | Status | Evidence |
|---|---|---|
| Permission caching | CONFIRMED | `core/permissionCache.ts:9-10` — `Map` with 30s TTL; `tickets.service.ts:30-37` used in `checkTicketPermission()` |
| Response caching | NOT CONFIRMED | No in-memory or Redis response cache found; every GET hits database |
| Pagination max limit | CONFIRMED | `MAX_PAGE_SIZE = 100` in `tickets.service.ts:185,214,297,324`, `audit.service.ts:4`, `knowledge.service.ts:25`, `analytics.service.ts:264` |

---

## 6. Security Headers

| Control | Status | Evidence |
|---|---|---|
| Helmet with CSP | CONFIRMED | `main.ts:29-51` — CSP with `defaultSrc: self`, `scriptSrc: self`, `styleSrc: self + unsafe-inline`, `objectSrc: none`; `xssFilter: true` |
| CORS whitelist | CONFIRMED | `main.ts:54-62` — production: single `FRONTEND_URL`; dev: `localhost:3000`, `localhost:5173`; `credentials: true` |
| HSTS in production | CONFIRMED | `main.ts:42-46` — `hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }` only when `NODE_ENV === 'production'` |

---

## 7. File Upload Handling

| Control | Status | Evidence |
|---|---|---|
| Magic byte validation | CONFIRMED | `uploads.service.ts:6-17` — 10 MIME types validated against file header bytes; `uploads.controller.ts:70` — invoked post-upload |
| Path traversal protection | CONFIRMED | `uploads.service.ts:36-41` — `path.basename()` + `startsWith(uploadsRoot)` check in `downloadFile()` |
| 5MB file size limit | CONFIRMED | `uploads.controller.ts:56` — `limits: { fileSize: 5 * 1024 * 1024 }` in multer config |

---

## 8. Error Handling

| Control | Status | Evidence |
|---|---|---|
| GlobalExceptionFilter | CONFIRMED | `app.module.ts:63` — registered as `APP_FILTER`; `global-exception.filter.ts:5-36` catches all exceptions |
| Production-safe (no stack traces) | CONFIRMED | `global-exception.filter.ts:23-34` — `isProd` check omits `stack` from JSON response; 500 errors return generic message |

---

## 9. Testing

| Control | Status | Evidence |
|---|---|---|
| Test suite exists | CONFIRMED | 21 `.test.ts` files under `tests/` covering auth, tickets, users, admin, analytics, audit, assets, uploads, knowledge, notifications, profile, team-notes, jobs, socket, realtime, and 3 unit test files; approximate count: ~105 test cases |
| Adequate coverage thresholds | NOT CONFIRMED | `vitest.config.ts:15-19` — thresholds: statements 50%, branches 39%, functions 35%, lines 50% — well below production-grade standards (typically 80%+ statements) |

---

## 10. CI/CD

| Control | Status | Evidence |
|---|---|---|
| GitHub Actions workflows | NOT CONFIRMED | No `.github/` directory exists; no workflow files found. Project has no CI/CD pipeline configured. |

---

## 11. Documentation

| Control | Status | Evidence |
|---|---|---|
| Swagger / OpenAPI (dev) | CONFIRMED | `main.ts:93-102` — full Swagger UI at `/api/docs` when `NODE_ENV !== 'production'`; all controllers decorated with `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` |

---

## Specific Gaps Requiring Remediation Before Production

### Critical
1. **Hardcoded secrets in docker-compose.yml** — `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` are plaintext in version control (`docker-compose.yml:7-8,43-44`)
2. **Refresh token not invalidated on logout** — stolen tokens remain valid for 7 days

### High
3. **Input validation covers 1 of 54 endpoints** — 53 endpoints accept unvalidated input
4. **No CI/CD pipeline** — no automated testing, linting, or deployment gating

### Medium
5. **IP/UserAgent not captured in audit logs** — `AuditLog` schema has fields (`schema.prisma:456-457`) but zero `auditLog.create()` calls populate them (only `ipAddress` and `userAgent` grep across entire backend returns 0 results)
6. **Hard deletes without audit trail for buildings/floors** — deletions are not logged to audit table; KB article deletes are logged but records are still permanently removed
7. **`getDepartmentPerformance()` ignores controller params** — `analytics.controller.ts:51` passes `req.user.role, req.user.departmentId`, but `analytics.service.ts:150` defines `async getDepartmentPerformance()` with zero parameters — supervisor sees all departments
8. **Test coverage thresholds too low** — 50%/39%/35%/50% does not provide confidence in code quality
9. **`relatedTickets` stored as JSON string** — `schema.prisma:231` — denormalized, not indexable, prone to corruption