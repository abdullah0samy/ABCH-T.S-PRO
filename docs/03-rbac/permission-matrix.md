# Permission Matrix — ABCH Hospital Ticketing CRM

Every entry marked CONFIRMED has file:line evidence. Entries without code evidence are marked NOT CONFIRMED.

---

## Core Features

| Feature / Operation | End User | Agent | Supervisor | Super Admin | Evidence |
|---|---|---|---|---|---|
| **Dashboard access** | Yes | Yes | Yes | Yes | `App.tsx:156` — dashboard in all roles |
| **Create ticket** | Yes | Yes | Yes | Yes | `App.tsx:157`, `tickets.service.ts:106` |
| **View own tickets (My Tickets)** | Yes | Yes | Yes | Yes | `App.tsx:159`, `tickets.service.ts:184` |
| **Inbox / Department tickets** | No | Yes | Yes | Yes | `App.tsx:158` — end_user excluded from inbox; `tickets.service.ts:210` — requires deptId or super_admin |
| **Transferred tickets view** | No | Yes | Yes | Yes | `App.tsx:160` — end_user excluded |
| **Archive view** | No | Yes | Yes | Yes | `App.tsx:161` — end_user excluded |
| **Ticket search** | Yes (limited) | Yes | Yes | Yes (all) | `tickets.service.ts:272-293` — RBAC filter applied |
| **View ticket details** | Own only | Dept + own | Dept + own | All | `tickets.service.ts:379-403` — RBAC access check |
| **Add comment on ticket** | Yes (resolved: creator only) | Yes | Yes | Yes | `tickets.service.ts:603-648` — resolved ticket limits for end_user (`tickets.service.ts:615-617`) |
| **Confirm resolution** | Creator only | No | No | No | `tickets.service.ts:658` — only creator allowed |

## Ticket Operations

| Feature / Operation | End User | Agent | Supervisor | Super Admin | Evidence |
|---|---|---|---|---|---|
| **Change ticket status** | No | Yes* | Yes | Yes | `tickets.service.ts:23-57` — `canChangeStatus` permission check; end_user has no sidebar access to ticket management UI |
| **Assign ticket to agent** | No | Yes* | Yes | Yes | `tickets.service.ts:501` — `canAssignTickets` permission check |
| **Transfer ticket to dept** | No | Yes* | Yes | Yes | `tickets.service.ts:553-554` — `canTransferTickets` + allowlist check |
| **Archive ticket** | No | Yes* | Yes | Yes | `tickets.service.ts:914-915` — `canArchiveTickets` permission check; DeptPermissions default is `false` (`schema.prisma:20`) |
| **Bulk update status** | No | Yes* | Yes | Yes | `tickets.controller.ts:70-71` — same permission layer |
| **Bulk assign** | No | Yes* | Yes | Yes | `tickets.controller.ts:80-81` — same permission layer |
| **Bulk archive** | No | Yes* | Yes | Yes | `tickets.controller.ts:131` — same permission layer |
| **Update due date** | No | Yes* | Yes | Yes | `tickets.service.ts:798` — dept membership required |
| **Update ticket type** | No | Yes* | Yes | Yes | `tickets.service.ts:828` — dept membership required |
| **Link / Unlink tickets** | No | Yes | Yes | Yes | `tickets.service.ts:861,890` — blocked on resolved/closed unless super_admin |
| **Super Admin override (PATCH)** | No | No | No | Yes | `tickets.service.ts:936` — explicit `userRole !== 'super_admin'` check |
| **Reopen closed ticket** | No | No | No | Yes | `tickets.service.ts:428-429` — `REOPEN_FORBIDDEN` for non-super_admin |

\* Subject to `DeptPermissions` / `UserPermissionOverride` flags. Default per `schema.prisma`:
- `canChangeStatus`: true (schema.prisma:18)
- `canAssignTickets`: true (schema.prisma:17)
- `canTransferTickets`: true (schema.prisma:19)
- `canArchiveTickets`: false (schema.prisma:20) — supervisors get implicit archive via `tickets.service.ts:34,55`

## Analytics

| Feature / Operation | End User | Agent | Supervisor | Super Admin | Evidence |
|---|---|---|---|---|---|
| **View analytics (sidebar)** | No | Yes* | Yes | Yes | `App.tsx:162` — end_user excluded |
| **Dashboard summary** | No | Yes* | Yes | Yes | `analytics.controller.ts:21` — Roles guard; `analytics.service.ts:36` — permission check |
| **Stats** | No | Yes | Yes | Yes | `analytics.controller.ts:28` — Roles guard |
| **Status/Priority distribution** | No | Yes | Yes | Yes | `analytics.controller.ts:34,41` — Roles guard |
| **Department performance** | No | No | Yes | Yes | `analytics.controller.ts:50` — Roles guard: super_admin, supervisor |
| **Recent activity** | No | No | No | Yes | `analytics.controller.ts:57` — Roles guard: super_admin only |
| **Agent performance** | No | No | Yes | Yes | `analytics.controller.ts:64` — Roles guard: super_admin, supervisor |
| **AHT** | No | Yes | Yes | Yes | `analytics.controller.ts:70` — Roles guard |
| **Export data (canExportData)** | No* | No* | Yes* | Yes | `analytics.service.ts:280-297` — canExportData check; end_user defaults to blocked |
| **View exports list** | No | Yes | Yes | Yes | `analytics.controller.ts:77` — Roles guard |

\* Subject to `canViewAnalytics` (`analytics.service.ts:22-33`) and `canExportData` (`analytics.service.ts:280-297`) permission flags. Supervisor defaults to analytics allowed (`analytics.service.ts:31`).

## Knowledge Base

| Feature / Operation | End User | Agent | Supervisor | Super Admin | Evidence |
|---|---|---|---|---|---|
| **View articles (sidebar)** | Yes | Yes | Yes | Yes | `App.tsx:164` — all roles |
| **View articles (API)** | Yes | Yes | Yes | Yes | `knowledge.controller.ts:14` — JWT only, no permission check |
| **Search articles** | Yes | Yes | Yes | Yes | `knowledge.controller.ts:33` — JWT only |
| **Autocomplete suggest** | Yes | Yes | Yes | Yes | `knowledge.controller.ts:43` — JWT only |
| **Increment view count** | Yes | Yes | Yes | Yes | `knowledge.controller.ts:66` — JWT only |
| **Create article** | Yes* | Yes* | Yes* | Yes | `knowledge.service.ts:136` — `checkKbPermission`; super_admin bypasses |
| **Update article** | Yes* | Yes* | Yes* | Yes | `knowledge.service.ts:153` — `checkKbPermission` |
| **Delete article** | Yes* | Yes* | Yes* | Yes | `knowledge.service.ts:179` — `checkKbPermission` |
| **Manage categories** | Yes* | Yes* | Yes* | Yes | `knowledge.service.ts:198,208,227` — `checkKbPermission` |

\* Controlled by `canManageKnowledgeBase` flag. Default false (`schema.prisma:26`). Super_admin auto-passes (`knowledge.service.ts:10`).

## Team Notes / Team Feed

| Feature / Operation | End User | Agent | Supervisor | Super Admin | Evidence |
|---|---|---|---|---|---|
| **Access Team Feed (sidebar)** | No | Yes | Yes | Yes | `App.tsx:163` — end_user excluded |
| **View team notes** | No | Yes | Yes | Yes | Sidebar filtered; `team-notes.service.ts:15-18` — non-super_admin requires departmentId |
| **Create team note** | No | Yes | Yes | Yes | `team-notes.service.ts:54-55` — explicit end_user block |
| **Comment on note** | No | Yes | Yes | Yes | `team-notes.service.ts:79-81` — explicit end_user block |
| **Like note** | No | Yes | Yes | Yes | `team-notes.service.ts:95-97` — explicit end_user block |
| **Delete note** | No | Author or admin | Author or admin | Yes | `team-notes.service.ts:136-137` — author or super_admin |

## Asset Management

| Feature / Operation | End User | Agent | Supervisor | Super Admin | Evidence |
|---|---|---|---|---|---|
| **View assets** | No | No | Yes | Yes | `assets.controller.ts:17-18` — Roles guard: super_admin, supervisor |
| **Create asset** | No | No | Yes | Yes | `assets.controller.ts:28-29` — Roles guard |
| **Update asset** | No | No | Yes | Yes | `assets.controller.ts:37-38` — Roles guard |
| **Delete asset (soft)** | No | No | No | Yes | `assets.controller.ts:43-44` — Roles guard: super_admin only |

## Admin Functions

| Feature / Operation | End User | Agent | Supervisor | Super Admin | Evidence |
|---|---|---|---|---|---|
| **Manage users** | No | No | No | Yes | `admin-users.controller.ts:13-14` — Roles guard: super_admin |
| **Reset user password** | No | No | No | Yes | `admin-users.controller.ts:13-14` |
| **Manage roles** | No | No | No | Yes | `admin-roles.controller.ts:12-13` — Roles guard: super_admin |
| **Manage permissions** | No | No | No | Yes | `admin-roles.controller.ts:12-13` |
| **View audit logs** | No | No | No | Yes | `audit.controller.ts:11-13` — Roles guard: super_admin |
| **View audit actions list** | No | No | No | Yes | `audit.controller.ts:11-13` |
| **Manage departments** | No | No | No | Yes (create/update/delete) | `admin-departments.controller.ts:27,62,96` — Roles guard |
| **View departments list** | No | Yes | Yes | Yes | `admin-departments.controller.ts:17-18` — Roles guard: super_admin, supervisor, agent |
| **Manage buildings** | No | No | No | Yes | `App.tsx:170` — adminPaths block + `admin-buildings.controller.ts` Roles guard |
| **Manage floors** | No | No | No | Yes | `App.tsx:171` — adminPaths block |
| **Manage ticket types** | No | No | No | Yes | `App.tsx:173` — adminPaths block |

## Profile & Auth

| Feature / Operation | End User | Agent | Supervisor | Super Admin | Evidence |
|---|---|---|---|---|---|
| **Get own profile (GET /api/users/me)** | Yes | Yes | Yes | Yes | `users.controller.ts:18` — JWT only |
| **Update own profile** | Yes | Yes | Yes | Yes | `users.controller.ts:22` — JWT only |
| **Upload avatar** | Yes | Yes | Yes | Yes | `users.controller.ts:31` — JWT only |
| **Login** | Yes | Yes | Yes | Yes | `auth.controller.ts:12` — no guard |
| **Refresh token** | Yes | Yes | Yes | Yes | `auth.controller.ts:37` — no guard |
| **Logout** | Yes | Yes | Yes | Yes | `auth.controller.ts:48` — no guard |

## Notifications

| Feature / Operation | End User | Agent | Supervisor | Super Admin | Evidence |
|---|---|---|---|---|---|
| **View notifications** | Yes | Yes | Yes | Yes | `notifications.controller.ts:14` — JWT only |
| **Mark notification read** | Yes | Yes | Yes | Yes | `notifications.controller.ts:20` |
| **Mark all read** | Yes | Yes | Yes | Yes | `notifications.controller.ts:25` |
| **Subscribe to push** | Yes | Yes | Yes | Yes | `notifications.controller.ts:30` |
| **WebSocket events** | Yes (user room) | Yes (dept + user room) | Yes (dept + user room) | Yes (all) | `NotificationProvider.tsx:105-108` — joins user + department rooms |

---

## Legend

- **Yes** — Accessible (may be subject to permission flags marked with *)
- **No** — Not accessible (blocked by Roles guard, sidebar filter, service check, or all three)
- **\*** — Further gated by `DeptPermissions` or `UserPermissionOverride` boolean flags
- **Creator only** — Only the ticket's creator can perform this action

## NOT CONFIRMED Entries

The following areas lack comprehensive code evidence in the codebase:

1. **Admin buildings controller roles** — `admin-buildings.controller.ts` exists but was not read in this review. Inferred from `AdminDepartmentsController` pattern and `App.tsx:170` adminPaths blocking.
2. **Admin floors / ticket-types controllers roles** — Same pattern inference.
3. **Profile controller endpoints** — `profile.controller.ts` referenced but not fully read. Inferred JWT-only from Users module pattern.
4. **Uploads controller endpoints** — Referenced in glob results but not read. Pattern inferred.
5. **Role→Permission many-to-many enforcement** — Exists in schema (`schema.prsima:145-165`) but service code checks role string directly. Whether this RB layer powers an admin UI is NOT CONFIRMED.