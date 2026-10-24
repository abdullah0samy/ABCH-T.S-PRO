# RBAC System Documentation

## Overview

The ABCH Hospital Ticketing CRM uses a multi-layer Role-Based Access Control system combining:
1. **JWT authentication** (user identity & account status)
2. **Role-based route guards** (`@Roles()` decorator with `RolesGuard`)
3. **Department-level permissions** (`DeptPermissions` model with 13 boolean flags)
4. **Per-user permission overrides** (`UserPermissionOverride` model with nullable flags)
5. **Frontend role gating** (sidebar filtering + admin path blocking)

---

## Roles

Four roles are defined in the frontend sidebar configuration (`frontend/src/App.tsx:155-166`) and referenced throughout the backend:

| Role | Description |
|------|-------------|
| `super_admin` | Full system access. Bypasses all permission checks. Can modify closed/resolved tickets. |
| `supervisor` | Department-level oversight. Sees all dept tickets, can view analytics by default. |
| `agent` | Department worker. Same ticket access as supervisor; can work on tickets. |
| `end_user` | Ticket creator only. Limited to creating tickets, viewing own tickets, dashboard, and profile. |

**Evidence:** `frontend/src/App.tsx:156` — roles array in sidebar item definitions.

---

## JWT Auth Guard

**File:** `backend/src/common/guards/jwt-auth.guard.ts`

The `JwtAuthGuard` is NestJS's `CanActivate` guard applied to protected routes:

1. Extracts Bearer token from `Authorization` header (`jwt-auth.guard.ts:11-12`)
2. Verifies token via `verifyAccessToken()` from `backend/src/modules/auth/auth.utils.ts` (`jwt-auth.guard.ts:19`)
3. Looks up user in DB by `decoded.id`, selecting only `isActive` and `deletedAt` (`jwt-auth.guard.ts:20-22`)
4. Returns `ForbiddenException` with code `ACCOUNT_INACTIVE` if user is deactivated or soft-deleted (`jwt-auth.guard.ts:24-25`)
5. Attaches `decoded` payload to `request.user` for downstream use (`jwt-auth.guard.ts:27`)
6. Catches verification failures as `ForbiddenException` with code `FORBIDDEN` (`jwt-auth.guard.ts:30`)

The guard is applied at:
- **Class level** (all endpoints): `TicketsController`, `AuditController`, `KnowledgeController`, `NotificationsController`, `UserController`
- **Selected endpoints**: Analytics endpoints, Assets endpoints, Admin endpoints

---

## Roles Guard

**File:** `backend/src/common/guards/roles.guard.ts`

The `RolesGuard` enforces role requirements at the route level:

1. Reads `ROLES_KEY` metadata set by `@Roles()` decorator via NestJS `Reflector` (`roles.guard.ts:10-13`)
2. If no roles metadata, returns `true` (allows all — `roles.guard.ts:15-17`)
3. Compares `request.user.role` with the `requiredRoles` array via `includes()` (`roles.guard.ts:26`)
4. Throws `ForbiddenException` with code `FORBIDDEN` on mismatch (`roles.guard.ts:27-30`)

**Decorator:** `backend/src/common/decorators/roles.decorator.ts:3` — `Roles` sets `ROLES_KEY` metadata using `SetMetadata`.

**Application pattern:** `@Roles('super_admin')` at class level (e.g., `AuditController:12-13`), or `@Roles('super_admin', 'supervisor', 'agent')` at method level (e.g., `analytics.controller.ts:21`).

---

## Permission System — Two-Layer Model

### Layer 1: DeptPermissions (Department Defaults)

**Model:** `backend/prisma/schema.prisma:12-30`

Each department has a `defaultPermissionsId` FK referencing `DeptPermissions`. 13 boolean flags:

| Field | Default | Description |
|-------|---------|-------------|
| `canReceiveTickets` | `true` | Department can receive tickets |
| `canSendTickets` | `false` | Department can send tickets to others |
| `canViewAllDeptTickets` | `true` | Can see all dept tickets (not just own) |
| `canAssignTickets` | `true` | Can assign tickets to agents |
| `canChangeStatus` | `true` | Can change ticket status |
| `canTransferTickets` | `true` | Can transfer tickets to other depts |
| `canArchiveTickets` | `false` | Can archive resolved/closed tickets |
| `canExportData` | `false` | Can export ticket data |
| `canViewAnalytics` | `false` | Can view analytics dashboard |
| `canManageTeamNotes` | `true` | Can create/manage team notes |
| `canManageDeptUsers` | `false` | Can manage department users |
| `canViewAuditLogs` | `false` | Can view audit logs |
| `canManageKnowledgeBase` | `false` | Can create/edit/delete KB articles |

### Layer 2: UserPermissionOverride (Per-User Overrides)

**Model:** `backend/prisma/schema.prisma:167-187`

One-to-one relation with `User`. Flags mirror `DeptPermissions` but are all **nullable** (`Boolean?`). A `null` value means "fall through to department defaults." A `true`/`false` value means "override department default."

Resolution order (from `tickets.service.ts:39-56`):
1. If `super_admin`, always `true`
2. Check `UserPermissionOverride` — if flag is non-null, use its value
3. Check `DeptPermissions` — if flag is non-null, use its value
4. Fallback: `canArchiveTickets` defaults to `userRole === 'supervisor'`; all others default to `true`

### Layer 3: Role → Permission (Many-to-Many)

**Models:** `backend/prisma/schema.prisma:145-165`

- `Role` model (`schema.prisma:145-155`) has a `permissions` relation to `Permission[]`
- `Permission` model (`schema.prisma:157-165`) has a `roles` relation to `Role[]`
- This is a **many-to-many** relationship managed via a join table generated by Prisma
- **NOTE:** This layer exists in the schema but its enforcement in service code is NOT CONFIRMED — service methods check `userRole` string directly and permission overrides, but do not query `Role.permissions` at runtime. Gap: the Role↔Permission many-to-many may serve as an admin-managed reference model rather than an enforcement layer.

---

## Permission Cache

**File:** `backend/src/core/permissionCache.ts`

An in-memory `Map<string, PermissionEntry>` keyed by `userId:deptId` (`permissionCache.ts:12-13`).

- **TTL:** 30 seconds (`permissionCache.ts:10: TTL_MS = 30_000`)
- **Cached fields:** Only 4 flags: `canChangeStatus`, `canAssignTickets`, `canTransferTickets`, `canArchiveTickets` (`permissionCache.ts:2-6`)
- **Functions:**
  - `getCachedPermissions()` — returns entry if not expired (`permissionCache.ts:16-24`)
  - `setCachedPermissions()` — stores with expiration (`permissionCache.ts:26-32`)
  - `invalidatePermissionCache()` — deletes single key or clears entire cache (`permissionCache.ts:34-39`)
- **Usage:** Called from `tickets.service.ts:6` (import) and `tickets.service.ts:31-36` (check) / `tickets.service.ts:44-50` (set). Only used when NOT inside a database transaction.

---

## Frontend Role Gating

### Sidebar Filtering

**File:** `frontend/src/App.tsx:155-167`

Each sidebar item has a `roles[]` array. Line 167 filters:
```ts
const sidebarItems = allSidebarItems.filter(item => item.roles.includes(user.role));
```

| Sidebar Item | Path | Roles |
|---|---|---|
| Dashboard | `/dashboard` | all 4 |
| New Ticket | `/tickets/new` | all 4 |
| Inbox | `/inbox` | super_admin, supervisor, agent |
| My Tickets | `/my-tickets` | all 4 |
| Transferred | `/transferred` | super_admin, supervisor, agent |
| Archive | `/archive` | super_admin, supervisor, agent |
| Analytics | `/analytics` | super_admin, supervisor, agent |
| Team Feed | `/team-feed` | super_admin, supervisor, agent |
| Knowledge Base | `/knowledge` | all 4 |
| Profile | `/profile` | all 4 |

### Admin Section

**File:** `frontend/src/App.tsx:169-178` — items defined. `frontend/src/App.tsx:247-267` — conditional render gated by `user.role === 'super_admin'`.

| Admin Item | Path |
|---|---|
| Buildings | `/admin/buildings` |
| Floors | `/admin/floors` |
| Departments | `/admin/departments` |
| Ticket Types | `/admin/ticket-types` |
| Users | `/admin/users` |
| Roles | `/admin/roles` |
| Assets | `/admin/assets` |
| Audit Logs | `/admin/audit` |

### Admin Path Hard Block

**File:** `frontend/src/App.tsx:181-183`

```ts
const adminPaths = ['/admin/buildings', ...];
if (adminPaths.includes(cleanPath) && user.role !== 'super_admin') return <DashboardPage />;
```

Non-super-admin users are redirected to the dashboard if they navigate directly to an admin path.

---

## Protected API Endpoints — Role Requirements

### Auth (Unprotected)

| Method | Endpoint | Roles | Source |
|--------|----------|-------|--------|
| POST | `/api/auth/login` | Anyone | `auth.controller.ts:12` |
| POST | `/api/auth/refresh` | Anyone | `auth.controller.ts:37` |
| POST | `/api/auth/logout` | Anyone | `auth.controller.ts:48` |
| GET | `/api/health` | Anyone | `health.controller.ts:8` |

### Tickets (JWT only — roles enforced in service)

| Method | Endpoint | Guard | Source |
|--------|----------|-------|--------|
| POST | `/api/tickets` | JWT | `tickets.controller.ts:18` |
| GET | `/api/tickets/my` | JWT | `tickets.controller.ts:28` |
| GET | `/api/tickets/department` | JWT | `tickets.controller.ts:33` |
| GET | `/api/tickets/search` | JWT | `tickets.controller.ts:39` |
| GET | `/api/tickets/archived` | JWT | `tickets.controller.ts:44` |
| GET | `/api/tickets/transferred` | JWT | `tickets.controller.ts:49` |
| GET | `/api/tickets/form-data` | JWT | `tickets.controller.ts:54` |
| GET | `/api/tickets/:id` | JWT | `tickets.controller.ts:59` |
| PUT | `/api/tickets/:id/status` | JWT | `tickets.controller.ts:64` |
| POST | `/api/tickets/bulk-update-status` | JWT | `tickets.controller.ts:70` |
| PUT | `/api/tickets/:id/assign` | JWT | `tickets.controller.ts:75` |
| POST | `/api/tickets/bulk-assign` | JWT | `tickets.controller.ts:80` |
| PUT | `/api/tickets/:id/transfer` | JWT | `tickets.controller.ts:85` |
| POST | `/api/tickets/:id/comments` | JWT | `tickets.controller.ts:90` |
| PUT | `/api/tickets/:id/confirm` | JWT | `tickets.controller.ts:96` |
| PUT | `/api/tickets/:id/due-date` | JWT | `tickets.controller.ts:100` |
| PUT | `/api/tickets/:id/type` | JWT | `tickets.controller.ts:105` |
| POST | `/api/tickets/:id/link` | JWT | `tickets.controller.ts:111` |
| POST | `/api/tickets/:id/unlink` | JWT | `tickets.controller.ts:116` |
| PUT | `/api/tickets/:id/archive` | JWT | `tickets.controller.ts:121` |
| PATCH | `/api/tickets/:id` | JWT | `tickets.controller.ts:126` — super_admin enforced in service |
| POST | `/api/tickets/bulk-archive` | JWT | `tickets.controller.ts:131` |

### Analytics (JWT + Roles Guard)

| Method | Endpoint | Roles | Source |
|--------|----------|-------|--------|
| GET | `/api/analytics/dashboard-summary` | super_admin, supervisor, agent | `analytics.controller.ts:20-22` |
| GET | `/api/analytics/stats` | super_admin, supervisor, agent | `analytics.controller.ts:27-29` |
| GET | `/api/analytics/status-distribution` | super_admin, supervisor, agent | `analytics.controller.ts:34-36` |
| GET | `/api/analytics/priority-distribution` | super_admin, supervisor, agent | `analytics.controller.ts:41-43` |
| GET | `/api/analytics/department-performance` | super_admin, supervisor | `analytics.controller.ts:49-51` |
| GET | `/api/analytics/recent-activity` | super_admin | `analytics.controller.ts:56-58` |
| GET | `/api/analytics/agent-performance` | super_admin, supervisor | `analytics.controller.ts:63-65` |
| GET | `/api/analytics/aht` | super_admin, supervisor, agent | `analytics.controller.ts:70-72` |
| GET | `/api/analytics/exports` | super_admin, supervisor, agent | `analytics.controller.ts:76-79` |
| GET | `/api/analytics/export` | super_admin, supervisor, agent | `analytics.controller.ts:83-85` |

### Audit (JWT + Roles Guard — super_admin only)

| Method | Endpoint | Roles | Source |
|--------|----------|-------|--------|
| GET | `/api/audit` | super_admin | `audit.controller.ts:11-13` |
| GET | `/api/audit/actions` | super_admin | `audit.controller.ts:11-13` (class-level) |

### Users (JWT only)

| Method | Endpoint | Guard | Source |
|--------|----------|-------|--------|
| GET | `/api/users/me` | JWT | `users.controller.ts:18` |
| PUT | `/api/users/profile` | JWT | `users.controller.ts:22` |
| PUT | `/api/users/avatar` | JWT | `users.controller.ts:31` |

### Admin Users (JWT + Roles Guard — super_admin only)

| Method | Endpoint | Roles | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/users` | super_admin | `admin-users.controller.ts:13-14` |
| POST | `/api/admin/users` | super_admin | `admin-users.controller.ts:13-14` |
| PUT | `/api/admin/users/:id` | super_admin | `admin-users.controller.ts:13-14` |
| POST | `/api/admin/users/:id/reset-password` | super_admin | `admin-users.controller.ts:13-14` |
| DELETE | `/api/admin/users/:id` | super_admin | `admin-users.controller.ts:13-14` |

### Admin Departments (JWT + Roles Guard)

| Method | Endpoint | Roles | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/departments` | super_admin, supervisor, agent | `admin-departments.controller.ts:17-18` |
| POST | `/api/admin/departments` | super_admin | `admin-departments.controller.ts:27-28` |
| PUT | `/api/admin/departments/:id` | super_admin | `admin-departments.controller.ts:62-63` |
| DELETE | `/api/admin/departments/:id` | super_admin | `admin-departments.controller.ts:96-97` |

### Admin Roles (JWT + Roles Guard — super_admin only)

| Method | Endpoint | Roles | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/roles` | super_admin | `admin-roles.controller.ts:12-13` (class-level) |
| POST | `/api/admin/roles` | super_admin | `admin-roles.controller.ts:12-13` |
| PUT | `/api/admin/roles/:id` | super_admin | `admin-roles.controller.ts:12-13` |
| DELETE | `/api/admin/roles/:id` | super_admin | `admin-roles.controller.ts:12-13` |
| GET | `/api/admin/permissions` | super_admin | `admin-roles.controller.ts:12-13` |

### Assets (JWT + Roles Guard)

| Method | Endpoint | Roles | Source |
|--------|----------|-------|--------|
| GET | `/api/assets` | super_admin, supervisor | `assets.controller.ts:17-18` |
| POST | `/api/assets` | super_admin, supervisor | `assets.controller.ts:28-29` |
| PUT | `/api/assets/:id` | super_admin, supervisor | `assets.controller.ts:37-38` |
| DELETE | `/api/assets/:id` | super_admin | `assets.controller.ts:43-44` |

### Knowledge Base (JWT — permission enforced in service)

| Method | Endpoint | Guard | Enforced In |
|--------|----------|-------|-------------|
| GET | `/api/knowledge/articles` | JWT | Permission only for write ops |
| GET | `/api/knowledge/categories` | JWT | — |
| GET | `/api/knowledge/search` | JWT | — |
| GET | `/api/knowledge/suggest` | JWT | — |
| POST | `/api/knowledge/articles` | JWT | Service `checkKbPermission` (line 136) |
| PUT | `/api/knowledge/articles/:id` | JWT | Service `checkKbPermission` (line 153) |
| DELETE | `/api/knowledge/articles/:id` | JWT | Service `checkKbPermission` (line 179) |
| POST | `/api/knowledge/articles/:id/view` | JWT | — |
| POST | `/api/knowledge/categories` | JWT | Service `checkKbPermission` (line 198) |
| PUT | `/api/knowledge/categories/:id` | JWT | Service `checkKbPermission` (line 208) |
| DELETE | `/api/knowledge/categories/:id` | JWT | Service `checkKbPermission` (line 227) |

### Notifications (JWT)

| Method | Endpoint | Guard | Source |
|--------|----------|-------|--------|
| GET | `/api/notifications` | JWT | `notifications.controller.ts:9` |
| PUT | `/api/notifications/:id/read` | JWT | `notifications.controller.ts:19` |
| PUT | `/api/notifications/read-all` | JWT | `notifications.controller.ts:24` |
| POST | `/api/notifications/subscribe` | JWT | `notifications.controller.ts:29` |
| DELETE | `/api/notifications/subscribe` | JWT | `notifications.controller.ts:35` |

### Team Notes (JWT — end_user blocked in service)

| Method | Endpoint | Guard | Enforced In |
|--------|----------|-------|-------------|
| GET | `/api/team-notes` | JWT | — |
| POST | `/api/team-notes` | JWT | Service blocks `end_user` (team-notes.service.ts:54) |
| POST | `/api/team-notes/:id/comments` | JWT | Service blocks `end_user` (team-notes.service.ts:79) |
| POST | `/api/team-notes/:id/like` | JWT | Service blocks `end_user` (team-notes.service.ts:95) |
| DELETE | `/api/team-notes/:id` | JWT | Author or super_admin (team-notes.service.ts:136) |

### Profile

| Method | Endpoint | Guard | Source |
|--------|----------|-------|--------|
| GET | `/api/profile/me` | JWT | `profile.controller.ts` |
| PUT | `/api/profile` | JWT | `profile.controller.ts` |

### Uploads

| Method | Endpoint | Guard | Source |
|--------|----------|-------|--------|
| POST | `/api/uploads` | JWT | `uploads.controller.ts` |
| POST | `/api/uploads/voice` | JWT | `uploads.controller.ts` |

---

## Unprotected Routes

| Method | Endpoint | Purpose | Source |
|--------|----------|---------|--------|
| POST | `/api/auth/login` | User login | `auth.controller.ts:12` |
| POST | `/api/auth/refresh` | Refresh access token | `auth.controller.ts:37` |
| POST | `/api/auth/logout` | Clear refresh cookie | `auth.controller.ts:48` |
| GET | `/api/health` | Health check | `health.controller.ts:8` |

---

## Critical Service-Level Enforcement

Beyond guards, these service methods enforce additional logic:

1. **Ticket creation cross-dept block:** Supervisors/agents can only create tickets for their own department (`tickets.service.ts:120-122`)
2. **Status change permission:** `checkTicketPermission()` with permission cache (`tickets.service.ts:23-57`)
3. **Transfer allowlist:** Non-super-admins checked against `DeptTransferAllowlist` (`tickets.service.ts:559-565`)
4. **Assign same-dept agent:** Cannot assign agent from different department (`tickets.service.ts:508-509`)
5. **Resolved ticket modification:** Only super_admin can modify resolved/closed tickets (`tickets.service.ts:415-417`)
6. **Team feed end_user block:** `end_user` role throws `ForbiddenException` in create/comment/like (`team-notes.service.ts:54,79,95`)
7. **Analytics permission:** `canViewAnalytics` checked in service, not via Roles guard (`analytics.service.ts:22-33`)
8. **Export permission:** `canExportData` checked in service with role defaults (`analytics.service.ts:280-297`)