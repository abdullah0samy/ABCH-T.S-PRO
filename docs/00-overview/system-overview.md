# ABCH Hospital Ticketing CRM — System Overview

## Product Identity

| Field | Value |
|---|---|
| **Product Name** | abch-ticketing |
| **Version** | 2.0.0 |
| **Full Name** | ABCH Ticketing CRM |
| **Description** | Enterprise IT Service Management (ITSM) & Helpdesk Platform for ABCH |
| **Source** | `package.json:2-4`, `metadata.json:2`, `PRD.md:2,32` |

---

## Full Technology Stack

### Backend

| Technology | Version | Source |
|---|---|---|
| NestJS | 11.1.26 | `backend/package.json:24` |
| TypeScript | ~5.8.2 | `backend/package.json:74` |
| Prisma ORM | 6.2.1 | `backend/package.json:32` |
| PostgreSQL | 15 (Alpine) | `docker-compose.yml:5` |
| Redis | 7 (Alpine) | `docker-compose.yml:20` |
| Socket.IO | 4.8.3 | `backend/package.json:53` |
| BullMQ | 5.73.0 | `backend/package.json:34` |
| bcryptjs | 3.0.3 | `backend/package.json:33` |
| JWT (jsonwebtoken) | 9.0.3 | `backend/package.json:44` |
| Helmet | 8.1.0 | `backend/package.json:42` |
| ioredis | 5.10.1 | `backend/package.json:43` |
| multer | 2.1.1 | `backend/package.json:46` |
| Sharp | 0.34.5 | `backend/package.json:52` |
| web-push (VAPID) | 3.6.7 | `backend/package.json:56` |
| exceljs | 4.4.0 | `backend/package.json:38` |
| file-type (magic bytes) | 22.0.1 | `backend/package.json:41` |
| passport + passport-jwt | 0.7.0 / 4.0.1 | `backend/package.json:48-49` |
| node-cron | 4.2.1 | `backend/package.json:47` |
| @nestjs/swagger | 11.4.4 | `backend/package.json:29` |
| express-rate-limit | 8.3.2 | `backend/package.json:40` |

### Frontend

| Technology | Version | Source |
|---|---|---|
| React | 19.0.0 | `frontend/package.json:22` |
| Vite | 6.2.0 | `frontend/package.json:42` |
| TailwindCSS | 4.1.14 | `frontend/package.json:14,40` |
| Zustand | 5.0.12 | `frontend/package.json:32` |
| Socket.IO Client | 4.8.3 | `frontend/package.json:29` |
| recharts | 3.8.1 | `frontend/package.json:28` |
| motion (Framer Motion) | 12.23.24 | `frontend/package.json:21` |
| lucide-react | 0.546.0 | `frontend/package.json:20` |
| react-hook-form | 7.72.1 | `frontend/package.json:24` |
| zod | 4.3.6 | `frontend/package.json:31` |
| i18next | 26.0.3 | `frontend/package.json:18` |
| react-i18next | 17.0.2 | `frontend/package.json:25` |
| axios | 1.14.0 | `frontend/package.json:15` |
| date-fns | 4.1.0 | `frontend/package.json:17` |

### Dev & Ops

| Technology | Purpose | Source |
|---|---|---|
| Vitest | 4.1.4 | Testing | `package.json:30` |
| TypeScript | ~5.8.2 | Type safety | `package.json:29` |
| Docker + docker-compose | Containerization | `docker-compose.yml:1` |
| tsx | 4.21.0 | TS execution | `package.json:28` |
| Nginx | Frontend serving | `frontend/nginx.conf:1` |

---

## Architecture Overview

### Monorepo Structure

```
Ticket-crm-main/
├── package.json              # Root workspace (abch-ticketing v2.0.0)  [`package.json:2`]
├── docker-compose.yml        # 4 Docker services                      [`docker-compose.yml:1`]
├── PRD.md                    # Product Requirements Document          [`PRD.md:1`]
├── backend/
│   ├── package.json          # NestJS 11.1 backend                    [`backend/package.json:2`]
│   ├── Dockerfile
│   ├── prisma/
│   │   └── schema.prisma     # 29 Prisma models                       [`backend/prisma/schema.prisma:1`]
│   └── src/
│       ├── main.ts           # Bootstrap + middleware pipeline        [`backend/src/main.ts:1`]
│       ├── app.module.ts     # 14 feature modules                     [`backend/src/app.module.ts:1`]
│       ├── prisma/           # PrismaService + PrismaModule           [`backend/src/prisma/prisma.service.ts:5`]
│       ├── common/           # Guards, filters, interceptors, schemas
│       ├── core/             # Paths, permission cache, translations, Arabic utils
│       ├── gateways/         # Socket.IO gateway                      [`backend/src/gateways/ticket.gateway.ts:33`]
│       ├── lib/              # Utility functions                      [`backend/src/lib/utils.ts:1`]
│       └── modules/          # 13 feature modules                     [`backend/src/app.module.ts:12-25`]
├── frontend/
│   ├── package.json          # React 19 + Vite 6 frontend             [`frontend/package.json:2`]
│   ├── Dockerfile
│   ├── nginx.conf            # Nginx config (port 80)                 [`frontend/nginx.conf:2`]
│   └── src/
│       ├── main.tsx          # React entry point                      [`frontend/src/main.tsx:1`]
│       ├── App.tsx           # Custom router + layout                 [`frontend/src/App.tsx:1`]
│       ├── index.css         # TailwindCSS v4 + CSS custom props      [`frontend/src/index.css:1`]
│       ├── store/            # 3 Zustand stores                       [`frontend/src/store/authStore.ts:1`]
│       ├── core/             # apiFetch, translations, Socket.IO
│       ├── components/       # ErrorBoundary, GlobalSearch
│       └── pages/            # 18 pages across 3 directories
├── tests/                    # Test suite
└── docs/                     # Documentation
```

---

## Database: 29 Tables Across 9 Domains

| Domain | Tables | Source (schema.prisma lines) |
|---|---|---|
| **Identity** | User (101:143), Role (145:155), Permission (157:165), UserPermissionOverride (167:187) | 4 models |
| **Organization** | Department (59:86), DeptPermissions (12:30), DeptTransferAllowlist (88:99) | 3 models |
| **Facilities** | Building (32:43), Floor (45:57) | 2 models |
| **Ticketing** | Ticket (205:273), TicketType (189:203), TicketMessage (291:307), MessageAttachment (309:323), TicketAttachment (275:289), TicketStatusHistory (342:354), TicketTransfer (325:340) | 7 models |
| **Collaboration** | TeamNote (376:391), TeamNoteComment (393:404), TeamNoteLike (406:416), TeamNoteAttachment (418:431) | 4 models |
| **Notifications** | Notification (356:374), PushSubscription (433:444) | 2 models |
| **Knowledge** | KnowledgeCategory (518:527), KnowledgeArticle (529:547) | 2 models |
| **Assets** | Asset (500:516) | 1 model |
| **System** | AuditLog (446:468), SystemSetting (470:478), ExportHistory (480:497) | 3 models |

**Total: 29 Prisma models mapped to 29 PostgreSQL tables.**

### Key Indexes (Ticket model)

- `[status, createdAt]` — `schema.prisma:263`
- `[departmentId, status]` — `schema.prisma:264`
- `[assignedToId, status]` — `schema.prisma:265`
- `[isArchived]` — `schema.prisma:266`
- `[createdById]` — `schema.prisma:267`
- `[ticketTypeId]` — `schema.prisma:268`
- `[slaDeadline]` — SLA cron scan — `schema.prisma:269`
- `[departmentId, createdAt]` — date-filtered dept queries — `schema.prisma:270`
- `[departmentId, isArchived, status]` — inbox compound filter — `schema.prisma:271`

Additional indexes on AuditLog (`userId`, `ticketId+createdAt`, `action+createdAt`, `createdAt`), Notification (`userId`, `userId+isRead`, `ticketId`), KnowledgeArticle (`categoryId`, `isActive`, `views`).

---

## API Endpoints: 93 Total Across 15 Controllers

| Module | Controller(s) | Base Route | Endpoint Count | Source |
|---|---|---|---|---|
| Health | HealthController | /api | 1 | `backend/src/common/health/health.controller.ts:8` |
| Auth | AuthController | /api/auth | 3 | `backend/src/modules/auth/auth.controller.ts:8` |
| Users | UsersController | /api/users | 3 | `backend/src/modules/users/users.controller.ts:13` |
| Admin-Users | AdminUsersController | /api/admin/users | 5 | `backend/src/modules/admin/controllers/admin-users.controller.ts:12` |
| Admin-Departments | AdminDepartmentsController | /api/admin/departments | 4 | `backend/src/modules/admin/controllers/admin-departments.controller.ts:11` |
| Admin-Roles | AdminRolesController | /api/admin | 5 | `backend/src/modules/admin/controllers/admin-roles.controller.ts:11` |
| Admin-Buildings | AdminBuildingsController | /api/admin/buildings | 4 | `backend/src/modules/admin/controllers/admin-buildings.controller.ts:11` |
| Admin-Floors | AdminFloorsController | /api/admin/floors | 4 | `backend/src/modules/admin/controllers/admin-floors.controller.ts:11` |
| Admin-TicketTypes | AdminTicketTypesController | /api/admin/ticket-types | 4 | `backend/src/modules/admin/controllers/admin-ticket-types.controller.ts:11` |
| Tickets | TicketsController | /api/tickets | 22 | `backend/src/modules/tickets/tickets.controller.ts:12` |
| Analytics | AnalyticsController | /api/analytics | 10 | `backend/src/modules/analytics/analytics.controller.ts:13` |
| Profile | ProfileController | /api/profile | 2 | `backend/src/modules/profile/profile.controller.ts:9` |
| Audit | AuditController | /api/audit | 2 | `backend/src/modules/audit/audit.controller.ts:10` |
| Uploads | UploadsController | /api/uploads | 2 | `backend/src/modules/uploads/uploads.controller.ts:23` |
| Assets | AssetsController | /api/assets | 4 | `backend/src/modules/assets/assets.controller.ts:11` |
| TeamNotes | TeamNotesController | /api/team-notes | 5 | `backend/src/modules/team-notes/team-notes.controller.ts:9` |
| Knowledge | KnowledgeController | /api/knowledge | 11 | `backend/src/modules/knowledge/knowledge.controller.ts:9` |
| Notifications | NotificationsController | /api/notifications | 5 | `backend/src/modules/notifications/notifications.controller.ts:9` |

**Grand total: 93 REST API endpoints.**

---

## User Roles: 5 Roles

| Role (PRD) | Role (Code) | Source |
|---|---|---|
| super_admin | super_admin | `PRD.md:110`, `backend/src/common/guards/roles.guard.ts:27` |
| admin | supervisor | `PRD.md:111`, `backend/src/modules/admin/controllers/admin-departments.controller.ts:18` |
| dept_manager | supervisor | `PRD.md:112`, same as above |
| agent | agent | `PRD.md:113`, `backend/src/modules/admin/controllers/admin-departments.controller.ts:18` |
| end_user | end_user | `PRD.md:114`, `backend/src/modules/team-notes/team-notes.service.ts:49` |

**Note: The codebase uses `supervisor` (code) where the PRD specifies `admin` + `dept_manager` (PRD). The PRD defines a 5-role hierarchy (`super_admin → admin → dept_manager → agent → end_user`), but the codebase consolidates `admin` and `dept_manager` into a single `supervisor` role. The Role model (`schema.prisma:145-155`) supports arbitrary role names stored as strings. See `backend/src/modules/admin/controllers/admin-departments.controller.ts:18` for role-based guard references.**

### Default Role Seed

The seed script creates these roles. Source: `backend/prisma/seed.ts`.

---

## i18n Support: Arabic RTL (Default) + English LTR

### Translation Keys

| Location | EN Keys | AR Keys | Source |
|---|---|---|---|
| Frontend | 297 keys | 297 keys | `frontend/src/core/translations.ts:1-845` |
| Backend (duplicate) | 297 keys | 297 keys | `backend/src/core/translations.ts:1-848` |

**Total: 297 unique translation keys, each present in both Arabic and English.**

### Default Language

- Frontend default: Arabic (`language: 'ar'`) — `frontend/src/store/settingsStore.ts:16`
- User model default: Arabic (`langPref` default `"ar"`) — `schema.prisma:114`

### Direction Handling

- Dynamic `dir` attribute: RTL for Arabic, LTR for English — `frontend/src/App.tsx:283`
- CSS transitions for theme/language switching — `frontend/src/index.css:48-67`

### Bilingual DB Fields

Models with `Ar`/`En` field pairs:
- User: `fullNameAr` / `fullNameEn` — `schema.prisma:107-108`
- Department: `nameAr` / `nameEn`, `descriptionAr` / `descriptionEn` — `schema.prisma:61-64`
- Building: `nameAr` / `nameEn` — `schema.prisma:34-35`
- Floor: `nameAr` / `nameEn` — `schema.prisma:47-48`
- TicketType: `nameAr` / `nameEn` — `schema.prisma:191-192`
- Notification: `titleAr`/`titleEn`, `bodyAr`/`bodyEn` — `schema.prisma:361-364`
- KnowledgeCategory: `nameAr` / `nameEn` — `schema.prisma:520-521`
- KnowledgeArticle: `titleAr`/`titleEn`, `contentAr`/`contentEn` — `schema.prisma:530-533`

---

## Docker Compose Services

| Service | Image | Host Port | Container Port | Source |
|---|---|---|---|---|
| postgres | postgres:15-alpine | 5445 | 5432 | `docker-compose.yml:4-18` |
| redis | redis:7-alpine | 9396 | 6379 | `docker-compose.yml:20-27` |
| backend | Custom Dockerfile | 3007 | 4000 | `docker-compose.yml:33-50` |
| frontend | Custom Dockerfile + Nginx | 8080 | 80 | `docker-compose.yml:52-59` |

### Dependencies

- backend depends_on: postgres (healthy), redis (healthy) — `docker-compose.yml:46-50`
- frontend depends_on: backend — `docker-compose.yml:58`

### Volumes

- `pgdata` named volume for PostgreSQL persistence — `docker-compose.yml:61`
- `./dump.rdb:/data/dump.rdb` for Redis persistence — `docker-compose.yml:24`

---

## Deployment Approach

1. **Containerized**: All 4 services are Docker containers orchestrated via `docker-compose.yml`
2. **Frontend**: Vite build output served by Nginx — `frontend/nginx.conf:1-29`
   - SPA fallback: `try_files $uri $uri/ /index.html` — `frontend/nginx.conf:17`
   - Gzip compression enabled — `frontend/nginx.conf:9-13`
3. **Backend**: Runs on port 4000 inside container, exposed on host port 3007
4. **Database**: PostgreSQL 15 on port 5445 with health checks (`pg_isready`)
5. **Cache/Queue**: Redis 7 on port 9396 with RDB persistence

---

## Security Features

### Helmet CSP

Configured in `backend/src/main.ts:29-51`:
- `defaultSrc: "'self'"`
- `scriptSrc: "'self'"`
- `styleSrc: "'self'", "'unsafe-inline'"` (required for TailwindCSS)
- `imgSrc: "'self'", "data:", "blob:", "https://*"`
- `objectSrc: "'none'"`
- `frameguard: { action: 'deny' }`
- HSTS enabled in production only (`NODE_ENV === 'production'`) — `main.ts:42-47`
- `xssFilter: true`, `noSniff: true`

### CSRF Protection (Double-Cookie Pattern)

Implemented in `backend/src/main.ts:70-90`:
- Library: `csrf-csrf` (double-cookie CSRF)
- Token cookie: `x-csrf-token` (SameSite: strict, secure in production)
- Token extracted from `x-csrf-token` header
- Secret from `CSRF_SECRET` env var or random 32-byte fallback

### CORS Whitelist

Configured in `backend/src/main.ts:54-63`:
- **Production**: Single origin from `FRONTEND_URL`
- **Development**: `localhost:3000`, `localhost:5173`, `127.0.0.1:3000`, `127.0.0.1:5173`
- `credentials: true`

### Rate Limiting (6 Named Tiers)

Defined in `backend/src/app.module.ts:30-37`:

| Tier | TTL | Limit | Purpose |
|---|---|---|---|
| global | 900s (15 min) | 2000 | Default for all routes |
| login | 900s (15 min) | 50 | POST /api/auth/login — `auth.controller.ts:14` |
| auth | 900s (15 min) | 100 | POST /api/auth/refresh, /api/auth/logout — `auth.controller.ts:39,49` |
| search | 60s (1 min) | 60 | GET /api/tickets/search — `tickets.controller.ts:39` |
| analytics | 900s (15 min) | 300 | GET /api/analytics/* — `analytics.controller.ts:15` |
| upload | 3600s (1 hr) | 100 | POST /api/uploads — `uploads.controller.ts:30` |

### bcrypt Password Hashing

- **Login**: `bcrypt.compare(password, user.passwordHash)` — `auth.service.ts:55`
- **User creation**: `bcrypt.hash(password, 12)` — `admin-users.controller.ts:62`
- **Password reset**: `bcrypt.hash(body.password, 12)` — `admin-users.controller.ts:146`

### JWT Authentication

- **Access token**: 8h expiry — `auth.utils.ts:16`
- **Refresh token**: 7d expiry, httpOnly cookie — `auth.utils.ts:25`, `auth.controller.ts:23-28`
- **Fail-fast**: Server exits if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` missing — `main.ts:14-19`, `auth.utils.ts:5-9`
- **Guard**: Checks token validity + user isActive + deletedAt — `jwt-auth.guard.ts:19-31`

### File Upload Security

- Magic-byte validation: `uploads.service.ts` calls `validateMagicByte()` — `uploads.controller.ts:70`
- File extension whitelist — `uploads.controller.ts:12`
- MIME type whitelist — `uploads.controller.ts:13-19`
- Size limit: 5MB — `uploads.controller.ts:56`
- Allowed types: JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX, WAV, MP3, WEBM — `uploads.controller.ts:12`

### Account Lockout

- 5 failed attempts → 15-minute lockout — `auth.service.ts:58-60`
- `failedLoginAttempts` and `lockUntil` fields on User — `schema.prisma:119-120`

### Production Error Handling

- GlobalExceptionFilter never exposes stack traces in production — `global-exception.filter.ts:23-35`
- Generic message in production for 500 errors: "An unexpected error occurred. Please contact IT support."

### JWT Secret Requirement

- `main.ts:14-19`: Server refuses to start if either secret is missing
- `auth.utils.ts:5-9`: Same fail-fast check at module level

---

## Background Jobs: 3 BullMQ Cron Processors

| Job | Schedule | Purpose | Source |
|---|---|---|---|
| sla-check | `*/5 * * * *` (every 5 min) | SLA warning (80%) + breach notifications | `jobs.module.ts:22-24`, `cron.service.ts:36-111` |
| auto-archive | `0 4 * * *` (4 AM daily) | Archive resolved/closed tickets older than 30 days | `jobs.module.ts:26-28`, `cron.service.ts:113-146` |
| cleanup-exports | `0 3 * * *` (3 AM daily) | Delete expired export files + DB records | `jobs.module.ts:15-17`, `cron.service.ts:11-35` |

---

## WebSocket: Socket.IO Gateway

- **Gateway**: `TicketGateway` — `backend/src/gateways/ticket.gateway.ts:36`
- **Module**: `GatewaysModule` marked `@Global()`, exports `TicketGateway` — `gateways.module.ts:1-8`
- **Authentication**: JWT verification on `handleConnection` handshake — `ticket.gateway.ts:40-53`
- **Rooms** (3 types):
  - `dept-{id}` via `join-department` event — `ticket.gateway.ts:60-66`
  - `user-{id}` via `join-user` event — `ticket.gateway.ts:68-74`
  - `ticket-{id}` via `join-ticket` event — `ticket.gateway.ts:76-83`
- **Rate limiting**: `join-ticket` limited to 5 requests per 1000ms per socket — `ticket.gateway.ts:78`
- **Rate limit cleanup**: `RATE_LIMITS.delete(client.id)` on disconnect — `ticket.gateway.ts:57-58`
- **Emit methods**: `emitToDept()`, `emitToUser()`, `emitToTicket()` — `ticket.gateway.ts:90-100`
- **CORS**: Whitelisted origins matching HTTP CORS — `ticket.gateway.ts:29-35`

### Client-Side WebSocket (Frontend)

- **Provider**: `NotificationProvider` in `frontend/src/core/NotificationProvider.tsx`
- **Connection**: `io(window.location.origin, { auth: { token } })` — `NotificationProvider.tsx:92-101`
- **Events consumed**: `new-ticket`, `ticket-status-updated`, `ticket-assigned`, `new-comment`, `sla-warning`, `sla-breach` — `NotificationProvider.tsx:118-177`
- **Room joining**: Auto-joins `user-{id}` and `dept-{id}` on connect — `NotificationProvider.tsx:103-108`
- **Reconnection**: 10 attempts max, 2s-10s delay — `NotificationProvider.tsx:95-100`
- **Browser push**: `Notification` API integration on `addNotification` — `NotificationProvider.tsx:78-80`