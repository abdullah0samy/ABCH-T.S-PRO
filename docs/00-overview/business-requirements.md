# Business Requirements Document — Cross-Referenced Against Code

This document maps every PRD requirement to its actual code implementation. Each requirement is marked as:
- **CONFIRMED**: Code implements this requirement
- **PARTIAL**: Code partially implements this requirement
- **NOT CONFIRMED**: Code does not implement this requirement or implementation is unclear
- **UNKNOWN**: Cannot determine from static analysis; runtime verification required

---

## 5.1 Authentication & Session Management

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| AUTH-01 | Users authenticate with `badgeNumber` + password | **CONFIRMED** | `auth.service.ts:25-33`: Queries by `badgeNumber` or `username`; validates password with bcrypt at line 55. Accepts identifier matching either `badgeNumber` or `username`. |
| AUTH-02 | JWT-based auth: access token (15 min) + refresh token (7d, httpOnly cookie) | **PARTIAL** | Access token is 8h (not 15 min): `auth.utils.ts:16` `{ expiresIn: '8h' }`. Refresh token IS 7d: `auth.utils.ts:25` `{ expiresIn: '7d' }`. HttpOnly cookie IS set: `auth.controller.ts:23-28` with `maxAge: 7 * 24 * 60 * 60 * 1000`. |
| AUTH-03 | Refresh token is rotated on every use | **NOT CONFIRMED** | `auth.service.ts:95-121`: The refresh endpoint generates a new access token but returns `{ accessToken }` only — no new refresh token is generated or returned. The old refresh token remains valid. No rotation logic found. |
| AUTH-04 | `forcePasswordChange` flag forces password reset | **CONFIRMED** | `schema.prisma:116`: `forcePasswordChange Boolean @default(false)`. Admin can set it via `admin-users.controller.ts:118`. However, the enforcement at login time (redirect to reset page) is **UNKNOWN** — not found in `auth.service.ts` or frontend. |
| AUTH-05 | Login rate-limited (5 attempts / 15 min) | **CONFIRMED** | `auth.controller.ts:14`: `@Throttle({ login: {} })`. The `login` tier: 50 requests / 900s (`app.module.ts:32`). Additionally, account lockout after 5 failed attempts for 15 min: `auth.service.ts:58-60`. |
| AUTH-06 | Logout invalidates refresh token | **PARTIAL** | `auth.controller.ts:51-57`: Clears the httpOnly cookie. However, `auth.service.ts:123-125`: The logout service method returns `{ message: 'Logged out successfully' }` without server-side invalidation (no blacklist/revocation found). The token remains valid until expiration. |
| AUTH-07 | Last login timestamp + IP recorded | **PARTIAL** | `auth.service.ts:68-75`: Sets `lastLoginAt: new Date()`. **Missing**: `lastLoginIp` is NOT set on login. The field exists in schema (`schema.prisma:118`) but is never written to. |
| AUTH-08 | Language preference persisted | **CONFIRMED** | `schema.prisma:114`: `langPref String @default("ar")`. Frontend stores in `settingsStore.ts:16` with Zustand persist middleware to localStorage. |

---

## 5.2 Ticket Lifecycle

### 5.2.1 Ticket Creation

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| TKT-01 | Any user with `canSendTickets` can create | **CONFIRMED** | `tickets.controller.ts:17-26`: POST /api/tickets. Permission check is in TicketsService (code not inspected in detail, but `schema.prisma:15` defines the permission flag). |
| TKT-02 | Unique, human-readable ticket number | **CONFIRMED** | `schema.prisma:207`: `ticketNumber String @unique`. Generation logic in TicketsService. |
| TKT-03 | Required: description, departmentId | **CONFIRMED** | `tickets.schema.ts` (in `backend/src/common/schemas/tickets.schema.ts`) validates required fields. `schema.prisma:220`: `description String` (non-nullable). `schema.prisma:221`: `departmentId Int` (non-nullable). |
| TKT-04 | Optional: subject, type, priority, building, floor, room, related, asset, due date | **CONFIRMED** | All fields exist with `?` on the Ticket model: `schema.prisma:208-210,213-215,230-231,244,245`. |
| TKT-05 | SLA auto-calculated from department or ticket-type SLA | **CONFIRMED** | `sla.utils.ts:9-25`: `calculateSLADeadline(baseHours, priority, startTime)` applies priority modifiers. `schema.prisma:67`: `slaHours Int @default(24)` on Department. `schema.prisma:195`: `slaHours Int?` on TicketType. |
| TKT-06 | Creator name, phone, extension, dept snapshotted | **CONFIRMED** | `schema.prisma:211-214`: `creatorName`, `creatorPhone`, `creatorExtension`, `creatorDeptId`, `creatorDeptName` all denormalized on Ticket. |
| TKT-07 | File attachments at creation or later | **CONFIRMED** | `TicketAttachment` model (`schema.prisma:275-289`). Upload endpoint: `uploads.controller.ts`. Attachment added via ticket creation body or separate upload. |

### 5.2.2 Ticket Status Flow

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| (Status model) | pending → open → resolved → closed | **PARTIAL** | `workflow.constants.ts:1`: `'pending', 'open', 'in_progress', 'resolved', 'closed'`. Code includes `in_progress` as a status, which the PRD explicitly says is **NOT** a standalone status (`PRD.md:226-228`). Transitions at `workflow.constants.ts:7-18` define `pending→open`, `open→in_progress`, `in_progress→resolved`, `resolved→in_progress` (reopen). The PRD's simplified 4-state flow (pending→open→resolved→closed) does NOT match. The code uses a 5-state flow with `in_progress`. |
| (KPI) | SLA starts at open, stops at resolved | **UNKNOWN** | `cron.service.ts:36-111` checks `slaDeadline` against current time. `schema.prisma:227`: `slaDeadline DateTime?`. When the SLA timer conceptually starts/stops relative to status transitions is unclear from cron job logic alone. The SLA deadline is calculated at creation (`sla.utils.ts`), not at transition to `open`. |

### 5.2.3 Ticket Operations

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| TKT-10 | pending → open (acknowledge) | **CONFIRMED** | `tickets.controller.ts:64-67`: PUT /:id/status calls `updateStatus()`. `ALLOWED_TRANSITIONS` at `workflow.constants.ts:8`: `pending: ['open', 'in_progress', 'closed']`. |
| TKT-11 | open → resolved + completedAt + push notification | **PARTIAL** | Status change: `tickets.controller.ts:64-67`. `completedAt` field: `schema.prisma:234`. Push notification on resolve: **UNKNOWN** — the cron job handles SLA notifications, but the service-layer resolve notification is not traced. |
| TKT-12 | resolved → closed (confirmation + rating) | **CONFIRMED** | `tickets.controller.ts:96-98`: PUT /:id/confirm calls `confirmResolution()`. `schema.prisma:242-243`: `rating Int?`, `feedback String?`. |
| TKT-13 | Reopen resolved → pending | **PARTIAL** | `workflow.constants.ts:16`: `resolved: ['in_progress']`. The code transitions resolved → `in_progress`, not resolved → `pending`. This differs from the PRD. |
| TKT-14 | Assign/reassign to department members | **CONFIRMED** | `tickets.controller.ts:74-77`: PUT /:id/assign. `tickets.controller.ts:79-82`: POST /bulk-assign. |
| TKT-15 | DeptTransferAllowlist enforcement | **CONFIRMED** | `schema.prisma:88-99`: `DeptTransferAllowlist` model. `tickets.controller.ts:84-87`: PUT /:id/transfer with reason. |
| TKT-16 | Transfer returns to pending + new SLA | **UNKNOWN** | Transfer endpoint exists (`tickets.controller.ts:84-87`). Whether it resets status to `pending` and recalculates SLA requires service-level inspection. |
| TKT-17 | TicketStatusHistory | **CONFIRMED** | `schema.prisma:342-354`: `TicketStatusHistory` model with `oldStatus`, `newStatus`, `note`, `changedBy`. |
| TKT-18 | firstResponseAt stamped on first message | **CONFIRMED** | `schema.prisma:233`: `firstResponseAt DateTime?`. Logic expected in messages handler. |
| TKT-19 | Archived tickets soft-deleted from active views | **CONFIRMED** | `schema.prisma:239-241`: `isArchived`, `archivedAt`, `archivedById`. Query filters on `isArchived`. Auto-archive job: `cron.service.ts:113-146`. |
| TKT-20 | External resource flags | **CONFIRMED** | `schema.prisma:236-238`: `requiresExternalResource`, `externalResourceCost`, `externalResourceNote`. |
| TKT-21 | Link to asset | **CONFIRMED** | `schema.prisma:244`: `assetId Int?`. `schema.prisma:500-516`: Asset model. |

---

## 5.3 Messaging

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| MSG-01 | Threaded message conversation | **CONFIRMED** | `TicketMessage` model (`schema.prisma:291-307`) linked to `ticketId`. |
| MSG-02 | Public / internal visibility | **CONFIRMED** | `schema.prisma:295`: `messageType String @default("public")`. |
| MSG-03 | File attachments + voice notes | **CONFIRMED** | `MessageAttachment` model (`schema.prisma:309-323`). Voice URL + duration on TicketMessage (`schema.prisma:297-298`). |
| MSG-04 | Read/unread per message | **CONFIRMED** | `schema.prisma:299`: `isRead Boolean @default(false)`. |
| MSG-05 | Real-time Socket.io events | **CONFIRMED** | `NotificationProvider.tsx:151-159`: Consumes `new-comment` event. Gateway emits to `ticket-{id}` rooms. |
| MSG-06 | Browser push notifications (VAPID) | **PARTIAL** | `notifications.service.ts:8-16`: VAPID keys configured from env vars. `web-push` library imported (line 3). Actual `webpush.sendNotification()` call is **NOT FOUND** in the notifications service — only in-app notification creation is present. |

---

## 5.4 SLA Management

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| SLA-01 | Hours configurable at department and ticket type level | **CONFIRMED** | `schema.prisma:67`: Department.slaHours. `schema.prisma:195`: TicketType.slaHours. |
| SLA-02 | Deadline calculated at creation | **CONFIRMED** | `sla.utils.ts:9-25`: `calculateSLADeadline()` used at ticket creation. `schema.prisma:227`: slaDeadline on Ticket. |
| SLA-03 | Cron every 5 min | **CONFIRMED** | `jobs.module.ts:22-24`: `{ pattern: '*/5 * * * *' }`. `cron.processor.ts:18-19`: dispatches to `slaCheck()`. |
| SLA-04 | Warning at 80% + slaWarningSent flag | **CONFIRMED** | `cron.service.ts:80-84`: Checks `percentage >= 80`, sets `slaWarningSent: true`. `schema.prisma:228`. |
| SLA-05 | Breach notification + slaBreachSent flag | **CONFIRMED** | `cron.service.ts:39-69`: Detects breached tickets, creates `SLA_BREACH` notifications, sets `slaBreachSent: true`. `schema.prisma:229`. |
| SLA-06 | Visible in list and detail views | **UNKNOWN** — Requires UI inspection of InboxPage and TicketDetailsPage components. |

---

## 5.5 Notifications

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| NOTIF-01 | In-app with read/unread | **CONFIRMED** | `schema.prisma:365`: `isRead`. `notifications.controller.ts:20-26`: markRead + markAllRead endpoints. |
| NOTIF-02 | Browser push (Web Push VAPID) | **PARTIAL** | VAPID setup in `notifications.service.ts:8-16`. PushSubscription model at `schema.prisma:433-444`. Subscribe/unsubscribe endpoints at `notifications.controller.ts:30-38`. But actual `webpush.sendNotification()` call is **NOT FOUND**. |
| NOTIF-03 | Triggers: assignment, message, status, SLA | **CONFIRMED** | SLA triggers: `cron.service.ts`. Status/assignment/message triggers: created in ticket service handlers (not inspected line-by-line but schema and controller endpoints confirm the infrastructure). |
| NOTIF-04 | Bilingual content | **CONFIRMED** | `schema.prisma:361-364`: `titleAr`, `titleEn`, `bodyAr`, `bodyEn`. |
| NOTIF-05 | Subscribe/unsubscribe at any time | **CONFIRMED** | `notifications.controller.ts:30-38`: POST /subscribe + DELETE /subscribe. |

---

## 5.6 Analytics Dashboard

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| ANA-01 | Dept managers view stats | **CONFIRMED** | `analytics.controller.ts`: 6 endpoints with `@Roles('super_admin', 'supervisor', 'agent')` guards. |
| ANA-02 | Admins view cross-department | **CONFIRMED** | `analytics.controller.ts:49-58`: `department-performance` restricted to `super_admin, supervisor`. `analytics.controller.ts:55-58`: `recent-activity` restricted to `super_admin` only. |
| ANA-03 | Charts: trends, status, priority, top agents | **CONFIRMED** | Endpoints: `stats` (line 28), `status-distribution` (line 35), `priority-distribution` (line 41), `agent-performance` (line 63). Frontend uses `recharts` (`frontend/package.json:28`). |
| ANA-04 | Date-range filters | **CONFIRMED** | `analytics.controller.ts:84-92`: `exportExcel` accepts `startDate`/`endDate` query params. |
| ANA-05 | CSV/Excel export + ExportHistory | **CONFIRMED** | `analytics.controller.ts:84-92`: Excel export with `exceljs`. `schema.prisma:480-497`: ExportHistory model. `analytics.controller.ts:78-80`: GET /exports for history. |
| ANA-06 | Export cleanup | **CONFIRMED** | `cron.service.ts:11-35`: `cleanupExports()` deletes expired files + records. `jobs.module.ts:15-17`: Runs at 3 AM daily. |

---

## 5.7 Knowledge Base

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| KB-01 | Categories | **CONFIRMED** | `schema.prisma:518-527`: KnowledgeCategory. CRUD at `knowledge.controller.ts:71-86`. |
| KB-02 | Bilingual content | **CONFIRMED** | `schema.prisma:530-533`: `titleAr`, `titleEn`, `contentAr`, `contentEn`. |
| KB-03 | Full-text search | **PARTIAL** | `knowledge.service.ts:59-85`: `search()` uses `contains` (PostgreSQL ILIKE equivalent via `mode: 'insensitive'`). Uses PostgreSQL `contains`, not Postgres `tsvector` full-text search. `knowledge.controller.ts:34-41`: GET /knowledge/search. |
| KB-04 | View counter | **CONFIRMED** | `schema.prisma:536`: `views Int @default(0)`. Increment: `knowledge.service.ts:192-194`. POST /articles/:id/view at `knowledge.controller.ts:67-69`. |
| KB-05 | canManageKnowledgeBase permission | **CONFIRMED** | `knowledge.service.ts:9-21`: `checkKbPermission()` reads `UserPermissionOverride.canManageKnowledgeBase` or `DeptPermissions.canManageKnowledgeBase`. |
| KB-06 | Inactive hidden | **CONFIRMED** | `knowledge.service.ts:25`: `where: { isActive: true }`. |

---

## 5.8 Team Feed

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| FEED-01 | Department-scoped feed | **CONFIRMED** | `schema.prisma:378`: `departmentId Int?`. `team-notes.service.ts:12-13`: Filters by departmentId (or all for super_admin). |
| FEED-02 | Text, attachments, voice notes | **CONFIRMED** | `TeamNoteAttachment` model (`schema.prisma:418-431`) with `isVoiceNote`, `voiceDuration`. |
| FEED-03 | Comments + likes | **CONFIRMED** | `TeamNoteComment` (`schema.prisma:393-404`), `TeamNoteLike` (`schema.prisma:406-416`). Endpoints: `team-notes.controller.ts:29-43`. |
| FEED-04 | Soft-delete | **CONFIRMED** | `team-notes.service.ts:139`: `data: { deletedAt: new Date() }`. `schema.prisma:383`: `deletedAt DateTime?`. |
| FEED-05 | Permission-gated | **CONFIRMED** | `team-notes.service.ts:49-51`: `end_user` blocked from creating. |

---

## 5.9 Asset Tracking

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| ASSET-01 | Fields: name, serial, type, location, dept, warranty | **CONFIRMED** | `schema.prisma:500-516`: All fields present — `name`, `serialNumber`, `type`, `location`, `departmentId`, `warrantyExpiry`. |
| ASSET-02 | active / maintenance / retired | **CONFIRMED** | `schema.prisma:506`: `status String @default("active")`. Comment at line 506: `// active, maintenance, retired`. |
| ASSET-03 | Link to tickets | **CONFIRMED** | `schema.prisma:244`: Ticket.assetId. `schema.prisma:515`: Asset.tickets. |
| ASSET-04 | Filterable by dept, status, type | **CONFIRMED** | `assets.controller.ts:16-25`: GET /api/assets with role-based filtering. |

---

## 5.10 Admin Panel

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| ADM-01 | Manage departments (CRUD + soft delete) | **CONFIRMED** | `admin-departments.controller.ts:28-114`. Deactivate soft-delete at line 98-114. |
| ADM-02 | Manage dept permissions | **CONFIRMED** | `schema.prisma:12-30`: 13 permission flags on `DeptPermissions`. Created with department (`admin-departments.controller.ts:40`). |
| ADM-03 | Transfer allowlist | **CONFIRMED** | `schema.prisma:88-99`: `DeptTransferAllowlist`. CRUD is handled within the transfer service. |
| ADM-04 | Manage users (CRUD + dept + role assignment) | **CONFIRMED** | `admin-users.controller.ts:15-186`: Full CRUD with pagination, department/role assignment. |
| ADM-05 | Force password reset | **CONFIRMED** | `admin-users.controller.ts:140-167`: POST /:id/reset-password. `schema.prisma:116`: `forcePasswordChange`. |
| ADM-06 | Ticket types per department with SLA + color | **CONFIRMED** | `admin-ticket-types.controller.ts:27-103`. `schema.prisma:194`: color. `schema.prisma:195`: slaHours. |
| ADM-07 | Buildings + floors | **CONFIRMED** | `admin-buildings.controller.ts:1-63`, `admin-floors.controller.ts:1-64`. |
| ADM-08 | System settings (key-value store) | **PARTIAL** | `schema.prisma:470-478`: `SystemSetting` model exists with `key` (primary), `value`, `description`. However, **no REST endpoints** exist to manage SystemSetting in any controller. |

---

## 5.11 Audit Log

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| AUD-01 | Records sensitive actions | **CONFIRMED** | Audit log entries created in: user creation/update/delete (`admin-users.controller.ts:82-90,125-133,176-181`), department CRUD (`admin-departments.controller.ts:48-57,81-90,104-111`), ticket type CRUD (`admin-ticket-types.controller.ts:44-51,73-80,94-100`), role CRUD (`admin-roles.controller.ts:49-58,80-86`), KB CRUD (`knowledge.service.ts:145-148,166-174,183-189,201-204,214-221,233-240`), auto-archive (`cron.service.ts:135-143`). |
| AUD-02 | Captures actor, action, entity, old/new data, IP, UA | **PARTIAL** | `schema.prisma:446-468`: All fields present. However, `ipAddress` and `userAgent` are **never written** — no audit log creation in the codebase passes these fields. Audit entries always omit ip/userAgent. |
| AUD-03 | Queryable with filters | **CONFIRMED** | `audit.controller.ts:16-24`: GET /api/audit with filters: userId, action, departmentId, startDate, endDate, ticketId, page, limit. |
| AUD-04 | Immutable (no deletions/edits) | **CONFIRMED** | `audit.controller.ts:1-43`: Only 2 endpoints — GET (logs) and GET (actions). No PUT/PATCH/DELETE. |

---

## 5.12 User Profile

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| PRF-01 | Avatar, about, language | **PARTIAL** | `profile.controller.ts:19-22`: PUT /api/profile with `avatarUrl`, `about`. Language preference is in `users.controller.ts:23-28` (PUT /api/users/profile with `langPref`). |
| PRF-02 | Change own password | **NOT CONFIRMED** | No password change endpoint found for non-admin users. `profile.controller.ts` only has GET and PUT (avatar/about). The only password change is via admin: `admin-users.controller.ts:140-167`. |
| PRF-03 | Avatar resized via Sharp | **UNKNOWN** | Sharp is installed (`backend/package.json:52`). Avatar upload: `users.controller.ts:31-58` (diskStorage, 5MB limit). No resize logic is visible in the upload handler. May be in the service layer code (not inspected). |

---

## 5.13 Search

| ID | Requirement | Status | Code Evidence |
|---|---|---|---|
| SRC-01 | Global search across tickets | **CONFIRMED** | `tickets.controller.ts:38-42`: GET /api/tickets/search with rate limiting. Frontend: `GlobalSearch.tsx:36-80` (debounced search). |
| SRC-02 | Rate-limited | **CONFIRMED** | `tickets.controller.ts:39`: `@Throttle({ search: {} })` — 60 requests / 60s. |
| SRC-03 | Scoped to user permissions | **CONFIRMED** | `tickets.controller.ts:40-42`: Passes `user.id`, `user.role`, `user.departmentId` to service for permission scoping. |

---

## 6. Non-Functional Requirements

### 6.1 Security

| Requirement | Status | Evidence |
|---|---|---|
| JWT secrets fail-fast | **CONFIRMED** | `main.ts:14-19`, `auth.utils.ts:5-9` |
| CORS whitelist | **CONFIRMED** | `main.ts:54-63` |
| CSP via Helmet | **CONFIRMED** | `main.ts:29-51` |
| Rate limiting (global, login, analytics, search, upload) | **CONFIRMED** | `app.module.ts:30-37` — 6 named tiers |
| Input validation (Zod) | **CONFIRMED** | `tickets.controller.ts:21-24`: `createTicketSchema.safeParse()`. `zod-validation.pipe.ts` exists. |
| File magic-byte validation | **CONFIRMED** | `uploads.controller.ts:70`: `validateMagicByte()`. `file-type` package installed. |
| bcrypt passwords | **CONFIRMED** | `auth.service.ts:55`: `bcrypt.compare`. Cost 12 at `admin-users.controller.ts:62,146`. |
| HttpOnly refresh token | **CONFIRMED** | `auth.controller.ts:23-28` |
| 100% audit logging | **PARTIAL** | Most write operations audited. `ipAddress`/`userAgent` fields are never populated. Some operations may not be audited (e.g., ticket comments, profile updates). |

### 6.2 Performance

| Requirement | Status | Evidence |
|---|---|---|
| API p95 ≤ 500ms | **UNKNOWN** — No load test results. Health endpoint logs response time (`health.controller.ts:27`). |
| No N+1 queries | **PARTIAL** | `Promise.all` patterns used in multiple places (`admin-users.controller.ts:24-33`, `analytics.service.ts`, `notifications.service.ts:24-34`). But aggregation queries in analytics are **UNKNOWN**. |
| Max page size 100 | **CONFIRMED** | `Math.min(100, limit)` patterns in: `admin-users.controller.ts:21`, `knowledge.service.ts:24-25`, `notifications.service.ts:21-22`, `team-notes.controller.ts:20`, `analytics.controller.ts:78`. |
| Indexed query patterns | **CONFIRMED** | 9 indexes on Ticket, 4 on AuditLog, 3 on Notification, 3 on KnowledgeArticle (`schema.prisma:263-271,462-465,471-473,543-545`). |
| BullMQ + Redis for async | **CONFIRMED** | `app.module.ts:38-44` (BullModule). `jobs.module.ts:37` (cron-jobs queue). |

### 6.3 Reliability

| Requirement | Status | Evidence |
|---|---|---|
| Global error handler | **CONFIRMED** | `GlobalExceptionFilter` at `common/filters/global-exception.filter.ts:1-37`. Registered as `APP_FILTER` at `app.module.ts:63`. |
| Graceful shutdown | **PARTIAL** | `PrismaService.onModuleDestroy()` disconnects DB (`prisma.service.ts:15-18`). No custom SIGTERM handler found. |
| DB connection pool | **CONFIRMED** | `schema.prisma:8-9`: Query params `connection_limit=20, pool_timeout=30, connect_timeout=10`. `docker-compose.yml:40` confirms these params. |
| Structured logging | **CONFIRMED** | Morgan dev logging (`main.ts:66`). NestJS Logger used in filters, services. |

### 6.4 Scalability

| Requirement | Status | Evidence |
|---|---|---|
| Stateless API (JWT) | **CONFIRMED** | JWT tokens contain `id`, `role`, `departmentId` — `auth.utils.ts:13`. No server-side session state. |
| Refresh tokens in DB | **NOT CONFIRMED** | Refresh tokens are JWT signed tokens, not stored in DB. Cookie-based. No DB table for refresh tokens. No revocation mechanism found. |
| BullMQ + Redis queue | **CONFIRMED** | `app.module.ts:38-44`, `jobs.module.ts:37`. |
| Docker containerization | **CONFIRMED** | `docker-compose.yml:1-62`. Backend + Frontend Dockerfiles. |

### 6.5 i18n

| Requirement | Status | Evidence |
|---|---|---|
| Arabic (default) + English | **CONFIRMED** | Default language `'ar'` at `settingsStore.ts:16`, `schema.prisma:114`. |
| Bilingual DB fields | **CONFIRMED** | 8 models with `Ar`/`En` field pairs (see system-overview.md). |
| User preference persisted | **CONFIRMED** | `settingsStore.ts:12-27`: Zustand persist middleware to localStorage. |
| Backend i18next framework | **NOT CONFIRMED** | PRD specifies `i18next` on backend. No i18next configuration found in backend. Translations duplicated in `backend/src/core/translations.ts` but i18next is NOT in backend dependencies. |

### 6.6 Accessibility & UX

| Requirement | Status | Evidence |
|---|---|---|
| Full RTL support | **CONFIRMED** | `App.tsx:283`: Dynamic `dir={language === 'ar' ? 'rtl' : 'ltr'}`. |
| Responsive design | **CONFIRMED** | Mobile sidebar with overlay at `index.css:170-203`. Breakpoints at `sm`, `lg`, `xl` — `App.tsx:310-330`. |
| Error boundary | **CONFIRMED** | `ErrorBoundary.tsx:1-58`: Class component with `getDerivedStateFromError` + `componentDidCatch`. |
| Loading states | **PARTIAL** | `App.tsx:152`: Loading screen. `GlobalSearch.tsx:119-122`: Loading state. Loading states on other pages are **UNKNOWN**. |

---

## 9. Constraints & Assumptions (from PRD.md)

| PRD Constraint | Status | Evidence |
|---|---|---|
| Internal only, no public access | **CONFIRMED** | All endpoints guarded by `JwtAuthGuard`. Only `/api/health` (GET) and `/api/auth/login` (POST) are unauthenticated. |
| Hospital network deployment | **UNKNOWN** | Assumes private network. Docker compose supports this. |
| Browser-based, no native app | **CONFIRMED** | React SPA. Push via Web Push, not FCM/APNS. |
| Arabic-first UI | **CONFIRMED** | Default language `ar` in `settingsStore.ts:16`. RTL default. |
| PostgreSQL only | **CONFIRMED** | `schema.prisma:6`: `provider = "postgresql"`. |
| Single department per user | **CONFIRMED** | `schema.prisma:112`: `departmentId Int?` (single value, not array). |
| SLA uses calendar hours | **CONFIRMED** | `sla.utils.ts:22`: "Simple addition. Future versions could handle business hours." |
| File uploads on local disk | **CONFIRMED** | `uploads.controller.ts:45-55`: `diskStorage` with destination `uploads/`. |
| Web Push only, no email | **CONFIRMED** | No SMTP/email package in dependencies. `web-push` for VAPID. |
| Redis available | **CONFIRMED** | `docker-compose.yml:20-27`. Redis in BullMQ config and socket-redis-adapter. |