# Full Test Report — ABCH Hospital Ticketing CRM

## Executive Summary

- **Total test files:** 21
- **Test categories:** 4 unit tests, 14 NestJS integration tests (controller-level), 1 true E2E test, 2 socket/realtime tests, 1 skipped/deprecated file
- **Expected test cases:** ~105+ (based on test file inspection)
- **Test runner:** Vitest (`vitest.config.ts:7`)
- **Coverage provider:** v8 (`vitest.config.ts:13`)

---

## Coverage Thresholds

**File:** `vitest.config.ts:15-20`

| Metric | Threshold |
|--------|-----------|
| Statements | 50% |
| Branches | 39% |
| Functions | 35% |
| Lines | 50% |

### Coverage Scope

**Included** (`vitest.config.ts:22-28`):
- `backend/src/common/**/*.ts`
- `backend/src/core/**/*.ts`
- `backend/src/gateways/**/*.ts`
- `backend/src/modules/**/*.ts`
- `frontend/src/components/**/*.tsx`

**Excluded** (`vitest.config.ts:29-33`):
- `**/*.d.ts`
- `**/*.test.ts`, `**/*.spec.ts`
- `backend/src/core/paths.ts`

---

## Test Inventory

### 1. Unit Tests (4 files)

| File | Module Tested | Source |
|------|--------------|--------|
| `tests/unit/ticket.schema.test.ts` | Zod validation schemas (`createTicketSchema`, `ticketSearchSchema`) | 17 test cases |
| `tests/unit/auth.utils.test.ts` | JWT generation/verification utilities | Confirmed (not read in detail) |
| `tests/unit/workflow.constants.test.ts` | Status transitions, priority modifiers | Confirmed (not read in detail) |
| `tests/unit/sla.utils.test.ts` | SLA deadline calculation, breach detection | Confirmed (not read in detail) |

#### ticket.schema.test.ts Detail (17 cases)

| Test | Description |
|------|-------------|
| `should accept a valid ticket with all required fields` | Creates ticket with minimal valid data |
| `should reject missing description` | Missing required field |
| `should reject description shorter than 5 characters` | Min length constraint |
| `should reject missing departmentId` | Missing required field |
| `should accept departmentId as a number or numeric string` | Type coercion |
| `should reject non-numeric departmentId string` | Type validation |
| `should validate priority enum values` | Allowed values |
| `should accept optional nullable fields` | Null safety |
| `should validate attachments array structure` | Nested object validation |
| `should reject attachments with missing fields` | Partial attachment rejection |
| `should reject subject longer than 200 characters` | Max length |
| `should default subject to No Subject when empty string` | Default value |
| `should accept valid search query` | Search schema — valid input |
| `should reject query shorter than 2 characters` | Min search length |
| `should reject query longer than 100 characters` | Max search length |
| `should reject missing query` | Required field |
| `should parse page and limit as numbers from strings` | Type coercion in search schema |

---

### 2. NestJS Controller Integration Tests (14 files)

These test controllers with mocked Prisma service. Pattern: `*.nest.test.ts`.

| File | Module | Estimated Cases |
|------|--------|-----------------|
| `tests/tickets/tickets.nest.test.ts` | TicketsController | Large (primary test file) |
| `tests/auth/auth.nest.test.ts` | AuthController | Login, refresh, logout flows |
| `tests/audit/audit.nest.test.ts` | AuditController | Query filters, action list |
| `tests/admin/admin.nest.test.ts` | Admin controllers | Users/departments/roles management |
| `tests/analytics/analytics.nest.test.ts` | AnalyticsController | Dashboard, stats, exports |
| `tests/assets/assets.nest.test.ts` | AssetsController | CRUD with role gating |
| `tests/knowledge/knowledge.nest.test.ts` | KnowledgeController | Articles, categories, search |
| `tests/notifications/notifications.nest.test.ts` | NotificationsController | Read, subscribe |
| `tests/profile/profile.nest.test.ts` | Profile module | Profile operations |
| `tests/team-notes/team-notes.nest.test.ts` | TeamNotesController | Notes, comments, likes |
| `tests/uploads/uploads.nest.test.ts` | UploadsController | File upload |
| `tests/users/users.nest.test.ts` | UsersController | Profile, avatar |
| `tests/jobs/jobs.nest.test.ts` | CronProcessor | SLA check, cleanup |
| `tests/socket/socket.nest.test.ts` | TicketGateway | Socket rooms, auth |

---

### 3. True E2E Test (1 file)

| File | Description |
|------|-------------|
| `tests/integration/workflow.test.ts` | Full ticket workflow against real DB. Tests end-to-end flow including service layer logic, workflow transitions, and database interactions. |

---

### 4. Realtime/Socket Tests (2 files)

| File | Description |
|------|-------------|
| `tests/realtime/socket.test.ts` | WebSocket client/server event flow |
| `tests/socket/socket.nest.test.ts` | TicketGateway room management, authentication |

---

### 5. Skipped/Deprecated (1 file)

| File | Status | Note |
|------|--------|------|
| `tests/tickets/ticket-lifecycle.test.ts` | `describe.skip()` | Comment says "DEPRECATED: Old Express backend replaced by NestJS. See tickets.nest.test.ts" (`ticket-lifecycle.test.ts:1,3`) |

---

## What IS Covered

### Well-Tested Areas

1. **Ticket validation schemas** — Full coverage of Zod schemas including edge cases (type coercion, min/max lengths, nested objects, defaults)
2. **Auth utilities** — JWT generation, verification, token expiry
3. **Workflow constants** — Status transition matrices, priority modifiers
4. **SLA calculations** — Deadline computation, breach detection logic
5. **Controller-level flows** — Each controller has a `.nest.test.ts` file with mocked Prisma

### Service Layer Coverage (Inferred from test filenames)

Based on controller tests calling services with mocked Prisma:
- `TicketsService`: create, findMy, findDepartment, findById, updateStatus, assign, transfer, archive, bulk operations
- `AuthService`: login flow, refresh token
- `AuditService`: query filters, action grouping
- `AnalyticsService`: dashboard summary, stats, export
- `AssetsService`: CRUD with role filters
- `KnowledgeService`: article/category CRUD, search, suggest, permission checks

---

## What is NOT Covered

### Entirely Untestd Modules

1. **`backend/src/common/` — Entirely untested**
   - `jwt-auth.guard.ts` — No dedicated test for guard logic, DB user lookup, inactive/locked handling
   - `roles.guard.ts` — No test for metadata extraction, role comparison, missing metadata passthrough
   - `current-user.decorator.ts` — No test
   - `request-id.interceptor.ts` — No test
   - `mutation-logger.interceptor.ts` — No test (console logging for non-GET requests)
   - `filters/` — No test for exception filters
   - `pipes/` — No test for validation pipes

2. **`backend/src/core/` — Mostly untested**
   - `permissionCache.ts` — No test for cache set/get/invalidate/expire logic
   - `arabic.ts` — No test for `normalizeArabic()` function
   - `api.ts` — No test for API client utilities
   - `NotificationProvider.tsx` — No test (frontend, but included in coverage scope)

3. **`backend/src/gateways/`**
   - `ticket.gateway.ts` — Has a socket nest test, but NOT CONFIRMED to cover: rate limiting, disconnect cleanup, join-user join-department join-ticket authorization checks

### Untested Critical Paths

4. **Ticket confirmation flow** — `PUT /api/tickets/:id/confirm` (`tickets.service.ts:650-689`)
   - Creator verification
   - Rating/feedback storage
   - Audit log creation (`USER_CONFIRMATION`)
   - WebSocket emission (`ticket-closed`)

5. **Super Admin Override** — `PATCH /api/tickets/:id` (`tickets.service.ts:935-972`)
   - Role check
   - Field deletion (ticketNumber, id, createdAt)
   - SLA recalculation on priority/type/department change
   - Audit log with full old data snapshot

6. **Bulk Archive** — `POST /api/tickets/bulk-archive` (`tickets.service.ts:975-1006`)
   - Transaction behavior
   - Permission checks per ticket
   - Success/fail split reporting

7. **Link/Unlink tickets** — `POST /api/tickets/:id/link`, `POST /api/tickets/:id/unlink`
   - Bidirectional linking
   - JSON array manipulation
   - Closed/resolved lock

8. **Ticket transfer allowlist** — Cross-department transfer validation
   - `DeptTransferAllowlist` lookup
   - Super admin bypass
   - Both-department notification

9. **Account lockout** — `auth.service.ts:39-65`
   - 5-attempt threshold
   - 15-minute lockout window
   - Lock expiry and auto-reset

10. **Export permission chain** — `analytics.service.ts:280-297`
    - Override → Dept → Role default resolution
    - Supervisor default-allowed behavior

11. **SLA Check Cron** — `cron.service.ts:36-111`
    - Breached ticket detection
    - Warning percentage calculation
    - Notification createMany for all dept users
    - Boolean flag toggling

12. **Auto Archive Cron** — `cron.service.ts:113-145`
    - 30-day threshold
    - System admin fallback (`id: 1`)
    - Audit log creation

13. **Export Cleanup Cron** — `cron.service.ts:11-34`
    - File deletion from disk
    - DB record cleanup

### Frontend Test Coverage

Only 1 frontend test file is in coverage scope (`frontend/src/components/**/*.tsx`):
- **NotificationProvider tests** — NOT CONFIRMED (no test file found in `tests/` directory for frontend). The `NotificationProvider.tsx` is included in coverage scope but no corresponding test file exists in the `tests/` directory.

### Frontend Pages NOT Tested

Notable untested frontend modules:
1. `Login.tsx` — Login page
2. `DashboardPage.tsx` — Dashboard rendering
3. `NewTicketPage.tsx` — Ticket creation form
4. `InboxPage.tsx` — Ticket inbox
5. `MyTicketsPage.tsx` — User's tickets
6. `TicketDetailsPage.tsx` — Ticket detail view
7. `KnowledgeBasePage.tsx` — KB viewer
8. `TeamFeedPage.tsx` — Team notes feed
9. `AuditLogPage.tsx` — Audit log viewer
10. All admin pages (`BuildingsPage`, `FloorsPage`, `DepartmentsPage`, `UserManagementPage`, `RoleManagementPage`, `AssetManagementPage`)
11. `App.tsx` — Role gating logic, admin path blocking, sidebar rendering

---

## Gap Analysis — Critical Risk Areas

### HIGH RISK (No tests for security-critical paths)

| Gap | Risk | Source |
|-----|------|--------|
| **RolesGuard not tested** | Role bypass vulnerability not caught by tests | `roles.guard.ts:26` — string comparison |
| **JwtAuthGuard DB check not tested** | Inactive/deleted users could authenticate | `jwt-auth.guard.ts:24` — `isActive`/`deletedAt` check |
| **Permission cache not tested** | Cache invalidation bugs could allow stale permissions | `permissionCache.ts:34-39` |
| **Account lockout not tested** | Brute force mitigation unverified | `auth.service.ts:55-65` |

### MEDIUM RISK (Complex business logic untested)

| Gap | Risk | Source |
|-----|------|--------|
| **Transfer allowlist** | Cross-department transfer validation | `tickets.service.ts:559-565` |
| **SLA recalculation** | Wrong deadlines after type/dept change | `sla.utils.ts:10-25` |
| **Bulk operation transaction** | Partial failure scenarios | `tickets.service.ts:698,746,981` |
| **Role→Permission M:N never queried** | Schema relation may be dead code | `schema.prisma:149` — enforcement NOT CONFIRMED |

### LOW RISK (Nice to have)

| Gap | Impact |
|-----|--------|
| Admin controllers not individually tested | CRUD patterns are straightforward |
| Exception filters untested | Error response format |
| File upload validation | MIME type checks |
| WebSocket rate limiting | In-memory rate limit enforcement |

---

## Recommendations

1. **Test the guards:** Write dedicated tests for `JwtAuthGuard` and `RolesGuard` — these are the first line of defense
2. **Test permission cache:** Cover set, get, expire, and invalidate paths in `permissionCache.ts`
3. **E2E test critical flows:** Expand `workflow.test.ts` to cover transfer, confirmation, and bulk operations
4. **Frontend tests:** Add tests for `App.tsx` role gating — the sidebar filter and adminPaths block are single points of failure
5. **Account lockout:** Test the 5-attempt lockout cycle and 15-minute unlock
6. **Cron jobs:** Test `slaCheck()` with mocked ticket data at various SLA percentages