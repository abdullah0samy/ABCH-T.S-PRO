# Module Documentation

---

## Module 1: AuthModule

**Files**:
- `backend/src/modules/auth/auth.module.ts:1-22`
- `backend/src/modules/auth/auth.controller.ts:1-59`
- `backend/src/modules/auth/auth.service.ts:1-126`
- `backend/src/modules/auth/auth.utils.ts:1-33`
- `backend/src/modules/auth/strategies/jwt.strategy.ts:1-30`

### Module Declaration (`auth.module.ts`)

```typescript
@Module({
  imports: [PassportModule, JwtModule, PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
```

- Passport default strategy: `jwt` — `auth.module.ts:11`
- JWT config: secret from `JWT_ACCESS_SECRET`, expiration 8h — `auth.module.ts:13-15`

### Controller: AuthController (`auth.controller.ts`)

| Method | Route | Guard | Rate Limit | Auth | Purpose |
|---|---|---|---|---|---|
| POST | /api/auth/login | — | login (50/15min) | Public | Authenticate with identifier + password |
| POST | /api/auth/refresh | — | auth (100/15min) | Public | Refresh access token from cookie/body |
| POST | /api/auth/logout | — | auth (100/15min) | Public | Clear refresh token cookie |

**login** (`auth.controller.ts:12-35`):
- Body: `{ identifier: string, password: string }`
- Sets `refreshToken` httpOnly cookie (7d maxAge, SameSite strict, secure in prod) — `auth.controller.ts:23-28`
- Returns: `{ accessToken, refreshToken, user: { id, badgeNumber, username, fullNameAr, fullNameEn, role, department } }`

**refresh** (`auth.controller.ts:37-46`):
- Token from `body.refreshToken` or `cookies.refreshToken`
- Returns: `{ accessToken }` (no rotation)

**logout** (`auth.controller.ts:48-58`):
- Clears `refreshToken` cookie

### Service: AuthService (`auth.service.ts`)

**login** (`auth.service.ts:12-93`):
- Accepts identifier matching `badgeNumber` OR `username` — `auth.service.ts:25-33`
- Format validation: identifier must match `^[a-zA-Z0-9_.-]+$`, password max 128 chars — `auth.service.ts:18-22`
- Account lockout: 5 failed attempts → 15-minute `lockUntil` — `auth.service.ts:58-60`
- Resets lockout when expired — `auth.service.ts:46-52`
- Records `lastLoginAt` + resets `failedLoginAttempts` — `auth.service.ts:68-75`
- Generates access (8h) + refresh (7d) tokens

**refresh** (`auth.service.ts:95-121`):
- Verifies refresh token, checks user is active, returns new access token
- **No refresh token rotation**

**logout** (`auth.service.ts:123-125`):
- Returns `{ message: 'Logged out successfully' }` (no server-side revocation)

### Utils: auth.utils.ts (`auth.utils.ts`)

- `generateAccessToken(user)` — signs `{ id, role, departmentId }` with 8h expiry — `auth.utils.ts:11-17`
- `generateRefreshToken(user)` — signs `{ id }` with 7d expiry — `auth.utils.ts:19-25`
- `verifyAccessToken(token)` — `jwt.verify(token, ACCESS_SECRET)` — `auth.utils.ts:27-29`
- `verifyRefreshToken(token)` — `jwt.verify(token, REFRESH_SECRET)` — `auth.utils.ts:31-33`
- **Fail-fast**: `process.exit(1)` if secrets missing — `auth.utils.ts:5-9`

### Provides/Exports

- Exports: `AuthService` (line 20)
- Used by: `AuthController`, other modules needing auth utilities

---

## Module 2: UsersModule

**Files**:
- `backend/src/modules/users/users.module.ts:1-12`
- `backend/src/modules/users/users.controller.ts:1-59`
- `backend/src/modules/users/users.service.ts`

### Controller: UsersController (`users.controller.ts`)

| Method | Route | Guard | Auth | Purpose |
|---|---|---|---|---|
| GET | /api/users/me | JwtAuthGuard | Required | Get current user info |
| PUT | /api/users/profile | JwtAuthGuard | Required | Update profile fields |
| PUT | /api/users/avatar | JwtAuthGuard | Required | Upload avatar image |

**getMe** (`users.controller.ts:18-21`): Returns user data for authenticated user.

**updateProfile** (`users.controller.ts:23-29`): Body: `{ fullNameAr?, fullNameEn?, email?, langPref? }`.

**uploadAvatar** (`users.controller.ts:31-58`):
- FileInterceptor with `diskStorage` to `uploads/avatars/`
- UUID-based filename: `avatar-{uuid}.{ext}`
- Allowed types: `image/jpeg`, `image/png` only — `users.controller.ts:41-42`
- Max file size: 5MB — `users.controller.ts:48`

### Provides/Exports

- Exports: `UsersService` — `users.module.ts:10`

---

## Module 3: AdminModule (6 Controllers, 22 Endpoints)

**Files**:
- `backend/src/modules/admin/admin.module.ts:1-23`
- 6 controllers in `backend/src/modules/admin/controllers/`

### Module Declaration

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [6 controllers],
  providers: [RolesGuard],
})
```

All controllers inject `PrismaService` directly (no service layer).

### Controller 3a: AdminUsersController

**File**: `backend/src/modules/admin/controllers/admin-users.controller.ts:1-187`
**Route prefix**: `/api/admin/users`
**Guards**: JwtAuthGuard + RolesGuard (`@Roles('super_admin')`) — `admin-users.controller.ts:13-14`

| Method | Route | Purpose |
|---|---|---|
| GET | /api/admin/users | Paginated user list (max 100/page, min 1, default 20) |
| POST | /api/admin/users | Create user (badgeNumber, username must be numeric) |
| PUT | /api/admin/users/:id | Update user (including forcePasswordChange, permissionsOverride upsert) |
| POST | /api/admin/users/:id/reset-password | Reset password with forcePasswordChange |
| DELETE | /api/admin/users/:id | Soft-delete (set isActive=false, deletedAt=now) |

- All mutations create audit log entries — `admin-users.controller.ts:82-90,125-133,156-164,176-181`

### Controller 3b: AdminDepartmentsController

**File**: `backend/src/modules/admin/controllers/admin-departments.controller.ts:1-115`
**Route prefix**: `/api/admin/departments`
**Guards**: JwtAuthGuard at class level, RolesGuard per route — `admin-departments.controller.ts:12-18`

| Method | Route | Roles | Purpose |
|---|---|---|---|
| GET | /api/admin/departments | super_admin, supervisor, agent | List departments (with permissions + user count) |
| POST | /api/admin/departments | super_admin | Create department (auto-creates DeptPermissions, default 24h SLA) |
| PUT | /api/admin/departments/:id | super_admin | Update department |
| DELETE | /api/admin/departments/:id | super_admin | Soft-delete (isActive=false, deletedAt=now) |

- Audit logging on all mutations — `admin-departments.controller.ts:48-57,81-90,104-111`

### Controller 3c: AdminRolesController

**File**: `backend/src/modules/admin/controllers/admin-roles.controller.ts:1-95`
**Route prefix**: `/api/admin` + specific sub-routes
**Guards**: JwtAuthGuard + RolesGuard (`@Roles('super_admin')`) — `admin-roles.controller.ts:12-13`

| Method | Route | Purpose |
|---|---|---|
| GET | /api/admin/roles | List roles (with permissions + user count) |
| POST | /api/admin/roles | Create role with permissionIds |
| PUT | /api/admin/roles/:id | Update role (name, description, permissionIds set) |
| DELETE | /api/admin/roles/:id | Delete role (rejects if role has active users) |
| GET | /api/admin/permissions | List all permissions |

### Controller 3d: AdminBuildingsController

**File**: `backend/src/modules/admin/controllers/admin-buildings.controller.ts:1-63`
**Route prefix**: `/api/admin/buildings`

| Method | Route | Roles | Purpose |
|---|---|---|---|
| GET | /api/admin/buildings | super_admin, supervisor, agent | List buildings (with floor count) |
| POST | /api/admin/buildings | super_admin | Create building (nameAr, nameEn required) |
| PUT | /api/admin/buildings/:id | super_admin | Update building |
| DELETE | /api/admin/buildings/:id | super_admin | Hard-delete building |

### Controller 3e: AdminFloorsController

**File**: `backend/src/modules/admin/controllers/admin-floors.controller.ts:1-64`
**Route prefix**: `/api/admin/floors`

| Method | Route | Roles | Purpose |
|---|---|---|---|
| GET | /api/admin/floors | super_admin, supervisor, agent | List floors (with building) |
| POST | /api/admin/floors | super_admin | Create floor (nameAr, nameEn, buildingId required) |
| PUT | /api/admin/floors/:id | super_admin | Update floor |
| DELETE | /api/admin/floors/:id | super_admin | Hard-delete floor |

### Controller 3f: AdminTicketTypesController

**File**: `backend/src/modules/admin/controllers/admin-ticket-types.controller.ts:1-104`
**Route prefix**: `/api/admin/ticket-types`
**Guards**: JwtAuthGuard + RolesGuard at class level — `admin-ticket-types.controller.ts:12-13`

| Method | Route | Roles | Purpose |
|---|---|---|---|
| GET | /api/admin/ticket-types | super_admin, supervisor, agent | List ticket types (ordered by displayOrder) |
| POST | /api/admin/ticket-types | super_admin | Create type (nameAr, nameEn required; color, slaHours, displayOrder optional) |
| PUT | /api/admin/ticket-types/:id | super_admin | Update type |
| DELETE | /api/admin/ticket-types/:id | super_admin | Soft-deactivate (isActive=false) |

- Audit logging on all mutations — `admin-ticket-types.controller.ts:44-51,73-80,94-100`

---

## Module 4: TicketsModule (22 Endpoints)

**Files**:
- `backend/src/modules/tickets/tickets.module.ts:1-11`
- `backend/src/modules/tickets/tickets.controller.ts:1-134`
- `backend/src/modules/tickets/tickets.service.ts`
- `backend/src/modules/tickets/sla.utils.ts:1-36`
- `backend/src/modules/tickets/workflow.constants.ts:1-25`

### Workflow Constants (`workflow.constants.ts`)

```typescript
TICKET_STATUSES = ['pending', 'open', 'in_progress', 'resolved', 'closed']
TICKET_PRIORITIES = ['low', 'normal', 'high', 'critical']

PRIORITY_SLA_MODIFIERS = {
  low: 1.5,      // +50% time
  normal: 1,     // base
  high: 0.5,     // -50% time
  critical: 0.25 // -75% time
}
```

ALLOWED_TRANSITIONS:
- `pending` → `[open, in_progress, closed]`
- `open` → `[in_progress, closed]`
- `in_progress` → `[resolved, closed]`
- `resolved` → `[in_progress]` (reopen only; close requires creator confirmation)
- `closed` → `[in_progress]` (reopen, super_admin only)

### Controller: TicketsController (`tickets.controller.ts`)

**Route prefix**: `/api/tickets`
**Guard**: JwtAuthGuard at class level — `tickets.controller.ts:13`

| Method | Route | Rate Limit | Purpose |
|---|---|---|---|
| POST | /api/tickets | auth | Create ticket (Zod validation) |
| GET | /api/tickets/my | — | User's created tickets |
| GET | /api/tickets/department | — | Department inbox |
| GET | /api/tickets/search | search (60/min) | Search tickets |
| GET | /api/tickets/archived | — | Archived tickets |
| GET | /api/tickets/transferred | — | Transferred tickets |
| GET | /api/tickets/form-data | — | Form metadata (types, depts, buildings) |
| GET | /api/tickets/:id | — | Ticket detail |
| PUT | /api/tickets/:id/status | — | Update ticket status (with transition enforcement) |
| POST | /api/tickets/bulk-update-status | — | Bulk status update |
| PUT | /api/tickets/:id/assign | — | Assign to agent |
| POST | /api/tickets/bulk-assign | — | Bulk assign |
| PUT | /api/tickets/:id/transfer | — | Transfer to another department |
| POST | /api/tickets/:id/comments | — | Add comment/message |
| PUT | /api/tickets/:id/confirm | — | Creator confirms resolution (rating + feedback) |
| PUT | /api/tickets/:id/due-date | — | Update due date |
| PUT | /api/tickets/:id/type | — | Update ticket type |
| POST | /api/tickets/:id/link | — | Link related tickets |
| POST | /api/tickets/:id/unlink | — | Unlink related tickets |
| PUT | /api/tickets/:id/archive | — | Archive ticket |
| PATCH | /api/tickets/:id | — | Super admin full override |
| POST | /api/tickets/bulk-archive | — | Bulk archive |

### Provides/Exports

- No exports. `TicketsModule` imports `PrismaModule`, provides `TicketsController` and `TicketsService`.

---

## Module 5: AnalyticsModule (10 Endpoints)

**Files**:
- `backend/src/modules/analytics/analytics.module.ts:1-11`
- `backend/src/modules/analytics/analytics.controller.ts:1-93`
- `backend/src/modules/analytics/analytics.service.ts`

### Controller: AnalyticsController (`analytics.controller.ts`)

**Route prefix**: `/api/analytics`
**Guards**: JwtAuthGuard at class, RolesGuard per route
**Rate limit**: `analytics` tier (300/15min) on entire controller — `analytics.controller.ts:15`

| Method | Route | Roles | Purpose |
|---|---|---|---|
| GET | /api/analytics/dashboard-summary | super_admin, supervisor, agent | Dashboard KPI cards |
| GET | /api/analytics/stats | super_admin, supervisor, agent | General ticket statistics |
| GET | /api/analytics/status-distribution | super_admin, supervisor, agent | Status breakdown counts |
| GET | /api/analytics/priority-distribution | super_admin, supervisor, agent | Priority breakdown |
| GET | /api/analytics/department-performance | super_admin, supervisor | Cross-department metrics |
| GET | /api/analytics/recent-activity | super_admin | Recent system activity |
| GET | /api/analytics/agent-performance | super_admin, supervisor | Per-agent performance data |
| GET | /api/analytics/aht | super_admin, supervisor, agent | Avg. Handle Time metrics |
| GET | /api/analytics/exports | super_admin, supervisor, agent | Export history (paginated) |
| GET | /api/analytics/export | super_admin, supervisor, agent | Generate Excel export (with startDate/endDate query params) |

**exportExcel** (`analytics.controller.ts:84-92`):
- Uses `exceljs` library
- Streams response with `Content-Type: application/vnd.openxmlformats...`
- Arabic-friendly `Content-Disposition` with `filename*=UTF-8''`

### Provides/Exports

- No exports. Imports `PrismaModule`.

---

## Module 6: ProfileModule (2 Endpoints)

**Files**:
- `backend/src/modules/profile/profile.module.ts:1-11`
- `backend/src/modules/profile/profile.controller.ts:1-23`
- `backend/src/modules/profile/profile.service.ts`

### Controller: ProfileController (`profile.controller.ts`)

| Method | Route | Guard | Purpose |
|---|---|---|---|
| GET | /api/profile | JwtAuthGuard | Get current user's profile |
| PUT | /api/profile | JwtAuthGuard | Update profile (avatarUrl, about) |

---

## Module 7: AuditModule (2 Endpoints)

**Files**:
- `backend/src/modules/audit/audit.module.ts:1-11`
- `backend/src/modules/audit/audit.controller.ts:1-43`
- `backend/src/modules/audit/audit.service.ts`

### Controller: AuditController (`audit.controller.ts`)

**Route prefix**: `/api/audit`
**Guards**: JwtAuthGuard + RolesGuard (`@Roles('super_admin')`) — `audit.controller.ts:11-12`

| Method | Route | Purpose |
|---|---|---|
| GET | /api/audit | Get paginated audit logs (filters: userId, action, departmentId, startDate, endDate, ticketId) |
| GET | /api/audit/actions | Get distinct list of recorded action types |

**Immutable**: No write endpoints exist.

---

## Module 8: UploadsModule (2 Endpoints)

**Files**:
- `backend/src/modules/uploads/uploads.module.ts:1-9`
- `backend/src/modules/uploads/uploads.controller.ts:1-80`
- `backend/src/modules/uploads/uploads.service.ts`

### Controller: UploadsController (`uploads.controller.ts`)

**Route prefix**: `/api/uploads`
**Guard**: JwtAuthGuard — `uploads.controller.ts:24`

| Method | Route | Rate Limit | Purpose |
|---|---|---|---|
| POST | /api/uploads | upload (100/hr) | Upload file (magic-byte validation) |
| GET | /api/uploads/download/:filename | — | Download uploaded file |

**uploadFile** (`uploads.controller.ts:28-73`):
- FileInterceptor `diskStorage` to `uploads/` directory
- Filename: `{fieldname}-{timestamp}-{random}{ext}`
- Extension whitelist: `.jpeg, .jpg, .png, .pdf, .doc, .docx, .xls, .xlsx, .wav, .mp3, .webm` — line 12
- MIME type whitelist: 9 types — lines 13-19
- Max size: 5MB — line 56
- **Magic-byte validation**: `uploadsService.validateMagicByte(file.path, file.mimetype)` — line 70

**No PrismaModule import** — this module is standalone.

---

## Module 9: AssetsModule (4 Endpoints)

**Files**:
- `backend/src/modules/assets/assets.module.ts:1-11`
- `backend/src/modules/assets/assets.controller.ts:1-49`
- `backend/src/modules/assets/assets.service.ts`

### Controller: AssetsController (`assets.controller.ts`)

| Method | Route | Roles | Purpose |
|---|---|---|---|
| GET | /api/assets | super_admin, supervisor | Paginated asset list (max 100/page) |
| POST | /api/assets | super_admin, supervisor | Create asset |
| PUT | /api/assets/:id | super_admin, supervisor | Update asset |
| DELETE | /api/assets/:id | super_admin | Soft-delete asset |

---

## Module 10: TeamNotesModule (5 Endpoints)

**Files**:
- `backend/src/modules/team-notes/team-notes.module.ts:1-11`
- `backend/src/modules/team-notes/team-notes.controller.ts:1-46`
- `backend/src/modules/team-notes/team-notes.service.ts:1-141`

### Controller: TeamNotesController (`team-notes.controller.ts`)

| Method | Route | Purpose |
|---|---|---|
| GET | /api/team-notes | Department-scoped feed (all for super_admin) |
| POST | /api/team-notes | Create note (end_user blocked by service) |
| POST | /api/team-notes/:id/comments | Add comment |
| POST | /api/team-notes/:id/like | Toggle like |
| DELETE | /api/team-notes/:id | Soft-delete (author or super_admin only) |

### Service Notes (`team-notes.service.ts`)

- `findAll`: Filters by `departmentId` for non-super_admin — `team-notes.service.ts:12-13`
- `create`: Blocks `end_user` role — `team-notes.service.ts:49-51`
- `remove`: Soft delete with `deletedAt: new Date()` — `team-notes.service.ts:139`
- Attachments and voice notes supported on creation — `team-notes.service.ts:63-71`

---

## Module 11: KnowledgeModule (11 Endpoints)

**Files**:
- `backend/src/modules/knowledge/knowledge.module.ts:1-11`
- `backend/src/modules/knowledge/knowledge.controller.ts:1-87`
- `backend/src/modules/knowledge/knowledge.service.ts:1-241`

### Controller: KnowledgeController (`knowledge.controller.ts`)

| Method | Route | Purpose |
|---|---|---|
| GET | /api/knowledge/articles | Paginated articles (filter: search, categoryId) |
| GET | /api/knowledge/categories | List categories (with article count) |
| GET | /api/knowledge/search | Full-text search (ILIKE on title + content) |
| GET | /api/knowledge/suggest | Smart suggestions (exact + word match, 3 results) |
| POST | /api/knowledge/articles | Create article (requires canManageKnowledgeBase) |
| PUT | /api/knowledge/articles/:id | Update article (with audit logging) |
| DELETE | /api/knowledge/articles/:id | Delete article |
| POST | /api/knowledge/articles/:id/view | Increment view counter |
| POST | /api/knowledge/categories | Create category |
| PUT | /api/knowledge/categories/:id | Update category |
| DELETE | /api/knowledge/categories/:id | Delete category (rejects if articles exist) |

### Service Highlights (`knowledge.service.ts`)

- `checkKbPermission()` (lines 9-21): Checks UserPermissionOverride → DeptPermissions → false
- `search()` (lines 59-85): PostgreSQL `contains` with `mode: 'insensitive'` + Arabic normalization
- `suggest()` (lines 87-132): Two-phase — exact match (up to 3) + word-level fallback
- All CRUD operations produce audit log entries

---

## Module 12: NotificationsModule (5 Endpoints)

**Files**:
- `backend/src/modules/notifications/notifications.module.ts:1-11`
- `backend/src/modules/notifications/notifications.controller.ts:1-40`
- `backend/src/modules/notifications/notifications.service.ts:1-70`

### Controller: NotificationsController (`notifications.controller.ts`)

| Method | Route | Purpose |
|---|---|---|
| GET | /api/notifications | Paginated user notifications (with unread count) |
| PUT | /api/notifications/:id/read | Mark single notification read |
| PUT | /api/notifications/read-all | Mark all user notifications read |
| POST | /api/notifications/subscribe | Register VAPID push subscription |
| DELETE | /api/notifications/subscribe | Remove push subscription |

### Service Highlights (`notifications.service.ts`)

- **VAPID setup**: `webpush.setVapidDetails()` from env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` — `notifications.service.ts:8-16`
- Pagination: max 100/page — `notifications.service.ts:21-22`
- `subscribe()`: Check for existing subscription (unique userId+endpoint) before creating
- **Note**: Actual `webpush.sendNotification()` not found — only in-app notification creation

---

## Module 13: JobsModule (3 Cron Processors)

**Files**:
- `backend/src/modules/jobs/jobs.module.ts:1-41`
- `backend/src/modules/jobs/cron.processor.ts:1-25`
- `backend/src/modules/jobs/cron.service.ts:1-146`

### Module Declaration (`jobs.module.ts`)

```typescript
@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: 'cron-jobs' })],
  providers: [CronProcessor, CronService, CronSchedulerService],
})
```

### CronSchedulerService (OnModuleInit) (`jobs.module.ts:10-32`)

Registers 3 job schedulers via `upsertJobScheduler()`:

| Scheduler Name | Pattern | Schedule |
|---|---|---|
| cleanup-exports | `0 3 * * *` | Daily at 3:00 AM |
| sla-check | `*/5 * * * *` | Every 5 minutes |
| auto-archive | `0 4 * * *` | Daily at 4:00 AM |

### CronProcessor (`cron.processor.ts`)

- Decorated with `@Processor('cron-jobs')`
- Dispatches based on `job.name` to `CronService` methods

### CronService (`cron.service.ts`)

| Method | Lines | Operations |
|---|---|---|
| `cleanupExports()` | 11-35 | Delete expired ExportHistory files from disk + DB |
| `slaCheck()` | 36-111 | Check breached + warning tickets, create Notification records |
| `autoArchive()` | 113-146 | Archive resolved/closed tickets >30 days, create audit log |

---

## Module 14: GatewaysModule (Socket.IO)

**Files**:
- `backend/src/gateways/gateways.module.ts:1-9`
- `backend/src/gateways/ticket.gateway.ts:1-101`

### Module Declaration (`gateways.module.ts`)

```typescript
@Global()
@Module({
  providers: [TicketGateway],
  exports: [TicketGateway],
})
```

- `@Global()` — TicketGateway is available to all modules without importing
- No DB dependency

### TicketGateway (`ticket.gateway.ts`)

| Feature | Lines | Details |
|---|---|---|
| WebSocket config | 29-35 | CORS whitelist, credentials |
| Connection / JWT auth | 40-54 | Token from auth or query, userData attached |
| Disconnect cleanup | 56-58 | Remove rate limit entries |
| join-department event | 60-66 | Super admin or dept member |
| join-user event | 68-74 | Only own userId |
| join-ticket event | 76-83 | Any authenticated user, rate limited (5/1s) |
| leave-ticket event | 85-88 | No guard |
| emitToDept | 90-92 | Room: `dept-{id}` |
| emitToUser | 94-96 | Room: `user-{id}` |
| emitToTicket | 98-100 | Room: `ticket-{id}` |

---

## HealthController (Not a Module)

**File**: `backend/src/common/health/health.controller.ts:1-36`
**Route prefix**: `/api` (registered directly in AppModule — `app.module.ts:61`)

| Method | Route | Guard | Purpose |
|---|---|---|---|
| GET | /api/health | — (public) | Health check with DB connectivity test |

**check()** (lines 8-35):
- Runs `SELECT 1` against PostgreSQL
- Returns: `{ status, service, version, timestamp, uptime, database, memory, responseTime }`
- On failure: `{ status: 'error', message: 'Database connection failed' }`

---

## PrismaModule

**Files**:
- `backend/src/prisma/prisma.module.ts:1-8`
- `backend/src/prisma/prisma.service.ts:1-19`

### Module Declaration

```typescript
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
```

### PrismaService (lines 5-19)

- Extends `PrismaClient`
- Logging: `['warn', 'error']` in development, `['error']` in production
- `errorFormat: 'minimal'`
- `onModuleDestroy()`: calls `$disconnect()` with Logger

---

## Frontend Module Breakdown: 18 Pages, 3 Directories

### Core Infrastructure

| File | Purpose |
|---|---|
| `frontend/src/main.tsx:1-10` | React 19 StrictMode, createRoot |
| `frontend/src/App.tsx:1-476` | Custom router, layout shell, sidebar, header, notifications |
| `frontend/src/index.css:1-208` | TailwindCSS v4, custom properties, responsive styles |
| `frontend/src/core/api.ts:1-85` | apiFetch with CSRF + auth + auto-logout |
| `frontend/src/core/translations.ts:1-848` | 297 keys × 2 languages |
| `frontend/src/core/NotificationProvider.tsx:1-243` | Socket.IO client, toast notifications, browser push |
| `frontend/src/core/permissionCache.ts` | Permission cache for frontend |

### Store (3 Zustand stores)

| File | Key | Persistence |
|---|---|---|
| `store/authStore.ts` | `accessToken` | localStorage |
| `store/settingsStore.ts` | `abc-settings-storage` | localStorage (Zustand persist) |
| `store/refreshStore.ts` | — | In-memory only |

### Components (3)

| File | Purpose |
|---|---|
| `components/ErrorBoundary.tsx:1-58` | Class component, reload recovery |
| `components/GlobalSearch.tsx:1-177` | Debounced search with dropdown |
| `components/ErrorBanner.tsx` | Error display component |

### Pages (18 across 3 directories)

#### pages/tickets/ (6 pages)

| Page | Route Match | Source |
|---|---|---|
| NewTicketPage | `/tickets/new` | `App.tsx:190` |
| TicketDetailsPage | `/tickets/:id` | `App.tsx:191` |
| InboxPage | `/inbox` | `App.tsx:208` |
| MyTicketsPage | `/my-tickets` | `App.tsx:209` |
| TransferredPage | `/transferred` | `App.tsx:210` |
| ArchivePage | `/archive` | `App.tsx:211` |

#### pages/admin/ (6 pages)

| Page | Route Match | Source |
|---|---|---|
| BuildingsPage | `/admin/buildings` | `App.tsx:196` |
| FloorsPage | `/admin/floors` | `App.tsx:197` |
| DepartmentsPage | `/admin/departments` | `App.tsx:198` |
| TicketTypesPage | `/admin/ticket-types` | `App.tsx:199` |
| UserManagementPage | `/admin/users` | `App.tsx:200` |
| RoleManagementPage | `/admin/roles` | `App.tsx:201` |

#### pages/ root (6 pages)

| Page | Route Match | Source |
|---|---|---|
| Login | (no user state) | `App.tsx:153` |
| DashboardPage | `/dashboard` + default fallback | `App.tsx:194,212` |
| AnalyticsPage | `/analytics` | `App.tsx:204` |
| KnowledgeBasePage | `/knowledge` | `App.tsx:205` |
| TeamFeedPage | `/team-feed` | `App.tsx:206` |
| UserProfilePage | `/profile` | `App.tsx:203` |
| AuditLogPage | `/admin/audit` | `App.tsx:207` |

### Sidebar Navigation (Role-Based)

**Main menu** (App.tsx:155-166, filtered by user.role):

| Page | Roles Allowed |
|---|---|
| Dashboard | super_admin, supervisor, agent, end_user |
| New Ticket | super_admin, supervisor, agent, end_user |
| Inbox | super_admin, supervisor, agent |
| Outgoing | super_admin, supervisor, agent, end_user |
| Transferred | super_admin, supervisor, agent |
| Archive | super_admin, supervisor, agent |
| Analytics | super_admin, supervisor, agent |
| Team Feed | super_admin, supervisor, agent |
| Knowledge Base | super_admin, supervisor, agent, end_user |
| Profile | super_admin, supervisor, agent, end_user |

**Admin section** (App.tsx:169-178, super_admin only):
- Buildings, Floors, Departments, Ticket Types, Users, Roles, Assets, Audit Logs