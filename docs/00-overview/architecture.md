# Architecture Documentation

---

## Frontend Architecture

### Custom State-Based Router (NO react-router)

Despite `react-router-dom` 7.14.0 being in `frontend/package.json:27`, it is **NOT imported or used anywhere** in the application. Routing is implemented via a custom state-based system in `App.tsx`:

**Navigation mechanism** (`App.tsx:80-94`):
- Path stored in React state: `useState('/dashboard')` — `App.tsx:73`
- Navigation via callback: `const navigate = useCallback((path) => { setCurrentPath(path); ... })` — `App.tsx:80-84`
- External navigation via CustomEvent: `window.addEventListener('navigate', handleNavigate)` — `App.tsx:87-94`
- Consumer pattern: `window.dispatchEvent(new CustomEvent('navigate', { detail: '/path' }))` — used in `NotificationProvider.tsx:372`, `GlobalSearch.tsx:83`, `App.tsx:373`

**Content rendering** (`App.tsx:180-214`):
- Ticket detail routes parsed from `currentPath.startsWith('/tickets/')` with regex-style path splitting — `App.tsx:185-192`
- Admin path guard checks `user.role !== 'super_admin'` and redirects to Dashboard — `App.tsx:183`
- Switch-case for all named routes — `App.tsx:194-214`
- Default fallback: Dashboard — `App.tsx:212`

### Zustand Stores (3 Stores)

#### 1. authStore (`frontend/src/store/authStore.ts:1-22`)
```typescript
interface AuthState {
  user: any | null;
  accessToken: string | null;    // Persisted in localStorage
  setAuth: (user, accessToken) => void;
  logout: () => void;            // Clears localStorage + fires POST /api/auth/logout
}
```
- localStorage key: `accessToken` — `authStore.ts:14`
- Logout fires cleanup fetch: `fetch('/api/auth/logout', ...)` — `authStore.ts:20`

#### 2. settingsStore (`frontend/src/store/settingsStore.ts:1-27`)
```typescript
interface SettingsState {
  language: 'ar' | 'en';    // default: 'ar'
  theme: 'light' | 'dark';  // default: 'light'
  setLanguage, setTheme, toggleLanguage, toggleTheme;
}
```
- Uses `persist` middleware — `settingsStore.ts:13` (line 12: `import { persist }`)
- localStorage key: `abc-settings-storage` — `settingsStore.ts:24`

#### 3. refreshStore (`frontend/src/store/refreshStore.ts:1-11`)
```typescript
interface RefreshState {
  ticketRefreshKey: number;      // Incremented to force re-fetch
  notifyTicketChange: () => void;
}
```
- Simple counter pattern for triggering data refetch across components

### TailwindCSS v4 + CSS Custom Properties Theme System

**Configuration** (`frontend/src/index.css:1-208`):
- TailwindCSS v4 via `@tailwindcss/vite` plugin — `frontend/package.json:14`
- `@import "tailwindcss"` at line 2
- Custom variant for dark mode: `@custom-variant dark (&:where(.dark, .dark *));` — `index.css:4`

**Custom theme colors** (`index.css:6-18`):
- `--font-sans`: Cairo + Inter
- `--font-body`: Inter + Cairo
- Semantic colors: `--color-primary-blue: #0284C7`, `--color-success-green: #0D9488`, `--color-warning-amber: #F59E0B`, `--color-danger-red: #E11D48`

**CSS custom properties for theming** (`index.css:20-46`):
- `:root` (light theme): `--bg-main: #F0F4F8`, `--bg-surface: #FFFFFF`, `--text-main: #0B1120`, `--text-secondary: #475569`, `--text-muted: #94A3B8`, borders
- `.dark` (dark theme): `--bg-main: #0C1220`, `--bg-surface: #141D32`, `--text-main: #EAF0F8`, adjusted colors
- Dark mode toggle adds/removes `.dark` class on `<html>` — `App.tsx:97-103`

**Custom components layer** (`index.css:69-150`):
- `.premium-card`: Card component with shadow + border transitions
- `.kpi-card`: Dashboard KPI card
- `.input-surface`: Input field with focus ring
- `.btn-primary`: Primary button with elevation
- `.input-field`: Generic input with focus outline

**Responsive sidebar** (`index.css:170-203`):
- Media query at `max-width: 1024px`
- RTL-aware sidebar with `transform` transitions
- Overlay with `backdrop-filter: blur(4px)`

### Animations: motion/react

- Library: `motion` 12.23.24 (Framer Motion) — `frontend/package.json:21`
- Imported as: `import { motion, AnimatePresence } from 'motion/react'` — `App.tsx:59`
- Used for:
  - Toast notifications with slide-in/out — `App.tsx:439-470`
  - Sidebar overlay fade — `App.tsx:286-296`
  - CSS transitions on theme/language changes — `index.css:48-67`

### Socket.IO Client Integration

**NotificationProvider** (`frontend/src/core/NotificationProvider.tsx:1-243`):
- Connection: `io(window.location.origin, { auth: { token: accessToken } })` — `NotificationProvider.tsx:92-101`
- Reconnection: 10 attempts, 2s-10s backoff — `NotificationProvider.tsx:95-100`
- Room auto-join on connect: `join-user` (userId) + `join-department` (deptId) — `NotificationProvider.tsx:103-108`
- Events consumed with CustomEvent dispatch:
  - `new-ticket` — dispatches `ws:ticket-created` — `NotificationProvider.tsx:118-126`
  - `ticket-status-updated` — dispatches `ws:ticket-status-updated` — `NotificationProvider.tsx:128-139`
  - `ticket-assigned` — dispatches `ws:ticket-assigned` — `NotificationProvider.tsx:141-149`
  - `new-comment` — dispatches `ws:new-comment` — `NotificationProvider.tsx:151-159`
  - `sla-warning` — toast only — `NotificationProvider.tsx:161-168`
  - `sla-breach` — toast only — `NotificationProvider.tsx:170-177`
- Toast auto-dismiss: 6 seconds (`TOAST_DURATION = 6000`) — `NotificationProvider.tsx:33`
- Max notifications stored: 100 — `NotificationProvider.tsx:34`
- Browser push via `Notification` API — `NotificationProvider.tsx:78-80`
- Permission request on mount — `NotificationProvider.tsx:201-205`

### apiFetch Wrapper (`frontend/src/core/api.ts:1-85`)

**CSRF handling** (`api.ts:3-6`):
- Reads `x-csrf-token` cookie: `document.cookie.match()` — `api.ts:4-5`
- Injects `x-csrf-token` header on every request — `api.ts:16`

**Auth injection** (`api.ts:15`):
- `Authorization: Bearer ${accessToken}` from Zustand store — `api.ts:15`

**Auto-logout on 401/403** (`api.ts:29-44`):
- Mutex to prevent parallel logouts: `window._isLoggingOut` flag — `api.ts:29,32`
- On 401/403: calls `logout()`, dispatches `navigate` to `/login`, throws `Session expired` — `api.ts:33-36`
- Resets mutex flag after 2s — `api.ts:39`

**Error normalization** (`api.ts:47-64,72-83`):
- JSON error responses mapped to `{ status, code, message, timestamp }` — `api.ts:49-55`
- Non-JSON errors include truncated response text — `api.ts:57-63`
- Network errors wrapped as `FETCH_ERROR` — `api.ts:73-83`

**FormData support** (`api.ts:11,13`):
- Omits `Content-Type` header for `FormData` bodies — `api.ts:11,13`

**Credentials** (`api.ts:22`):
- `credentials: 'include'` for httpOnly cookie transmission — `api.ts:22`

### Frontend Components

| Component | Purpose | Source |
|---|---|---|
| ErrorBoundary | Class-based error boundary with reload | `components/ErrorBoundary.tsx:1-58` |
| GlobalSearch | Debounced ticket search with dropdown | `components/GlobalSearch.tsx:1-177` |
| ErrorBanner | Error display component | `components/ErrorBanner.tsx` |

**GlobalSearch details** (`GlobalSearch.tsx`):
- Debounce: 300ms — `GlobalSearch.tsx:36`
- Min query length: 2 characters — `GlobalSearch.tsx:38,99`
- Abort controller for race conditions — `GlobalSearch.tsx:27,52-55`
- Calls `GET /api/tickets/search?q=...&limit=5` directly (not through apiFetch) — `GlobalSearch.tsx:61`
- Click-outside close — `GlobalSearch.tsx:24-32`

### Frontend Pages (18 Pages, 3 Directories)

**pages/tickets/ (6 pages)**
| Page | Route | Source |
|---|---|---|
| NewTicketPage | /tickets/new | `pages/tickets/NewTicketPage.tsx` |
| TicketDetailsPage | /tickets/:id | `pages/tickets/TicketDetailsPage.tsx` |
| InboxPage | /inbox | `pages/tickets/InboxPage.tsx` |
| MyTicketsPage | /my-tickets | `pages/tickets/MyTicketsPage.tsx` |
| TransferredPage | /transferred | `pages/tickets/TransferredPage.tsx` |
| ArchivePage | /archive | `pages/tickets/ArchivePage.tsx` |

**pages/admin/ (6 pages)**
| Page | Route | Source |
|---|---|---|
| BuildingsPage | /admin/buildings | `pages/admin/BuildingsPage.tsx` |
| FloorsPage | /admin/floors | `pages/admin/FloorsPage.tsx` |
| DepartmentsPage | /admin/departments | `pages/admin/DepartmentsPage.tsx` |
| TicketTypesPage | /admin/ticket-types | `pages/admin/TicketTypesPage.tsx` |
| UserManagementPage | /admin/users | `pages/admin/UserManagementPage.tsx` |
| RoleManagementPage | /admin/roles | `pages/admin/RoleManagementPage.tsx` |

**pages/ (root, 6 pages)**
| Page | Route | Source |
|---|---|---|
| DashboardPage | /dashboard | `pages/DashboardPage.tsx` |
| Login | (shown when no user) | `pages/Login.tsx` |
| AnalyticsPage | /analytics | `pages/AnalyticsPage.tsx` |
| KnowledgeBasePage | /knowledge | `pages/KnowledgeBasePage.tsx` |
| TeamFeedPage | /team-feed | `pages/TeamFeedPage.tsx` |
| UserProfilePage | /profile | `pages/UserProfilePage.tsx` |
| AuditLogPage | /admin/audit | `pages/AuditLogPage.tsx` |

---

## Backend Architecture

### app.module.ts — 14 Feature Modules

**Source**: `backend/src/app.module.ts:1-69`

**Imports** (feature modules):
1. `AuthModule` — `app.module.ts:46`
2. `UsersModule` — `app.module.ts:47`
3. `AdminModule` — `app.module.ts:48`
4. `TicketsModule` — `app.module.ts:49`
5. `AnalyticsModule` — `app.module.ts:50`
6. `ProfileModule` — `app.module.ts:51`
7. `AuditModule` — `app.module.ts:52`
8. `UploadsModule` — `app.module.ts:53`
9. `AssetsModule` — `app.module.ts:54`
10. `TeamNotesModule` — `app.module.ts:55`
11. `KnowledgeModule` — `app.module.ts:56`
12. `NotificationsModule` — `app.module.ts:57`
13. `JobsModule` — `app.module.ts:58`
14. `GatewaysModule` — `app.module.ts:59`

**Additional imports**:
- `ConfigModule.forRoot({ isGlobal: true })` — `app.module.ts:29`
- `ThrottlerModule.forRoot([...])` — `app.module.ts:30-37`
- `BullModule.forRoot({ ... })` — `app.module.ts:38-44`
- `PrismaModule` — `app.module.ts:45`

**Global providers** (`app.module.ts:62-66`):
- `APP_FILTER` → `GlobalExceptionFilter` — `app.module.ts:63`
- `APP_INTERCEPTOR` → `MutationLoggerInterceptor` — `app.module.ts:64`
- `APP_INTERCEPTOR` → `RequestIdInterceptor` — `app.module.ts:65`
- `APP_GUARD` → `ThrottlerGuard` — `app.module.ts:66`

### Middleware Pipeline (main.ts)

**Source**: `backend/src/main.ts:1-108`

Execution order:

1. **JWT secrets validation** (fail-fast) — `main.ts:14-19`
   - Exits with code 1 if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` not set

2. **BigInt serialization fix** — `main.ts:24-26`
   - `BigInt.prototype.toJSON = () => this.toString()`

3. **Helmet (security headers)** — `main.ts:29-51`
   - CSP with `defaultSrc: 'self'`, `styleSrc: 'self', 'unsafe-inline'`, `frameguard: deny`
   - HSTS only in production — `main.ts:42-47`

4. **CORS whitelist** — `main.ts:54-63`
   - Production: single origin from `FRONTEND_URL`
   - Development: 4 localhost origins
   - `credentials: true`

5. **Mongo (Morgan) logging** — `main.ts:66`
   - Format: `'dev'`

6. **JSON body parser (10MB limit)** — `main.ts:67`
   - `express.json({ limit: '10mb' })`

7. **cookieParser** — `main.ts:68`

8. **Double-cookie CSRF** — `main.ts:70-90`
   - `csrf-csrf` with secret from `CSRF_SECRET` env or random 32-byte fallback
   - Session identifier: `req.ip`
   - Token cookie: `x-csrf-token` (sameSite: strict, secure in production)
   - Token extracted from `x-csrf-token` header

9. **Swagger/OpenAPI (dev only)** — `main.ts:93-102`
   - Disabled when `NODE_ENV === 'production'`
   - Available at `/api/docs`

10. **Server listen** — `main.ts:104-106`
    - Port from `NEST_PORT` env, default 4000
    - Bind: `0.0.0.0`

### ThrottlerGuard: 6 Named Tiers

**Source**: `backend/src/app.module.ts:30-37`

| Name | TTL | Limit | Applied To |
|---|---|---|---|
| `global` | 900s | 2000 | Default (all routes) |
| `login` | 900s | 50 | `@Throttle({ login: {} })` on POST /api/auth/login |
| `auth` | 900s | 100 | POST /api/auth/refresh, logout, ticket creation |
| `search` | 60s | 60 | GET /api/tickets/search |
| `analytics` | 900s | 300 | Entire /api/analytics controller |
| `upload` | 3600s | 100 | POST /api/uploads |

### Global Filters

#### GlobalExceptionFilter (`backend/src/common/filters/global-exception.filter.ts:1-37`)

- Catches **all** exceptions (NestJS + raw) via `@Catch()`
- Produces structured JSON: `{ message, requestId, stack? }`
- **Production safety** (`filter.ts:23-35`):
  - Stack traces emitted ONLY when `NODE_ENV !== 'production'`
  - 500 errors always return generic message in production
  - `requestId` from `x-request-id` header included in response

### Global Interceptors (2)

#### MutationLoggerInterceptor (`backend/src/common/interceptors/mutation-logger.interceptor.ts`)

- Registered as `APP_INTERCEPTOR` — `app.module.ts:64`
- Logs mutation operations (POST/PUT/PATCH/DELETE) for audit trail

#### RequestIdInterceptor (`backend/src/common/interceptors/request-id.interceptor.ts`)

- Registered as `APP_INTERCEPTOR` — `app.module.ts:65`
- Generates/propagates `x-request-id` for request tracing

### Guards (2)

#### JwtAuthGuard (`backend/src/common/guards/jwt-auth.guard.ts:1-33`)

- **Not** a Passport guard — custom `CanActivate` implementation
- Extracts token from `Authorization: Bearer <token>` header — `jwt-auth.guard.ts:11-12`
- Verifies access token via `verifyAccessToken()` — `jwt-auth.guard.ts:19`
- Validates user is active and not deleted — `jwt-auth.guard.ts:20-26`
- Sets `request.user` to decoded payload — `jwt-auth.guard.ts:27`
- Throws: `UnauthorizedException` (missing token), `ForbiddenException` (inactive/expired)

#### RolesGuard (`backend/src/common/guards/roles.guard.ts:1-35`)

- Uses NestJS `Reflector` to read `ROLES_KEY` metadata — `roles.guard.ts:10-12`
- Checks `request.user.role` against allowed roles — `roles.guard.ts:25-27`
- Throws `ForbiddenException` with `FORBIDDEN` code on mismatch

### Decorators (2)

- `CurrentUser` — Param decorator to extract user or specific field from `request.user` — `common/decorators/current-user.decorator.ts:3-8`
- `Roles` — `SetMetadata(ROLES_KEY, roles)` — `common/decorators/roles.decorator.ts:3-4`

### Validation Pipe

- `ZodValidationPipe` — `common/pipes/zod-validation.pipe.ts`

### Schemas

- `tickets.schema.ts` — Zod validation schema for ticket creation — `common/schemas/tickets.schema.ts`

---

## Database Architecture

### Prisma ORM

- **Client**: `@prisma/client` 6.2.1 — `backend/package.json:32`
- **Provider**: PostgreSQL — `schema.prisma:6`
- **Service**: `PrismaService` extends `PrismaClient` — `prisma/prisma.service.ts:5`
  - Logging: `warn` + `error` in development, `error` only in production — `prisma.service.ts:10`
  - `onModuleDestroy` → `$disconnect()` — `prisma.service.ts:15-18`
- **Module**: `PrismaModule` provides + exports `PrismaService` — `prisma/prisma.module.ts:4-7`

### Connection Pool (via DATABASE_URL)

From `docker-compose.yml:40`:
```
?connection_limit=20&pool_timeout=30&connect_timeout=10
```

### Schema: 29 Models, 9 Domains

(See system-overview.md for complete model listing with line numbers.)

---

## Caching: In-Memory Permission Cache

**Source**: `backend/src/core/permissionCache.ts:1-40`

```typescript
interface PermissionEntry {
  canChangeStatus: boolean | null;
  canAssignTickets: boolean | null;
  canTransferTickets: boolean | null;
  canArchiveTickets: boolean | null;
  expiresAt: number;
}
```

- **Storage**: `Map<string, PermissionEntry>` — `permissionCache.ts:9`
- **Key**: `${userId}:${deptId}` — `permissionCache.ts:12-14`
- **TTL**: 30,000ms (30 seconds) — `permissionCache.ts:10`
- **API**:
  - `getCachedPermissions(userId, deptId)` — returns entry if not expired, else null — lines 16-24
  - `setCachedPermissions(userId, deptId, perms)` — sets entry with expiration — lines 26-32
  - `invalidatePermissionCache(userId?, deptId?)` — single key or full clear — lines 34-39

**Note**: This is an in-memory cache, NOT Redis-based. PRD `section 9.2, RISK-06` notes this as a future enhancement.

### Backend Translations

**Source**: `backend/src/core/translations.ts:1-848`

- 297 translation keys in both `en` and `ar`
- Duplicate of frontend translations (not using i18next)
- Exported types: `Language`, `TranslationKeys`

### Arabic Utilities

**Source**: `backend/src/core/arabic.ts`

- `normalizeArabic()` function used in KnowledgeBase search for diacritics normalization

### Core Paths

**Source**: `backend/src/core/paths.ts:1-7`

```typescript
UPLOADS_DIR = process.cwd() + '/uploads'
AVATARS_DIR = UPLOADS_DIR + '/avatars'
EXPORTS_DIR = UPLOADS_DIR + '/exports'
DIST_DIR = process.cwd() + '/dist'
```

---

## Background Jobs: BullMQ 3 Cron Jobs

**Source**: `backend/src/modules/jobs/jobs.module.ts:1-41`

### Queue Configuration

- BullModule.forRoot in `app.module.ts:38-44`:
  - Redis URL: `REDIS_URL` env or `redis://localhost:6379`
  - Retry strategy: `Math.min(times * 100, 3000)`ms
  - `maxRetriesPerRequest: null` (unlimited)
- JobsModule registers queue: `BullModule.registerQueue({ name: 'cron-jobs' })` — `jobs.module.ts:37`

### Scheduler (CronSchedulerService, OnModuleInit)

**Source**: `jobs.module.ts:10-32`

| Job Name | Cron Pattern | Schedule |
|---|---|---|
| `cleanup-exports` | `0 3 * * *` | Every day at 3:00 AM |
| `sla-check` | `*/5 * * * *` | Every 5 minutes |
| `auto-archive` | `0 4 * * *` | Every day at 4:00 AM |

### Processor

**Source**: `backend/src/modules/jobs/cron.processor.ts:1-25`

- `@Processor('cron-jobs')` decorated class
- Extends `WorkerHost`, dispatches by `job.name` switch:
  - `cleanup-exports` → `cronService.cleanupExports()`
  - `sla-check` → `cronService.slaCheck()`
  - `auto-archive` → `cronService.autoArchive()`

### CronService Implementations

**Source**: `backend/src/modules/jobs/cron.service.ts:1-146`

#### cleanupExports (lines 11-35)
1. Find `ExportHistory` records where `expiresAt <= now`
2. Delete each file from disk using `EXPORTS_DIR`
3. `deleteMany` the expired DB records

#### slaCheck (lines 36-111)
1. Find breached tickets: `status NOT IN (resolved, closed)` AND `slaDeadline < now` AND `slaBreachSent = false`
2. For each breached ticket: create `SLA_BREACH` notifications to all active dept users, set `slaBreachSent: true`
3. Find warning tickets: `slaDeadline > now` AND `slaWarningSent = false`
4. For each warning ticket: if `(elapsed / total) >= 80%`, create `SLA_WARNING` notifications, set `slaWarningSent: true`

#### autoArchive (lines 113-146)
1. Find tickets with `status IN (resolved, closed)` AND `completedAt < 30 days ago` AND `!isArchived`
2. For each: set `isArchived: true`, `archivedAt: now`
3. Create audit log entry: action `AUTO_ARCHIVED`

---

## WebSocket: Socket.IO Gateway

**Source**: `backend/src/gateways/ticket.gateway.ts:1-101`
**Module**: `backend/src/gateways/gateways.module.ts:1-8`

### Gateway Configuration

```typescript
@WebSocketGateway({
  cors: { origin: CORS_ORIGINS, methods: ['GET', 'POST'], credentials: true },
})
```

- CORS origins mirror HTTP CORS — `ticket.gateway.ts:29-35`
- `GatewaysModule` is `@Global()` and `exports: [TicketGateway]` — `gateways.module.ts:1-8`
- Gateway is available to all modules without explicit import

### Connection Lifecycle

#### handleConnection (lines 40-54)
1. Extract token from `handshake.auth.token` or `handshake.query.token`
2. If no token: emit `error`, disconnect
3. Verify token via `verifyAccessToken()` from `auth.utils.ts`
4. Attach `client.userData = decoded` on success
5. On invalid/expired: emit `error`, disconnect

#### handleDisconnect (lines 56-58)
- Clean up rate limit entries: `RATE_LIMITS.delete(client.id)`

### Room Events (3 Join + 1 Leave)

| Event | Handler | Access Control | Rate Limit |
|---|---|---|---|
| `join-department` | `handleJoinDepartment` (lines 60-66) | super_admin OR matching deptId | None |
| `join-user` | `handleJoinUser` (lines 68-74) | Matching userId | None |
| `join-ticket` | `handleJoinTicket` (lines 76-83) | Any authenticated user | 5 req / 1000ms |
| `leave-ticket` | `handleLeaveTicket` (lines 85-88) | No access control | None |

### Rate Limiting (In-Memory)

**Source**: `ticket.gateway.ts:7-27`

```typescript
interface RateLimitEntry {
  timestamps: number[];
}
const RATE_LIMITS: Map<string, Map<string, RateLimitEntry>> = new Map();
```
- Key: `socketId → eventId → timestamps[]`
- Filter: removes timestamps older than `windowMs`
- Only applied to `join-ticket` event at `ticket.gateway.ts:78`

### Emitter Methods (3)

| Method | Room Pattern | Line |
|---|---|---|
| `emitToDept(deptId, event, data)` | `dept-${deptId}` | 90-92 |
| `emitToUser(userId, event, data)` | `user-${userId}` | 94-96 |
| `emitToTicket(ticketId, event, data)` | `ticket-${ticketId}` | 98-100 |

---

## Backend Folder Structure

```
backend/src/
├── main.ts                              # Bootstrap, middleware pipeline
├── app.module.ts                        # Root module, 14 imports, 4 global providers
├── prisma/
│   ├── prisma.module.ts                 # PrismaModule (exports PrismaService)
│   └── prisma.service.ts                # PrismaService extends PrismaClient
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts    # CurrentUser param decorator
│   │   └── roles.decorator.ts           # Roles() SetMetadata decorator
│   ├── filters/
│   │   └── global-exception.filter.ts   # @Catch(), production-safe
│   ├── guards/
│   │   ├── jwt-auth.guard.ts            # Custom JWT canActivate
│   │   └── roles.guard.ts               # Role-based canActivate
│   ├── health/
│   │   └── health.controller.ts         # GET /api/health
│   ├── interceptors/
│   │   ├── mutation-logger.interceptor.ts  # APP_INTERCEPTOR
│   │   └── request-id.interceptor.ts     # APP_INTERCEPTOR
│   ├── pipes/
│   │   └── zod-validation.pipe.ts      # Zod-based validation pipe
│   └── schemas/
│       └── tickets.schema.ts           # Zod ticket creation schema
├── core/
│   ├── api.ts                          # API utilities
│   ├── arabic.ts                       # normalizeArabic()
│   ├── NotificationProvider.tsx        # (shared, not used in NestJS)
│   ├── paths.ts                        # UPLOADS_DIR, AVATARS_DIR, EXPORTS_DIR, DIST_DIR
│   ├── permissionCache.ts              # In-memory 30s TTL permission cache
│   └── translations.ts                 # 297 keys × 2 languages
├── gateways/
│   ├── gateways.module.ts              # @Global(), exports TicketGateway
│   └── ticket.gateway.ts               # Socket.IO gateway, JWT auth, 4 room events
├── lib/
│   └── utils.ts                        # Utility functions
└── modules/
    ├── admin/
    │   ├── admin.module.ts             # 6 controllers, RolesGuard provider
    │   └── controllers/
    │       ├── admin-users.controller.ts       # 5 endpoints, super_admin only
    │       ├── admin-departments.controller.ts # 4 endpoints
    │       ├── admin-roles.controller.ts       # 5 endpoints
    │       ├── admin-buildings.controller.ts   # 4 endpoints
    │       ├── admin-floors.controller.ts      # 4 endpoints
    │       └── admin-ticket-types.controller.ts # 4 endpoints
    ├── analytics/analytics.controller.ts, service.ts, module.ts
    ├── assets/assets.controller.ts, service.ts, module.ts
    ├── audit/audit.controller.ts, service.ts, module.ts
    ├── auth/
    │   ├── auth.controller.ts          # 3 endpoints
    │   ├── auth.service.ts             # login, refresh, logout
    │   ├── auth.module.ts              # PassportModule, JwtModule
    │   ├── auth.utils.ts               # JWT generate/verify functions
    │   └── strategies/jwt.strategy.ts  # Passport JWT strategy
    ├── jobs/
    │   ├── cron.processor.ts           # @Processor dispatch
    │   ├── cron.service.ts             # 3 cron job implementations
    │   └── jobs.module.ts              # BullQueue + scheduler
    ├── knowledge/knowledge.controller.ts, service.ts, module.ts
    ├── notifications/notifications.controller.ts, service.ts, module.ts
    ├── profile/profile.controller.ts, service.ts, module.ts
    ├── team-notes/team-notes.controller.ts, service.ts, module.ts
    ├── tickets/
    │   ├── tickets.controller.ts       # 22 endpoints
    │   ├── tickets.service.ts          # Full ticket lifecycle
    │   ├── tickets.module.ts
    │   ├── sla.utils.ts                # SLA deadline computation
    │   └── workflow.constants.ts       # Status transitions, priority modifiers
    ├── uploads/uploads.controller.ts, service.ts, module.ts
    └── users/users.controller.ts, service.ts, module.ts
```

---

## Module Dependency Graph

```
                    ┌──────────────────┐
                    │    AppModule     │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────────────┐
              │              │                       │
      ┌───────┴──────┐ ┌────┴─────┐        ┌───────┴──────┐
      │  ConfigModule │ │ BullModule│        │ PrismaModule │
      │  (global)    │ │ (forRoot) │        │ (13 modules) │
      └──────────────┘ └────┬─────┘        └───────┬──────┘
                             │                       │
              ┌──────────────┼──────────────┐        │
              │       ┌──────┴──────┐       │        │
         ┌────┴────┐  │  JobsModule  │  ┌────┴────┐  │
         │  Auth   │  │  (BullQueue  │  │Gateways │  │
         │  Users  │  │   cron-jobs) │  │ module  │  │
         │  Admin  │  └──────────────┘  └─────────┘  │
         │  Tickets│                                PrismaService
         │  Analytics│                              (singleton)
         │  Profile │
         │  Audit   │
         │  Uploads │
         │  Assets  │
         │  TeamNotes│
         │  Knowledge│
         │  Notifications│
         └─────────┘

AuthModule ──imports──> [PassportModule, JwtModule, PrismaModule]
AuthModule ──exports──> AuthService

UploadsModule ──(no imports)──> Standalone (service-only)

GatewaysModule ──@Global()──> TicketGateway available everywhere
GatewaysModule ──(no DB imports)──> Uses verifyAccessToken() directly
```

### Module-Level Dependencies

| Module | Imports | Exports |
|---|---|---|
| AuthModule | PassportModule, JwtModule, PrismaModule | AuthService |
| UsersModule | PrismaModule | UsersService |
| AdminModule | PrismaModule | (nothing) |
| TicketsModule | PrismaModule | (nothing) |
| AnalyticsModule | PrismaModule | (nothing) |
| ProfileModule | PrismaModule | (nothing) |
| AuditModule | PrismaModule | (nothing) |
| UploadsModule | (none) | (nothing) |
| AssetsModule | PrismaModule | (nothing) |
| TeamNotesModule | PrismaModule | (nothing) |
| KnowledgeModule | PrismaModule | (nothing) |
| NotificationsModule | PrismaModule | (nothing) |
| JobsModule | PrismaModule, BullModule.registerQueue | (nothing) |
| GatewaysModule | (none) | TicketGateway |
| PrismaModule | (none) | PrismaService |

### Inter-Module References (Without NestJS DI)

| Source Module | References | Mechanism |
|---|---|---|
| Gateways (TicketGateway) | AuthModule (verifyAccessToken) | Direct import — `ticket.gateway.ts:5` |
| TicketsService | GatewaysModule (TicketGateway) | Direct import of global provider (likely) |
| Notifications from cron | NotificationsService | Creates Notification records directly via PrismaService |
| All admin controllers | PrismaService | Direct injection (no service layer) |

**Note**: Admin controllers inject `PrismaService` directly rather than using a service layer, mixing ORM operations with controller logic.