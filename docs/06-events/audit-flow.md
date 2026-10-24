# Audit Flow Documentation

## AuditLog Model

**File:** `backend/prisma/schema.prisma:446-468`

```
AuditLog {
  id           Int        @id @default(autoincrement())
  userId       Int?       // Who performed the action
  action       String     // Action type (e.g., TICKET_CREATED, STATUS_CHANGED)
  entityType   String?    // Entity type (e.g., USER, DEPARTMENT, ASSET, KB_ARTICLE, KB_CATEGORY)
  entityId     Int?       // Entity ID
  departmentId Int?       // Department context
  ticketId     Int?       // Ticket context
  oldData      Json?      // Previous state snapshot
  newData      Json?      // New state snapshot
  ipAddress    String?    // Client IP (currently not populated in code)
  userAgent    String?    // Browser agent string (currently not populated in code)
  createdAt    DateTime   @default(now())
}
```

**Database Indexes** (`schema.prisma:463-466`):
- `@@index([userId])` — Filter logs by user
- `@@index([ticketId, createdAt])` — Filter by ticket, ordered by time
- `@@index([action, createdAt])` — Filter by action type
- `@@index([createdAt])` — Chronological queries

---

## Audit Endpoints

**Controller:** `backend/src/modules/audit/audit.controller.ts`

Both endpoints require JWT + Roles guard with `super_admin` only (`audit.controller.ts:11-13`).

### GET /api/audit

**Source:** `audit.controller.ts:16-37` / `audit.service.ts:10-49`

Returns paginated audit logs with optional filters:
- `userId` — filter by acting user
- `action` — filter by action string
- `departmentId` — filter by department
- `startDate` / `endDate` — date range filter (`audit.service.ts:24-32`)
- `ticketId` — filter by ticket
- `page` / `limit` — pagination (default: page 1, limit 20, max 100) (`audit.service.ts:4`)

Returns logs with joined `user`, `department`, and `ticket` relations (`audit.service.ts:37-45`).

### GET /api/audit/actions

**Source:** `audit.controller.ts:39-41` / `audit.service.ts:52-55`

Returns deduplicated list of all action strings via `groupBy(['action'])`.

---

## Immutability

**CONFIRMED:** No DELETE or UPDATE endpoints exist on `AuditLog`. The controller has only two GET endpoints (`audit.controller.ts:16,39`). No Prisma deleteMany or update operations target `AuditLog` anywhere in the codebase. Audit logs are write-once.

---

## MutationLoggerInterceptor

**File:** `backend/src/common/interceptors/mutation-logger.interceptor.ts`

A NestJS `NestInterceptor` that:
1. Checks `req.method !== 'GET'` (`mutation-logger.interceptor.ts:10`)
2. Logs to console via NestJS `Logger`: `[API_MUTATION] METHOD URL by email (role)` (`mutation-logger.interceptor.ts:12`)
3. Passes through with `next.handle()` (`mutation-logger.interceptor.ts:14`)

This is a **console-only** logging layer, distinct from the database audit log. It captures POST/PUT/DELETE/PATCH requests but does NOT persist to DB.

---

## Audit Log Entries — Complete Inventory

Every mutation in the system that writes an audit log entry. Each entry is a `prisma.auditLog.create()` call.

### Tickets Service (`backend/src/modules/tickets/tickets.service.ts`)

| Action | Trigger | Source Line | Data Captured |
|--------|---------|-------------|---------------|
| `TICKET_CREATED` | `create()` | `tickets.service.ts:164-167` | ticketNumber, subject, departmentId, priority, buildingName, floorName |
| `STATUS_CHANGED` | `updateStatus()` | `tickets.service.ts:464-473` | old status, new status, comment, ticketTypeId, external resource data, performer |
| `TICKET_REOPENED` | `updateStatus()` — reopen | `tickets.service.ts:466` | Same as STATUS_CHANGED |
| `ASSIGNED` | `assign()` | `tickets.service.ts:522-528` | old/new assignee ID and name, performer, timestamp |
| `TRANSFERRED` | `transfer()` | `tickets.service.ts:585-591` | from/to department ID/name, reason, performer |
| `USER_CONFIRMATION` | `confirmResolution()` | `tickets.service.ts:670-675` | from resolved, to closed, rating, feedback, performer |
| `STATUS_CHANGED` | `bulkUpdateStatus()` | `tickets.service.ts:719-722` | old status, new status, "Bulk update" comment |
| `ASSIGNED` | `bulkAssign()` | `tickets.service.ts:768-771` | old/new assignee, bulk performer |
| `DUE_DATE_CHANGED` | `updateDueDate()` | `tickets.service.ts:808-810` | old/new due date, performer |
| `TYPE_CHANGED` | `updateTicketType()` | `tickets.service.ts:845-847` | old/new type name, performer |
| `TICKET_LINKED` | `linkTickets()` | `tickets.service.ts:873-875` | target ticket ID/number |
| `TICKET_UNLINKED` | `unlinkTickets()` | `tickets.service.ts:901-903` | target ticket ID/number |
| `TICKET_ARCHIVED` | `archiveTicket()` | `tickets.service.ts:926-928` | performer, timestamp |
| `SUPER_ADMIN_OVERRIDE` | `superAdminOverride()` | `tickets.service.ts:966-968` | full old ticket data, updated fields list |
| `TICKET_ARCHIVED_BULK` | `bulkArchive()` | `tickets.service.ts:993-996` | performer, timestamp |

### Knowledge Service (`backend/src/modules/knowledge/knowledge.service.ts`)

| Action | Trigger | Source Line | Data Captured |
|--------|---------|-------------|---------------|
| `ARTICLE_CREATED` | `create()` | `knowledge.service.ts:145-147` | titleAr/En, categoryId |
| `ARTICLE_UPDATED` | `update()` | `knowledge.service.ts:166-172` | old title, new title/category/isActive |
| `ARTICLE_DELETED` | `remove()` | `knowledge.service.ts:183-188` | old titleAr/En |
| `CATEGORY_CREATED` | `createCategory()` | `knowledge.service.ts:201-203` | nameAr/En |
| `CATEGORY_UPDATED` | `updateCategory()` | `knowledge.service.ts:213-220` | old/new nameAr/En |
| `CATEGORY_DELETED` | `removeCategory()` | `knowledge.service.ts:233-238` | old nameAr/En |

### Admin Users Controller (`backend/src/modules/admin/controllers/admin-users.controller.ts`)

| Action | Trigger | Source Line | Data Captured |
|--------|---------|-------------|---------------|
| `USER_CREATED` | `create()` | `admin-users.controller.ts:82-89` | badgeNumber, username, role, departmentId |
| `USER_UPDATED` | `update()` | `admin-users.controller.ts:125-133` | old role/isActive, new role/isActive/departmentId |
| `PASSWORD_RESET` | `resetPassword()` | `admin-users.controller.ts:155-163` | forcePasswordChange flag |
| `USER_DEACTIVATED` | `remove()` | `admin-users.controller.ts:176-181` | — |

### Admin Roles Controller (`backend/src/modules/admin/controllers/admin-roles.controller.ts`)

| Action | Trigger | Source Line | Data Captured |
|--------|---------|-------------|---------------|
| `ROLE_UPDATED` | `updateRole()` | `admin-roles.controller.ts:49-58` | old name, new name/permissionIds |
| `ROLE_DELETED` | `removeRole()` | `admin-roles.controller.ts:80-85` | old name |

**NOTE:** `createRole()` does NOT create an audit entry. Only update and delete are logged.

### Admin Departments Controller (`backend/src/modules/admin/controllers/admin-departments.controller.ts`)

| Action | Trigger | Source Line | Data Captured |
|--------|---------|-------------|---------------|
| `DEPT_CREATED` | `create()` | `admin-departments.controller.ts:49-56` | nameEn, deptType, slaHours |
| `DEPT_UPDATED` | `update()` | `admin-departments.controller.ts:81-89` | old/new nameEn, isActive, deptType |
| `DEPT_DEACTIVATED` | `remove()` | `admin-departments.controller.ts:103-110` | — |

### Assets Service (`backend/src/modules/assets/assets.service.ts`)

| Action | Trigger | Source Line | Data Captured |
|--------|---------|-------------|---------------|
| `ASSET_CREATED` | `create()` | `assets.service.ts:50-55` | name, serialNumber, type, status |
| `ASSET_UPDATED` | `update()` | `assets.service.ts:97-101` | Changed fields only, with old/new diff |
| `ASSET_DELETED` | `remove()` | `assets.service.ts:115-117` | — |

### Cron Service (`backend/src/modules/jobs/cron.service.ts`)

| Action | Trigger | Source Line | Data Captured |
|--------|---------|-------------|---------------|
| `AUTO_ARCHIVED` | `autoArchive()` | `cron.service.ts:135-143` | ticketId, reason: "Auto-archived after 30 days of inactivity" |

---

## Cron Jobs that Write Audit Logs

**File:** `backend/src/modules/jobs/cron.processor.ts` — BullMQ processor for `cron-jobs` queue.

Jobs are dispatched via:
- `sla-check` — SLA checking (no audit entries, only notifications)
- `auto-archive` — Auto-archive + audit log (`cron.service.ts:113-145`)
- `cleanup-exports` — Delete expired exports (no audit entries)

---

## Audit Gaps — Operations WITHOUT Audit Logs

### No audit log written:

1. **Login / Logout** — `auth.service.ts` has no audit writes
2. **Failed login attempts** — `auth.service.ts:55-65` — no audit trail
3. **Account lockout** — `auth.service.ts:39-51` — no audit trail
4. **Token refresh** — `auth.service.ts:95-121` — no audit writes
5. **User profile update** — `users.controller.ts:22` — no audit writes
6. **Avatar upload** — `users.controller.ts:31` — no audit writes
7. **Notification read** — `notifications.service.ts:43-51` — no audit writes
8. **Notification subscribe/unsubscribe** — `notifications.service.ts:54-69` — no audit writes
9. **Team note creation** — `team-notes.service.ts:43-75` — no audit writes
10. **Team note comments** — `team-notes.service.ts:77-91` — no audit writes
11. **Team note likes** — `team-notes.service.ts:93-112` — no audit writes
12. **Team note deletion** — `team-notes.service.ts:131-140` — no audit writes
13. **Ticket comment** — `tickets.service.ts:603-648` — no audit writes (comments stored as TicketMessage)
14. **Export file download** — `analytics.service.ts:279-353` — ExportHistory record created but no AuditLog entry
15. **File uploads** — `uploads` module — no audit writes
16. **Transfer allowlist management** — NOT CONFIRMED — no allowlist management controller found

### ipAddress / userAgent: Never Populated

**ALL** `prisma.auditLog.create()` calls across the codebase omit `ipAddress` and `userAgent`. These fields exist in the schema but are never written. The `request` object (which has IP and user agent) is not passed to services. This is a gap for forensic audit compliance.

---

## Audit Log Lifecycle

```
Mutation → prisma.auditLog.create() → Immutable record (no DELETE/UPDATE endpoints)
                                ↓
                    GET /api/audit (super_admin)
                    GET /api/audit/actions (super_admin)
```

The audit log grows unbounded. No retention policy or cleanup cron exists.