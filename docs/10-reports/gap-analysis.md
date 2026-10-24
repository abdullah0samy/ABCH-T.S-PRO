# Gap Analysis Report

**System:** ABCH Hospital Ticketing CRM
**Date:** 2026-07-17
**Methodology:** Static source code analysis
**Scope:** 54 API endpoints, 24+ DB tables, 18 React pages, 21 test files

---

## 1. Missing Features

These are features that are out of scope or deferred per project requirements.

| Gap | Status | Notes |
|---|---|---|
| Email notifications | Out of scope | System uses in-app and Web Push notifications only. `notifications.service.ts` and `PushSubscription` model in `schema.prisma:433-444` provide push infrastructure. |
| Business-hours SLA calculation | Deferred | `sla.utils.ts` calculates SLA deadlines as flat hour offsets without business-hour exclusion. A `SystemSetting` table exists (`schema.prisma:470-478`) for potential future config. |
| Cloud storage (S3/GCS) | Deferred | All file storage is local filesystem via Multer disk storage: `uploads.controller.ts:45-55`. File URLs are relative (`/uploads/`). |

---

## 2. Implementation Gaps

### 2.1. Input Validation Covers 1 of 54 Endpoints

Only `POST /api/tickets` validates input with Zod (`tickets.controller.ts:20-26`). All other endpoints accept `body: any`:

- `tickets.controller.ts:65` — `updateStatus`: `body: any`
- `tickets.controller.ts:70` — `bulkUpdateStatus`: `body: any`
- `tickets.controller.ts:75` — `assign`: `body: any`
- `tickets.controller.ts:84` — `transfer`: `body: any`
- `tickets.controller.ts:91` — `addComment`: `body: any`
- `tickets.controller.ts:96` — `confirmResolution`: `body: any`
- `admin-users.controller.ts` — create/update/delete: `body: any`
- `admin-buildings.controller.ts:28` — create: `body: { nameAr: string; nameEn: string; isActive?: boolean }` (inline type, no runtime check)
- `analytics.controller.ts:85` — export: `startDate, endDate` as unvalidated strings from query

A `ZodValidationPipe` exists at `common/pipes/zod-validation.pipe.ts:1-21` but is never imported by any controller. Only `tickets.schema.ts:3-23` defines a Zod schema.

### 2.2. Refresh Token Has No Server-Side Invalidation

`auth.service.ts:123-125` — `logout()` returns `{ message: 'Logged out successfully' }`. The refresh token cookie is cleared on the client (`auth.controller.ts:52-56`), but nothing prevents use of a previously-issued refresh token for the remaining 7-day lifetime. No Redis blacklist, no DB revocation list, no rotation table exists.

### 2.3. IP/UserAgent Not Captured in Audit Logs

The `AuditLog` model (`schema.prisma:456-457`) defines `ipAddress` and `userAgent` columns, but all 36 instances of `auditLog.create()` across the codebase omit these fields. A full grep for `ipAddress` in backend source yields 0 results. The NestJS `Request` object has `req.ip` and `req.headers['user-agent']` available in the request lifecycle, but no interceptor or middleware extracts them for audit writes.

### 2.4. Analytics Method Ignores Controller Params

`analytics.controller.ts:51` calls:
```ts
this.analyticsService.getDepartmentPerformance(req.user.role, req.user.departmentId ?? null)
```
But `analytics.service.ts:150` defines:
```ts
async getDepartmentPerformance() {
  const depts = await this.prisma.department.findMany({ where: { deletedAt: null }, ...});
```
The method accepts **zero parameters** — the role and departmentId passed by the controller are silently discarded. A supervisor with this endpoint sees **all departments** instead of their own. By contrast, `getAgentPerformance()` at `analytics.service.ts:163-187` properly accepts and uses `userRole` and `userDeptId` params.

---

## 3. Dead Code

### 3.1. Passport JwtStrategy — Unused in Request Flow

`strategies/jwt.strategy.ts:9-30` defines a Passport `JwtStrategy` that is registered as a provider in `auth.module.ts:19` and `auth.module.ts:11` configures `PassportModule.register({ defaultStrategy: 'jwt' })`. However, the application uses a custom `JwtAuthGuard` (`jwt-auth.guard.ts:6-32`) that manually calls `verifyAccessToken()` from `auth.utils.ts` and performs its own DB checks. The Passport strategy is never invoked by any guard, middleware, or route handler. The `defaultStrategy: 'jwt'` setting has no effect because no code invokes `@UseGuards(AuthGuard())`.

### 3.2. Frontend `permissionCache.ts` — Never Imported

`frontend/src/core/permissionCache.ts:1-40` defines a client-side permission cache identical to its backend counterpart. Grep for `permissionCache` across the entire frontend yields 0 import references. This file is dead code.

### 3.3. Frontend `refreshStore.ts` — Never Imported

`frontend/src/store/refreshStore.ts:1-11` defines a Zustand store with `ticketRefreshKey` and `notifyTicketChange()`. Grep for `refreshStore` across the entire frontend yields 0 import references. This file is dead code.

### 3.4. Frontend `paths.ts` — Never Imported

`frontend/src/core/paths.ts:1-7` defines `PROJECT_ROOT`, `UPLOADS_DIR`, `AVATARS_DIR`, `EXPORTS_DIR`, `DIST_DIR` — server-side path constants. These are meaningless in a browser environment (`process.cwd()` in a Vite-built SPA returns undefined behavior). Grep for `from.*paths` across the frontend yields 0 import references.

### 3.5. Frontend `ErrorBoundary.tsx` — Never Used

`frontend/src/components/ErrorBoundary.tsx:1-58` defines a React error boundary class component. Grep for `ErrorBoundary` across the frontend finds only the self-references within the file. It is never imported into `App.tsx`, `main.tsx`, or any page component.

---

## 4. Security Gaps

These are documented in detail in `security-review-report.md`. Summarized here by category:

| Gap | Severity | Details |
|---|---|---|
| Hardcoded secrets in docker-compose.yml | Critical | `docker-compose.yml:7-8,43-44` — DB creds and JWT secrets in plaintext VCS |
| Hard deletes without audit (buildings/floors) | Medium | `admin-buildings.controller.ts:60`, `admin-floors.controller.ts:61` — no audit, no soft delete |
| Limited input validation (1/54 endpoints) | High | Only ticket creation validates input |
| Refresh token not invalidated | High | Valid for 7 days post-logout |
| IP/UserAgent not in audit logs | Medium | Schema fields exist but never populated |

---

## 5. Test Coverage Gaps

### 5.1. Untested Frontend Pages

The coverage `include` in `vitest.config.ts:21-26` covers `frontend/src/components/**/*.tsx`. However, **zero test files** target frontend pages directly. The following 18 pages exist with no corresponding tests:

| Page | File |
|---|---|
| Dashboard | `/frontend/src/pages/DashboardPage.tsx` |
| Inbox | `/frontend/src/pages/tickets/InboxPage.tsx` |
| Ticket Details | `/frontend/src/pages/tickets/TicketDetailsPage.tsx` |
| My Tickets | `/frontend/src/pages/tickets/MyTicketsPage.tsx` |
| New Ticket | `/frontend/src/pages/tickets/NewTicketPage.tsx` |
| Archive | `/frontend/src/pages/tickets/ArchivePage.tsx` |
| Transferred | `/frontend/src/pages/tickets/TransferredPage.tsx` |
| Analytics | `/frontend/src/pages/AnalyticsPage.tsx` |
| Login | `/frontend/src/pages/Login.tsx` |
| Audit Log | `/frontend/src/pages/AuditLogPage.tsx` |
| User Profile | `/frontend/src/pages/UserProfilePage.tsx` |
| Knowledge Base | `/frontend/src/pages/KnowledgeBasePage.tsx` |
| Team Feed | `/frontend/src/pages/TeamFeedPage.tsx` |
| Buildings | `/frontend/src/pages/admin/BuildingsPage.tsx` |
| Floors | `/frontend/src/pages/admin/FloorsPage.tsx` |
| Departments | `/frontend/src/pages/admin/DepartmentsPage.tsx` |
| User Management | `/frontend/src/pages/admin/UserManagementPage.tsx` |
| Role Management | `/frontend/src/pages/admin/RoleManagementPage.tsx` |
| Asset Management | `/frontend/src/pages/admin/AssetManagementPage.tsx` |
| Ticket Types | `/frontend/src/pages/admin/TicketTypesPage.tsx` |

### 5.2. Untested Backend Directories

From `vitest.config.ts:22-25`, coverage includes `backend/src/common/**/*.ts`, `backend/src/core/**/*.ts`, `backend/src/gateways/**/*.ts`, `backend/src/modules/**/*.ts`.

**Common/ — mostly untested:**
- `common/guards/jwt-auth.guard.ts` — no dedicated test
- `common/guards/roles.guard.ts` — no dedicated test
- `common/filters/global-exception.filter.ts` — no dedicated test
- `common/interceptors/mutation-logger.interceptor.ts` — no dedicated test
- `common/interceptors/request-id.interceptor.ts` — no dedicated test
- `common/pipes/zod-validation.pipe.ts` — no dedicated test
- `common/decorators/` — no dedicated test

**Core/ — mostly untested:**
- `core/permissionCache.ts` — no test (unused by frontend anyway)
- `core/paths.ts` — excluded from coverage by `vitest.config.ts:32`
- `core/arabic.ts` — no test
- `core/translations.ts` — no test
- `core/api.ts` — no test

**Gateways/ — untested:**
- `gateways/ticket.gateway.ts` — no test (socket gateway)
- `gateways/gateways.module.ts` — no test

### 5.3. Low Thresholds Are Not Adequate

`vitest.config.ts:15-19`:
```
statements: 50,  branches: 39,  functions: 35,  lines: 50
```
These thresholds are below production standards (typically 80%+ statements, 70%+ branches). Combined with the large number of untested files above, actual coverage is likely significantly below these already-low thresholds.

---

## 6. Data Consistency Issues

| Issue | Evidence | Impact |
|---|---|---|
| `relatedTickets` stored as JSON string | `schema.prisma:231` — `relatedTickets String?` with comment `// Stored as JSON array string`. `tickets.service.ts:865,867,869,870,893,895,897,898` — manual `JSON.parse()`/`JSON.stringify()` on link/unlink. | Not normalized, not indexable. Cannot query "find tickets related to X" without full table scan and JSON parsing. Prone to data corruption if string is malformed. |
| Ticket denormalization of building/floor/creator names | `schema.prisma:216-218` — stores `buildingName`, `floorName` as denormalized strings. | Risk of inconsistency if building/floor name changes after ticket creation. No cascade update mechanism exists. |
| `allowedTransferDeptIds` stored as string | `schema.prisma:183` — `allowedTransferDeptIds String?` in `UserPermissionOverride`. | Likely stored as JSON array string. Not queryable. No validation on format. |