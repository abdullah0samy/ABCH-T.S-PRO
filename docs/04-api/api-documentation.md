# API Documentation — ABCH Hospital Ticketing CRM

**Base URL:** `/api` (all routes prefixed with `/api`)
**Auth:** JWT Bearer token via `Authorization: Bearer <token>` header (unless noted public)
**Generated:** 2024-07-17 from `backend/src/modules/**/*.ts`

---

## Throttling Tiers

| Tier | TTL | Limit | Applied To |
|---|---|---|---|
| `global` | 15 min | 2000 req | All endpoints (default) |
| `login` | 15 min | 50 req | `POST /auth/login` |
| `auth` | 15 min | 100 req | Login refresh/logout, ticket create |
| `search` | 1 min | 60 req | Ticket & knowledge search |
| `analytics` | 15 min | 300 req | All analytics endpoints |
| `upload` | 1 hour | 100 req | File upload |

Source: [`app.module.ts:30-36`](backend/src/app.module.ts:30-36)

---

## 1. Health (1 endpoint)

### GET `/api/health`
| Field | Value |
|---|---|
| **Auth** | Public |
| **Role** | None |
| **Throttle** | `global` (default) |
| **Validation** | None |
| **Service** | `health.controller.ts:8` (inline, calls `prisma.$queryRaw`) |
| **Response (200)** | `{ status: 'ok', service: string, version: string, timestamp: string, uptime: number, database: 'connected', memory: { used: number, total: number, unit: 'MB' }, responseTime: string }` |
| **Response (error)** | `{ status: 'error', message: 'Database connection failed', timestamp: string }` |
| **Socket.IO** | None |

---

## 2. Auth (3 endpoints)

Controller: [`auth.controller.ts`](backend/src/modules/auth/auth.controller.ts)
Service: [`auth.service.ts`](backend/src/modules/auth/auth.service.ts)

### POST `/api/auth/login`
| Field | Value |
|---|---|
| **Auth** | Public |
| **Role** | None |
| **Throttle** | `login` (50 req / 15 min) |
| **Body** | `{ identifier: string, password: string }` — `identifier` matches `badgeNumber` or `username`; format `^[a-zA-Z0-9_.-]+$` (see `auth.service.ts:21`) |
| **Service** | `auth.service.ts:12 login()` |
| **Response (200)** | `{ accessToken: string, refreshToken: string, user: { id, badgeNumber, username, fullNameAr, fullNameEn, role, department } }` + `refreshToken` set as httpOnly cookie (7d) |
| **Errors** | `400` — missing fields / invalid format; `401` — invalid credentials; `423` (`423`) — account locked (5 failed attempts → 15 min lock, `auth.service.ts:40-59`) |
| **Socket.IO** | None |

### POST `/api/auth/refresh`
| Field | Value |
|---|---|
| **Auth** | Public (uses refresh token) |
| **Role** | None |
| **Throttle** | `auth` (100 req / 15 min) |
| **Body** | `{ refreshToken?: string }` — also reads from `cookies.refreshToken` |
| **Service** | `auth.service.ts:95 refresh()` |
| **Response (200)** | `{ accessToken: string }` |
| **Errors** | `401` — missing refresh token / inactive account; `403` — invalid/expired refresh token |
| **Socket.IO** | None |

### POST `/api/auth/logout`
| Field | Value |
|---|---|
| **Auth** | Public |
| **Role** | None |
| **Throttle** | `auth` (100 req / 15 min) |
| **Validation** | None |
| **Service** | `auth.service.ts:123 logout()` |
| **Response (200)** | `{ message: 'Logged out successfully' }` — clears `refreshToken` cookie |
| **Errors** | None |
| **Socket.IO** | None |

---

## 3. Users (3 endpoints)

Controller: [`users.controller.ts`](backend/src/modules/users/users.controller.ts)
Service: [`users.service.ts`](backend/src/modules/users/users.service.ts)

### GET `/api/users/me`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any authenticated user |
| **Throttle** | `global` |
| **Validation** | None |
| **Service** | `users.service.ts:8 getMe()` |
| **Response (200)** | `{ id, badgeNumber, username, fullNameAr, fullNameEn, role, department (incl. defaultPermissions), langPref, avatarUrl }` |
| **Errors** | `404` — user not found |
| **Socket.IO** | None |

### PUT `/api/users/profile`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any authenticated user (own profile only) |
| **Throttle** | `global` |
| **Body** | `{ fullNameAr?: string, fullNameEn?: string, email?: string, langPref?: string }` |
| **Validation** | `fullNameAr` required (`users.service.ts:39`); email validated via regex (`users.service.ts:42-44`) |
| **Service** | `users.service.ts:36 updateProfile()` |
| **Response (200)** | Full user object (excluding `passwordHash`) |
| **Errors** | `400` — missing fullNameAr / invalid email |
| **Socket.IO** | None |

### PUT `/api/users/avatar`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any authenticated user |
| **Throttle** | `global` |
| **Body** | `multipart/form-data` — `avatar` field; JPEG/PNG only; max 5 MB; resized to 200×200 |
| **Service** | `users.service.ts:67 updateAvatar()` |
| **Response (200)** | `{ message: 'Avatar updated successfully', avatarUrl: string }` |
| **Errors** | `400` — no file / invalid type |
| **Socket.IO** | None |

---

## 4. Tickets (22 endpoints)

Controller: [`tickets.controller.ts`](backend/src/modules/tickets/tickets.controller.ts)
Service: [`tickets.service.ts`](backend/src/modules/tickets/tickets.service.ts)
Schema: [`tickets.schema.ts`](backend/src/common/schemas/tickets.schema.ts)
Constants: [`workflow.constants.ts`](backend/src/modules/tickets/workflow.constants.ts)

### POST `/api/tickets`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any authenticated user |
| **Throttle** | `auth` (100 req / 15 min) |
| **Validation** | Zod `createTicketSchema` (`tickets.schema.ts:3`): `description` min 5 chars (required); `departmentId` required; `subject` min 3 max 200; `priority` enum `[low,normal,high,critical]` |
| **Extra validation** | Building-floor mismatch check (`tickets.service.ts:125`); supervisor/agent restricted to own dept (`tickets.service.ts:119-122`) |
| **Service** | `tickets.service.ts:106 create()` |
| **Response (201)** | Full ticket object with `ticketNumber` (format `TKT-YYMMDD-NNN`), `status: 'pending'`, `slaDeadline` |
| **Errors** | `400` — validation / floor-building mismatch; `403` `CROSS_DEPT_FORBIDDEN`; `404` — dept not found |
| **Socket.IO** | `new-ticket` → `dept-{departmentId}` (`tickets.service.ts:179`) |

### GET `/api/tickets/my`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any (returns tickets created by the user; `isArchived: false`) |
| **Throttle** | `global` |
| **Query** | `page`, `limit` (max 100), `status`, `search` |
| **Service** | `tickets.service.ts:184 findMy()` |
| **Response (200)** | `{ tickets: Ticket[], pagination: { total, page, limit, pages } }` (incl. `department`, `ticketType`, `assignedTo` selects) |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/tickets/department`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | super_admin (all depts), supervisor/agent (own dept), end_user (must have dept, `canViewAllDeptTickets` check) |
| **Throttle** | `global` |
| **Query** | `page`, `limit` (max 100), `status`, `priority`, `ticketTypeId`, `creatorName`, `agentId`, `startDate`, `endDate`, `search` |
| **Service** | `tickets.service.ts:209 findDepartment()` |
| **Response (200)** | `{ tickets: Ticket[], pagination }` (incl. `createdBy`, `ticketType`, `assignedTo` selects) |
| **Errors** | `403` — user not assigned to any department |
| **Socket.IO** | None |

### GET `/api/tickets/search`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any (super_admin: global; others: own dept + created) |
| **Throttle** | `search` (60 req / 1 min) |
| **Query** | `q`, `page`, `limit` |
| **Service** | `tickets.service.ts:272 search()` |
| **Response (200)** | `{ tickets, pagination }` (includes `department`, `ticketType`, `createdBy`, `assignedTo`) |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/tickets/archived`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | super_admin (all), others (own dept) |
| **Throttle** | `global` |
| **Query** | `page`, `limit` (max 100), `search` |
| **Service** | `tickets.service.ts:296 findArchived()` |
| **Response (200)** | `{ tickets, pagination }` (ordered by `archivedAt desc`) |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/tickets/transferred`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | super_admin (all), others (own dept — inbound/outbound) |
| **Throttle** | `global` |
| **Query** | `page`, `limit` (max 100), `search` |
| **Service** | `tickets.service.ts:322 findTransferred()` |
| **Response (200)** | `{ tickets (with `direction: 'inbound' | 'outbound'`), pagination }` (last transfer: incl. `fromDepartment`, `toDepartment`, `transferredBy`) |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/tickets/form-data`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any authenticated user |
| **Throttle** | `global` |
| **Validation** | None |
| **Service** | `tickets.service.ts:79 getFormData()` |
| **Response (200)** | `{ departments: [{id,nameAr,nameEn,deptType}], buildings: [{id,nameAr,nameEn}], floors: [{id,nameAr,nameEn,buildingId}], ticketTypes: [{id,nameAr,nameEn,departmentId,color}] }` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/tickets/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Ticket creator, assignee, dept member (subject to `canViewAllDeptTickets`), or super_admin |
| **Throttle** | `global` |
| **Validation** | `id` must be valid integer |
| **Service** | `tickets.service.ts:361 findById()` (lines 361-406) |
| **Response (200)** | Full ticket with `department`, `ticketType`, `createdBy`, `assignedTo`, `attachments`, `asset`, `messages` (ordered asc, with `sender`, `attachments`), `auditLogs` (last 20, desc), `transfers` (with `fromDepartment`, `toDepartment`, `transferredBy`) |
| **Errors** | `400` — invalid ID; `403` — access denied; `404` — not found |
| **Socket.IO** | None (server emits `join-ticket` / `leave-ticket` client events at `ticket.gateway.ts:76-88`) |

### PUT `/api/tickets/:id/status`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Dept member with `canChangeStatus` or super_admin. Closed/resolved: super_admin only (`tickets.service.ts:415-417`) |
| **Throttle** | `global` |
| **Body** | `{ status: string, comment?: string, ticketTypeId?: string, requiresExternalResource?: boolean, externalResourceCost?: number, externalResourceNote?: string }` |
| **Validation** | Status must follow `ALLOWED_TRANSITIONS` (`workflow.constants.ts:7-18`). `resolved` requires assignee. `resolved`/`closed` requires `ticketTypeId`. |
| **Service** | `tickets.service.ts:409 updateStatus()` |
| **Response (200)** | Updated ticket object |
| **Errors** | `400` — invalid transition (`INVALID_TRANSITION`), missing assignee (`ASSIGNMENT_REQUIRED`), missing type (`ISSUE_TYPE_REQUIRED`); `403` — insufficient permissions; `404` — not found |
| **Socket.IO** | `ticket-status-updated` → user `createdById`, `dept-{departmentId}`, `ticket-{id}` (`tickets.service.ts:483-485`) |

### POST `/api/tickets/bulk-update-status`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Same as single status update per ticket |
| **Throttle** | `global` |
| **Body** | `{ ticketIds: number[], status: string, comment?: string }` |
| **Service** | `tickets.service.ts:692 bulkUpdateStatus()` |
| **Response (200)** | `{ message: string, count: number }` |
| **Errors** | `400` — no tickets selected |
| **Socket.IO** | `ticket-status-updated` → each ticket's `ticket-{id}` + creator |

### PUT `/api/tickets/:id/assign`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Dept member with `canAssignTickets` or super_admin |
| **Throttle** | `global` |
| **Body** | `{ agentId?: string }` (pass `null` to unassign) |
| **Validation** | Agent must exist, be active, and belong to same dept (or super_admin) |
| **Service** | `tickets.service.ts:491 assign()` |
| **Response (200)** | Updated ticket — auto-transitions `pending → in_progress` on assign |
| **Errors** | `400` — inactive agent / cross-dept; `403` — insufficient permissions; `404` — ticket/agent not found |
| **Socket.IO** | `ticket-assigned` → `user-{agentId}`, `ticket-{id}` (`tickets.service.ts:534-536`) |

### POST `/api/tickets/bulk-assign`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Same per-ticket permissions |
| **Throttle** | `global` |
| **Body** | `{ ticketIds: number[], agentId?: string }` |
| **Service** | `tickets.service.ts:738 bulkAssign()` |
| **Response (200)** | `{ message: string, count: number }` |
| **Errors** | `400` — no tickets / cross-dept agent |
| **Socket.IO** | `ticket-assigned` → each ticket + creator |

### PUT `/api/tickets/:id/transfer`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Dept member with `canTransferTickets` or super_admin |
| **Throttle** | `global` |
| **Body** | `{ targetDeptId: string, reason?: string }` |
| **Validation** | Transfer must exist in `DeptTransferAllowlist` (or super_admin bypass) |
| **Service** | `tickets.service.ts:542 transfer()` |
| **Response (200)** | Updated ticket (auto-resets `assignedToId`, `status: 'pending'`, recalculates SLA) |
| **Errors** | `400` — missing target; `403` `TRANSFER_NOT_ALLOWED` — not on allowlist; `404` — dept not found |
| **Socket.IO** | `new-ticket` → destination dept; `ticket-transferred` → source dept (`tickets.service.ts:597-598`) |

### POST `/api/tickets/:id/comments`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Creator, dept member. Closed: super_admin only. Resolved: creator + team only. |
| **Throttle** | `global` |
| **Body** | `{ content?: string, isInternal?: boolean, attachments?: Array<{ fileName, fileUrl, fileSize, mimeType, isVoiceNote?, voiceDuration? }> }` |
| **Validation** | At least `content` or `attachments` required |
| **Service** | `tickets.service.ts:603 addComment()` |
| **Response (201)** | `TicketMessage` object with `sender`, `attachments` |
| **Errors** | `400` — no content or attachments; `403` — closed/resolved restrictions |
| **Socket.IO** | `new-comment` → dept, creator (if not sender), assignee (if not sender) (`tickets.service.ts:642-645`) |

### PUT `/api/tickets/:id/confirm`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Ticket creator only |
| **Throttle** | `global` |
| **Body** | `{ rating?: number, feedback?: string }` |
| **Validation** | Ticket must be `resolved` |
| **Service** | `tickets.service.ts:651 confirmResolution()` |
| **Response (200)** | Updated ticket — transitions to `closed` with `closedAt`, `rating`, `feedback` |
| **Errors** | `400` — ticket not resolved; `403` — not creator |
| **Socket.IO** | `ticket-closed` → `dept-{departmentId}` (`tickets.service.ts:687`) |

### PUT `/api/tickets/:id/due-date`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Dept member or super_admin |
| **Throttle** | `global` |
| **Body** | `{ dueDate?: string }` (ISO date string or null to clear) |
| **Validation** | Closed/resolved: super_admin only |
| **Service** | `tickets.service.ts:787 updateDueDate()` |
| **Response (200)** | Updated ticket |
| **Errors** | `400` — closed/resolved for non-admin; `403` — cross-dept; `404` |
| **Socket.IO** | None |

### PUT `/api/tickets/:id/type`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Dept member or super_admin |
| **Throttle** | `global` |
| **Body** | `{ ticketTypeId?: string }` |
| **Service** | `tickets.service.ts:817 updateTicketType()` |
| **Response (200)** | Updated ticket (incl. recalculated `slaDeadline`, `ticketType` relation) |
| **Errors** | `403` — cross-dept |
| **Socket.IO** | None |

### POST `/api/tickets/:id/link`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Same as status update |
| **Throttle** | `global` |
| **Body** | `{ targetTicketId: string }` |
| **Service** | `tickets.service.ts:854 linkTickets()` |
| **Response (200)** | `{ message: 'Tickets linked successfully' }` |
| **Errors** | `403` — locked tickets; `404` — ticket not found |
| **Socket.IO** | None |

### POST `/api/tickets/:id/unlink`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Same as status update |
| **Throttle** | `global` |
| **Body** | `{ targetTicketId: string }` |
| **Service** | `tickets.service.ts:882 unlinkTickets()` |
| **Response (200)** | `{ message: 'Tickets unlinked successfully' }` |
| **Errors** | Same as link |
| **Socket.IO** | None |

### PUT `/api/tickets/:id/archive`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Dept member with `canArchiveTickets` or super_admin |
| **Throttle** | `global` |
| **Validation** | Ticket must be `resolved` or `closed` |
| **Service** | `tickets.service.ts:910 archiveTicket()` |
| **Response (200)** | Updated ticket with `isArchived: true`, `archivedAt`, `archivedById` |
| **Errors** | `400` — not resolved/closed; `403` — permission denied |
| **Socket.IO** | None |

### PATCH `/api/tickets/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | **super_admin ONLY** |
| **Throttle** | `global` |
| **Body** | Any updatable ticket fields (excludes `ticketNumber`, `id`, `createdAt`) |
| **Service** | `tickets.service.ts:935 superAdminOverride()` |
| **Response (200)** | Updated ticket (recalculates SLA if priority/type/dept changed) |
| **Errors** | `403` — non-admin; `404` — not found |
| **Socket.IO** | None |

### POST `/api/tickets/bulk-archive`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Same as single archive per ticket |
| **Throttle** | `global` |
| **Body** | `{ ticketIds: number[] }` |
| **Service** | `tickets.service.ts:975 bulkArchive()` |
| **Response (200)** | `{ message: string, successfulIds: number[], failedIds: number[] }` |
| **Errors** | `400` — empty array |
| **Socket.IO** | None |

---

## 5. Admin — Users (5 endpoints)

Controller: [`admin-users.controller.ts`](backend/src/modules/admin/controllers/admin-users.controller.ts)

### GET `/api/admin/users`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Query** | `page` (default 1), `limit` (1-100, default 20) |
| **Service** | `admin-users.controller.ts:18` (inline Prisma) |
| **Response (200)** | `{ data: User[] (incl. department, userRole, permissionsOverride), pagination: { total, page, limit, pages } }` |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/admin/users`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ badgeNumber: string, username: string, password: string, fullNameAr: string, fullNameEn?: string, email?: string, role: string, roleId?: number, departmentId?: number, isActive?: boolean, permissionsOverride?: object }` |
| **Validation** | `badgeNumber` and `username` must be numeric only (`admin-users.controller.ts:49`). Required: `badgeNumber`, `username`, `password`, `fullNameAr`, `role`. |
| **Service** | `admin-users.controller.ts:41` (inline Prisma + bcrypt hash 12 rounds) |
| **Response (201)** | Created user (excluding `passwordHash`). Writes `USER_CREATED` audit log. |
| **Errors** | `400` — missing fields / non-numeric; `409` — duplicate badge or username |
| **Socket.IO** | None |

### PUT `/api/admin/users/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ badgeNumber?, username?, email?, fullNameAr?, fullNameEn?, role?, roleId?, departmentId?, isActive?, forcePasswordChange?, permissionsOverride? }` |
| **Validation** | Numeric-only check if `badgeNumber`/`username` provided. `permissionsOverride` uses upsert. |
| **Service** | `admin-users.controller.ts:96` (inline Prisma). Writes `USER_UPDATED` audit log. |
| **Response (200)** | Updated user (excl. `passwordHash`) |
| **Errors** | `400` — non-numeric badge/username |
| **Socket.IO** | None |

### POST `/api/admin/users/:id/reset-password`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ password: string, forcePasswordChange?: boolean }` (defaults true) |
| **Service** | `admin-users.controller.ts:140` (inline Prisma + bcrypt 12). Writes `PASSWORD_RESET` audit log. |
| **Response (200)** | `{ message: 'Password reset successfully' }` |
| **Errors** | `400` — missing password |
| **Socket.IO** | None |

### DELETE `/api/admin/users/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Service** | `admin-users.controller.ts:170` (soft-deletes: sets `isActive: false`, `deletedAt: now`). Writes `USER_DEACTIVATED` audit log. |
| **Response (200)** | `{ message: 'User deactivated' }` |
| **Errors** | None |
| **Socket.IO** | None |

---

## 6. Admin — Departments (4 endpoints)

Controller: [`admin-departments.controller.ts`](backend/src/modules/admin/controllers/admin-departments.controller.ts)

### GET `/api/admin/departments`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` |
| **Throttle** | `global` |
| **Service** | `admin-departments.controller.ts:18` (incl. `defaultPermissions`, `_count.users`) |
| **Response (200)** | `Department[]` ordered by `nameEn asc` |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/admin/departments`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ nameAr: string, nameEn: string, descriptionAr?: string, descriptionEn?: string, deptType?: string ('RECEIVER_ONLY' default), isActive?: boolean, slaHours?: number (default 24) }` |
| **Service** | `admin-departments.controller.ts:26` (creates dept + auto-creates `DeptPermissions`). Writes `DEPT_CREATED` audit log. |
| **Response (201)** | Created department |
| **Errors** | `400` — missing names |
| **Socket.IO** | None |

### PUT `/api/admin/departments/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | All department fields (partial update) |
| **Service** | `admin-departments.controller.ts:62`. Writes `DEPT_UPDATED` audit log. |
| **Response (200)** | Updated department |
| **Errors** | None |
| **Socket.IO** | None |

### DELETE `/api/admin/departments/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Service** | `admin-departments.controller.ts:98` (soft-delete: `isActive: false`, `deletedAt: now`). Writes `DEPT_DEACTIVATED` audit log. |
| **Response (200)** | `{ message: 'Department deactivated' }` |
| **Errors** | None |
| **Socket.IO** | None |

---

## 7. Admin — Roles (5 endpoints)

Controller: [`admin-roles.controller.ts`](backend/src/modules/admin/controllers/admin-roles.controller.ts)

### GET `/api/admin/roles`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Service** | `admin-roles.controller.ts:18` (incl. `permissions`, `_count.users`) |
| **Response (200)** | `Role[]` |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/admin/roles`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ name: string, description?: string, permissionIds?: number[] }` |
| **Service** | `admin-roles.controller.ts:24` |
| **Response (201)** | Created role with `permissions` |
| **Errors** | None |
| **Socket.IO** | None |

### PUT `/api/admin/roles/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ name?, description?, permissionIds? }` (partial) |
| **Service** | `admin-roles.controller.ts:36`. Writes `ROLE_UPDATED` audit log. |
| **Response (200)** | Updated role with `permissions` |
| **Errors** | None |
| **Socket.IO** | None |

### DELETE `/api/admin/roles/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Validation** | Can only delete roles with 0 active users |
| **Service** | `admin-roles.controller.ts:63`. Writes `ROLE_DELETED` audit log. |
| **Response (200)** | `{ message: 'Role deleted' }` |
| **Errors** | `400` — role has active users; `404` — not found |
| **Socket.IO** | None |

### GET `/api/admin/permissions`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Service** | `admin-roles.controller.ts:91` |
| **Response (200)** | `Permission[]` |
| **Errors** | None |
| **Socket.IO** | None |

---

## 8. Admin — Buildings (4 endpoints)

Controller: [`admin-buildings.controller.ts`](backend/src/modules/admin/controllers/admin-buildings.controller.ts)

### GET `/api/admin/buildings`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` |
| **Throttle** | `global` |
| **Service** | `admin-buildings.controller.ts:18` (incl. `_count.floors`) |
| **Response (200)** | `Building[]` ordered by `nameEn asc` |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/admin/buildings`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ nameAr: string, nameEn: string, isActive?: boolean }` |
| **Service** | `admin-buildings.controller.ts:26` |
| **Response (201)** | Created building |
| **Errors** | `400` — missing names |
| **Socket.IO** | None |

### PUT `/api/admin/buildings/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ nameAr?, nameEn?, isActive? }` (partial) |
| **Service** | `admin-buildings.controller.ts:43` |
| **Response (200)** | Updated building |
| **Errors** | None |
| **Socket.IO** | None |

### DELETE `/api/admin/buildings/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Service** | `admin-buildings.controller.ts:58` (hard delete via `prisma.building.delete`) |
| **Response (200)** | `{ message: 'Building deleted' }` |
| **Errors** | None |
| **Socket.IO** | None |

---

## 9. Admin — Floors (4 endpoints)

Controller: [`admin-floors.controller.ts`](backend/src/modules/admin/controllers/admin-floors.controller.ts)

### GET `/api/admin/floors`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` |
| **Throttle** | `global` |
| **Service** | `admin-floors.controller.ts:18` (incl. `building`) |
| **Response (200)** | `Floor[]` ordered by `[buildingId asc, nameEn asc]` |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/admin/floors`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ nameAr: string, nameEn: string, buildingId: number | string, isActive?: boolean }` |
| **Service** | `admin-floors.controller.ts:26` |
| **Response (201)** | Created floor |
| **Errors** | `400` — missing required fields |
| **Socket.IO** | None |

### PUT `/api/admin/floors/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ nameAr?, nameEn?, buildingId?, isActive? }` (partial) |
| **Service** | `admin-floors.controller.ts:44` |
| **Response (200)** | Updated floor |
| **Errors** | None |
| **Socket.IO** | None |

### DELETE `/api/admin/floors/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Service** | `admin-floors.controller.ts:59` (hard delete) |
| **Response (200)** | `{ message: 'Floor deleted' }` |
| **Errors** | None |
| **Socket.IO** | None |

---

## 10. Admin — Ticket Types (4 endpoints)

Controller: [`admin-ticket-types.controller.ts`](backend/src/modules/admin/controllers/admin-ticket-types.controller.ts)

### GET `/api/admin/ticket-types`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` |
| **Throttle** | `global` |
| **Service** | `admin-ticket-types.controller.ts:18` (incl. `department`, ordered by `displayOrder asc`) |
| **Response (200)** | `TicketType[]` |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/admin/ticket-types`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | `{ nameAr: string, nameEn: string, departmentId?: number|string, color?: string (default #6B7280), displayOrder?: number|string (default 0), isActive?: boolean, slaHours?: number|string|null }` |
| **Service** | `admin-ticket-types.controller.ts:26`. Writes `TICKET_TYPE_CREATED` audit log. |
| **Response (201)** | Created ticket type |
| **Errors** | `400` — missing names |
| **Socket.IO** | None |

### PUT `/api/admin/ticket-types/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Body** | All fields partial update |
| **Service** | `admin-ticket-types.controller.ts:56`. Writes `TICKET_TYPE_UPDATED` audit log. |
| **Response (200)** | Updated ticket type |
| **Errors** | None |
| **Socket.IO** | None |

### DELETE `/api/admin/ticket-types/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Service** | `admin-ticket-types.controller.ts:86` (soft-delete: `isActive: false`). Writes `TICKET_TYPE_DEACTIVATED` audit log. |
| **Response (200)** | `{ message: 'Ticket type deactivated' }` |
| **Errors** | None |
| **Socket.IO** | None |

---

## 11. Assets (4 endpoints)

Controller: [`assets.controller.ts`](backend/src/modules/assets/assets.controller.ts)
Service: [`assets.service.ts`](backend/src/modules/assets/assets.service.ts)

### GET `/api/assets`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor` |
| **Throttle** | `global` |
| **Query** | `page` (default 1), `limit` (default 50, max 100) |
| **Service** | `assets.service.ts:8 findAll()` |
| **Response (200)** | `{ data: Asset[] (incl. department), total, page, limit }` — supervisor filtered to own dept |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/assets`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor` |
| **Throttle** | `global` |
| **Body** | `{ name: string, serialNumber?: string, type: string, location?: string, departmentId?: number, status?: string (default 'active'), purchaseDate?: string, warrantyExpiry?: string }` |
| **Validation** | `name` and `type` required. Supervisor cannot create for another dept (`assets.service.ts:36`). |
| **Service** | `assets.service.ts:29 create()`. Writes `ASSET_CREATED` audit log. |
| **Response (201)** | Created asset |
| **Errors** | `400` — missing name/type; `403` — cross-dept |
| **Socket.IO** | None |

### PUT `/api/assets/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor` |
| **Throttle** | `global` |
| **Body** | All fields partial update |
| **Validation** | Supervisor must own asset's dept (`assets.service.ts:64-66`) |
| **Service** | `assets.service.ts:60 update()`. Writes `ASSET_UPDATED` audit log (only if fields changed). |
| **Response (200)** | Updated asset |
| **Errors** | `403` — cross-dept; `404` — not found / soft-deleted |
| **Socket.IO** | None |

### DELETE `/api/assets/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` only |
| **Throttle** | `global` |
| **Validation** | `super_admin` only; supervisor cannot delete |
| **Service** | `assets.service.ts:108 remove()` (soft-delete: `deletedAt: now`). Writes `ASSET_DELETED` audit log. |
| **Response (204)** | No content |
| **Errors** | `404` — not found; `403` — non-admin |
| **Socket.IO** | None |

---

## 12. Uploads (2 endpoints)

Controller: [`uploads.controller.ts`](backend/src/modules/uploads/uploads.controller.ts)
Service: [`uploads.service.ts`](backend/src/modules/uploads/uploads.service.ts)

### POST `/api/uploads`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any authenticated user |
| **Throttle** | `upload` (100 req / 1 hour) |
| **Body** | `multipart/form-data` — `file` field. Max 5 MB. Allowed: `.jpeg`, `.jpg`, `.png`, `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.wav`, `.mp3`, `.webm` |
| **Validation** | Extension + MIME type check (`uploads.controller.ts:12-18`). Magic byte validation (`uploads.service.ts:6-17`). |
| **Service** | `uploads.controller.ts:66` (disk storage + magic byte check) |
| **Response (200)** | `{ fileName: string, fileUrl: string, fileSize: number, mimeType: string }` |
| **Errors** | `400` — no file / invalid type; `422` — magic byte mismatch |
| **Socket.IO** | None |

### GET `/api/uploads/download/:filename`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any authenticated user |
| **Throttle** | `global` |
| **Validation** | Path traversal protection (`uploads.service.ts:35-48`: `path.basename` + root check) |
| **Service** | `uploads.controller.ts:75` (direct `res.download`) |
| **Response** | Binary download stream |
| **Errors** | `400` — invalid filename; `404` — file not found |
| **Socket.IO** | None |

---

## 13. Notifications (5 endpoints)

Controller: [`notifications.controller.ts`](backend/src/modules/notifications/notifications.controller.ts)
Service: [`notifications.service.ts`](backend/src/modules/notifications/notifications.service.ts)

### GET `/api/notifications`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any (returns own notifications only) |
| **Throttle** | `global` |
| **Query** | `page` (default 1), `limit` (default 50, max 100) |
| **Service** | `notifications.service.ts:19 findAll()` |
| **Response (200)** | `{ data: Notification[] (incl. ticket {id, ticketNumber}), unreadCount: number, pagination }` |
| **Errors** | None |
| **Socket.IO** | Events emitted by other modules that create notifications in DB (not pushed over Socket.IO, but notifications are created for ticket events) |

### PUT `/api/notifications/:id/read`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any (own notification only) |
| **Throttle** | `global` |
| **Service** | `notifications.service.ts:43 markRead()` |
| **Response (200)** | Updated notification with `isRead: true` |
| **Errors** | `404` — not found or doesn't belong to user |
| **Socket.IO** | None |

### PUT `/api/notifications/read-all`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any (own notifications) |
| **Throttle** | `global` |
| **Service** | `notifications.service.ts:49 markAllRead()` |
| **Response (200)** | `{ success: true }` |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/notifications/subscribe`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any |
| **Throttle** | `global` |
| **Body** | `{ endpoint: string, p256dh: string, auth: string }` (Web Push subscription keys) |
| **Service** | `notifications.service.ts:54 subscribe()` — upserts push subscription |
| **Response (201)** | `PushSubscription` object |
| **Errors** | None |
| **Socket.IO** | Triggers Web Push via `webpush` library when notifications are created (configured with VAPID keys) |

### DELETE `/api/notifications/unsubscribe`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any |
| **Throttle** | `global` |
| **Body** | `{ endpoint: string }` |
| **Service** | `notifications.service.ts:64 unsubscribe()` |
| **Response (204)** | No content |
| **Errors** | None |
| **Socket.IO** | None |

---

## 14. Profile (2 endpoints)

Controller: [`profile.controller.ts`](backend/src/modules/profile/profile.controller.ts)
Service: [`profile.service.ts`](backend/src/modules/profile/profile.service.ts)

### GET `/api/profile`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any (own profile) |
| **Throttle** | `global` |
| **Service** | `profile.service.ts:8 getProfile()` |
| **Response (200)** | `{ id, badgeNumber, username, fullNameAr, fullNameEn, email, role, avatarUrl, about, isActive, departmentId, department {nameAr, nameEn} }` |
| **Errors** | `404` — not found |
| **Socket.IO** | None |

### PUT `/api/profile`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any (own profile) |
| **Throttle** | `global` |
| **Body** | `{ avatarUrl?: string, about?: string }` |
| **Service** | `profile.service.ts:21 updateProfile()`. Writes `PROFILE_UPDATED` audit log. |
| **Response (200)** | Updated user profile |
| **Errors** | None |
| **Socket.IO** | None |

---

## 15. Analytics (10 endpoints)

Controller: [`analytics.controller.ts`](backend/src/modules/analytics/analytics.controller.ts)
Service: [`analytics.service.ts`](backend/src/modules/analytics/analytics.service.ts)
**All endpoints throttled** with `analytics` tier (300 req / 15 min).

### GET `/api/analytics/dashboard-summary`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` (with `canViewAnalytics` permission) |
| **Service** | `analytics.service.ts:35` — comprehensive dashboard incl. `checkAnalyticsPermission()` |
| **Response (200)** | `{ stats: {total, pending, resolved, open, overdue, slaBreaches, avgResolutionTimeHours, resolvedInternal, resolvedExternal}, statusDistribution[], priorityDistribution[], departmentPerformance[], recentActivity[], agentPerformance[], exportHistory[], assetSummary }` |
| **Errors** | `403` `ANALYTICS_FORBIDDEN` |
| **Socket.IO** | None |

### GET `/api/analytics/stats`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` |
| **Service** | `analytics.service.ts:117` |
| **Response (200)** | `{ total, pending, resolved, open, overdue, avgResolutionTimeHours }` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/analytics/status-distribution`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` |
| **Service** | `analytics.service.ts:138` |
| **Response (200)** | `[{ status: string, count: number }]` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/analytics/priority-distribution`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` |
| **Service** | `analytics.service.ts:144` |
| **Response (200)** | `[{ priority: string, count: number }]` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/analytics/department-performance`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor` |
| **Service** | `analytics.service.ts:150` |
| **Response (200)** | `[{ nameAr, nameEn, count }]` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/analytics/recent-activity`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` only |
| **Service** | `analytics.service.ts:155` — last 10 audit log entries |
| **Response (200)** | `AuditLog[]` (incl. user fullNameAr/En/avatarUrl) |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/analytics/agent-performance`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor` (supervisor sees own dept only) |
| **Service** | `analytics.service.ts:163` |
| **Response (200)** | `[{ id, nameEn, nameAr, department, resolvedCount, avgResolutionTimeHours, avgResponseTimeHours, slaAdherenceRate }]` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/analytics/aht`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` |
| **Service** | `analytics.service.ts:189` — calculates Average Handle Time from `TicketStatusHistory` (time spent in `in_progress`) |
| **Response (200)** | `{ overallAhtHours, totalResolved, ahtByPriority: [{priority, avgHours, count}], ahtByDepartment: [{departmentId, departmentName, avgHours, count}] (super_admin only) }` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/analytics/exports`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` |
| **Query** | `page`, `limit` (max 100) |
| **Service** | `analytics.service.ts:262` — super_admin sees all; others see own |
| **Response (200)** | `{ data: ExportHistory[] (incl. exportedBy), pagination }` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/analytics/export`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` (must have `canExportData` permission) |
| **Query** | `startDate`, `endDate` (ISO strings) |
| **Service** | `analytics.service.ts:279` — generates Excel file via `exceljs`, saves to `EXPORTS_DIR`, creates `ExportHistory` record (expires in 1h). Checks `canExportData` permission (`analytics.service.ts:281-297`). |
| **Response** | `200` — `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` stream. Content-Disposition: attachment. |
| **Errors** | `403` `EXPORT_FORBIDDEN` |
| **Socket.IO** | None |

---

## 16. Audit (2 endpoints)

Controller: [`audit.controller.ts`](backend/src/modules/audit/audit.controller.ts)
Service: [`audit.service.ts`](backend/src/modules/audit/audit.service.ts)

### GET `/api/audit`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Query** | `userId`, `action`, `departmentId`, `startDate`, `endDate`, `ticketId`, `page` (default 1), `limit` (default 20, max 100) |
| **Service** | `audit.service.ts:10 getLogs()` |
| **Response (200)** | `{ logs: AuditLog[] (incl. user, department, ticket selects), pagination: { total, page, limit, totalPages } }` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/audit/actions`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin` |
| **Throttle** | `global` |
| **Service** | `audit.service.ts:52 getActions()` — returns distinct action names |
| **Response (200)** | `string[]` of audit log action names. Known actions: `TICKET_CREATED`, `STATUS_CHANGED`, `TICKET_REOPENED`, `ASSIGNED`, `TRANSFERRED`, `USER_CONFIRMATION`, `DUE_DATE_CHANGED`, `TYPE_CHANGED`, `TICKET_LINKED`, `TICKET_UNLINKED`, `TICKET_ARCHIVED`, `TICKET_ARCHIVED_BULK`, `SUPER_ADMIN_OVERRIDE`, `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `PASSWORD_RESET`, `PROFILE_UPDATED`, `DEPT_CREATED`, `DEPT_UPDATED`, `DEPT_DEACTIVATED`, `ROLE_UPDATED`, `ROLE_DELETED`, `TICKET_TYPE_CREATED`, `TICKET_TYPE_UPDATED`, `TICKET_TYPE_DEACTIVATED`, `ASSET_CREATED`, `ASSET_UPDATED`, `ASSET_DELETED`, `ARTICLE_CREATED`, `ARTICLE_UPDATED`, `ARTICLE_DELETED`, `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_DELETED` |
| **Errors** | None |
| **Socket.IO** | None |

---

## 17. Team Notes (5 endpoints)

Controller: [`team-notes.controller.ts`](backend/src/modules/team-notes/team-notes.controller.ts)
Service: [`team-notes.service.ts`](backend/src/modules/team-notes/team-notes.service.ts)

### GET `/api/team-notes`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any (super_admin: all; others: own dept; `end_user` excluded from write, but can read) |
| **Throttle** | `global` |
| **Query** | `page` (default 1), `limit` (default 50, max 100) |
| **Service** | `team-notes.service.ts:8 findAll()` |
| **Response (200)** | `{ data: TeamNote[] (incl. author, attachments, comments with authors, likes), total, page, limit }` |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/team-notes`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` — **NOT** `end_user` |
| **Throttle** | `global` |
| **Body** | `{ body?: string, attachments?: Array<{ fileName, fileUrl, fileSize, mimeType, isVoiceNote?, voiceDuration? }> }` |
| **Validation** | `end_user` forbidden (`team-notes.service.ts:53-55`). User must have department or be super_admin. |
| **Service** | `team-notes.service.ts:43 create()` |
| **Response (201)** | Created `TeamNote` with full relations |
| **Errors** | `400` — no department; `403` — end_user |
| **Socket.IO** | None |

### POST `/api/team-notes/:id/comments`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` — **NOT** `end_user` |
| **Throttle** | `global` |
| **Body** | `{ body?: string }` |
| **Validation** | `end_user` forbidden. Cross-dept comments forbidden (non-admin) |
| **Service** | `team-notes.service.ts:77 addComment()` |
| **Response (201)** | `TeamNoteComment` with `author` |
| **Errors** | `400` — note not found; `403` — end_user / cross-dept |
| **Socket.IO** | None |

### POST `/api/team-notes/:id/like`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | `super_admin`, `supervisor`, `agent` — **NOT** `end_user` |
| **Throttle** | `global` |
| **Body** | None |
| **Service** | `team-notes.service.ts:93 toggleLike()` — idempotent: creates like or deletes existing |
| **Response (200)** | `{ liked: true }` (added) or `{ liked: false }` (removed) |
| **Errors** | `400` — note not found; `403` — end_user / cross-dept |
| **Socket.IO** | None |

### DELETE `/api/team-notes/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Note author or `super_admin` |
| **Throttle** | `global` |
| **Service** | `team-notes.service.ts:131 remove()` (soft-delete: `deletedAt: now`) |
| **Response (204)** | No content |
| **Errors** | `404` — not found; `403` — not author and not admin |
| **Socket.IO** | None |

---

## 18. Knowledge Base (11 endpoints)

Controller: [`knowledge.controller.ts`](backend/src/modules/knowledge/knowledge.controller.ts)
Service: [`knowledge.service.ts`](backend/src/modules/knowledge/knowledge.service.ts)

### GET `/api/knowledge/articles`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any |
| **Throttle** | `global` |
| **Query** | `page` (default 1), `limit` (default 20, max 100), `search` (full-text across titles+content+categories, Arabic-normalized), `categoryId` |
| **Service** | `knowledge.service.ts:23 findAll()` (only `isActive: true` articles) |
| **Response (200)** | `{ data: KnowledgeArticle[] (incl. category, author), pagination }` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/knowledge/categories`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any |
| **Throttle** | `global` |
| **Service** | `knowledge.service.ts:53 findCategories()` (incl. `_count.articles`) |
| **Response (200)** | `KnowledgeCategory[]` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/knowledge/search`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any |
| **Throttle** | `global` |
| **Query** | `q` (required), `page`, `limit` |
| **Service** | `knowledge.service.ts:59 search()` (Arabic-normalized full-text on title+content) |
| **Response (200)** | `{ data: KnowledgeArticle[], pagination }` |
| **Errors** | None |
| **Socket.IO** | None |

### GET `/api/knowledge/suggest`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any |
| **Throttle** | `global` |
| **Query** | `q` (min 3 chars trimmed; returns max 3 results with snippets) |
| **Service** | `knowledge.service.ts:87 suggest()` — exact match first, then word-level fallback |
| **Response (200)** | `Array<{ id, titleAr, titleEn, views, category, snippetEn (120 chars), snippetAr (120 chars) }>` |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/knowledge/articles`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any with `canManageKnowledgeBase` permission (checked via override → dept defaults) |
| **Throttle** | `global` |
| **Body** | `{ titleAr: string, titleEn: string, contentAr: string, contentEn: string, categoryId: number }` |
| **Service** | `knowledge.service.ts:134 create()`. Writes `ARTICLE_CREATED` audit log. |
| **Response (201)** | Created article with `category` |
| **Errors** | `400` — missing required fields; `403` — insufficient permissions |
| **Socket.IO** | None |

### PUT `/api/knowledge/articles/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Same permissions as create |
| **Throttle** | `global` |
| **Body** | `{ titleAr?, titleEn?, contentAr?, contentEn?, categoryId?, isActive? }` |
| **Service** | `knowledge.service.ts:151 update()`. Writes `ARTICLE_UPDATED` audit log. |
| **Response (200)** | Updated article with `category` |
| **Errors** | `403`; `404` |
| **Socket.IO** | None |

### DELETE `/api/knowledge/articles/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Same permissions as create |
| **Throttle** | `global` |
| **Service** | `knowledge.service.ts:177 remove()` (hard delete). Writes `ARTICLE_DELETED` audit log. |
| **Response (204)** | No content |
| **Errors** | `403`; `404` |
| **Socket.IO** | None |

### POST `/api/knowledge/articles/:id/view`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any |
| **Throttle** | `global` |
| **Service** | `knowledge.service.ts:192 incrementView()` — increments `views` counter |
| **Response (204)** | No content |
| **Errors** | None |
| **Socket.IO** | None |

### POST `/api/knowledge/categories`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Any with `canManageKnowledgeBase` permission |
| **Throttle** | `global` |
| **Body** | `{ nameAr: string, nameEn: string }` |
| **Service** | `knowledge.service.ts:196 createCategory()`. Writes `CATEGORY_CREATED` audit log. |
| **Response (201)** | Created category |
| **Errors** | `403` |
| **Socket.IO** | None |

### PUT `/api/knowledge/categories/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Same as above |
| **Throttle** | `global` |
| **Body** | `{ nameAr?, nameEn? }` |
| **Service** | `knowledge.service.ts:207 updateCategory()`. Writes `CATEGORY_UPDATED` audit log. |
| **Response (200)** | Updated category |
| **Errors** | `403`; `404` |
| **Socket.IO** | None |

### DELETE `/api/knowledge/categories/:id`
| Field | Value |
|---|---|
| **Auth** | JWT required |
| **Role** | Same as above |
| **Throttle** | `global` |
| **Validation** | Can only delete if 0 articles in category |
| **Service** | `knowledge.service.ts:225 removeCategory()`. Writes `CATEGORY_DELETED` audit log. |
| **Response (204)** | No content |
| **Errors** | `400` — has active articles; `403`; `404` |
| **Socket.IO** | None |

---

## Socket.IO Events Reference

All Socket.IO events are managed by `TicketGateway` (`gateways/ticket.gateway.ts`).

### Client → Server
| Event | Payload | Auth | Notes |
|---|---|---|---|
| `join-department` | `deptId: number` | JWT (via handshake token) | Auto-joins if user's dept matches or super_admin (`ticket.gateway.ts:61-66`) |
| `join-user` | `userId: number` | JWT | Auto-joins if user's ID matches (`ticket.gateway.ts:69-74`) |
| `join-ticket` | `ticketId: number` | JWT | Rate-limited: 5 req/1s (`ticket.gateway.ts:76-83`) |
| `leave-ticket` | `ticketId: number` | JWT | Leaves room (`ticket.gateway.ts:86-88`) |

### Server → Client
| Event | Target | Emitted By | Payload |
|---|---|---|---|
| `new-ticket` | `dept-{id}` | `tickets.service.ts:179` (create), `tickets.service.ts:597` (transfer to) | `{ id, ticketNumber, subject, priority }` |
| `ticket-transferred` | `dept-{sourceId}` | `tickets.service.ts:598` | `{ id, ticketNumber, toDepartmentId, reason }` |
| `ticket-status-updated` | `user-{id}`, `dept-{id}`, `ticket-{id}` | `tickets.service.ts:483-485`, bulk (730) | `{ id, ticketNumber, status }` |
| `ticket-assigned` | `user-{agentId}`, `ticket-{id}`, creator | `tickets.service.ts:534-536`, bulk (779) | `{ id, ticketNumber, subject }` |
| `new-comment` | dept, creator, assignee | `tickets.service.ts:642-645` | `{ ticketId, ticketNumber, message: { id, body, sender, createdAt, messageType } }` |
| `ticket-closed` | `dept-{id}` | `tickets.service.ts:687` | `{ id, ticketNumber, status: 'closed' }` |
| `error` | disconnected client | `ticket.gateway.ts:43,51` | `'Authentication required'` / `'Invalid or expired token'` |

### Connection
- Handshake auth via `auth.token` or `query.token` — verified with JWT access token (`ticket.gateway.ts:41-53`)
- Rate-limited events per socket (`ticket.gateway.ts:11-27`)
- CORS origins configured per env (`ticket.gateway.ts:29-31`)

---

## Ticket Status Workflow

From [`workflow.constants.ts`](backend/src/modules/tickets/workflow.constants.ts):

```
pending → open, in_progress, closed
open    → in_progress, closed
in_progress → resolved, closed
resolved → in_progress (reopen only; closed requires creator confirmation)
closed   → in_progress (reopen; super_admin only)
```

**Priority SLA Modifiers:**
| Priority | Multiplier | Effect |
|---|---|---|
| `low` | 1.5× | +50% time |
| `normal` | 1.0× | Base |
| `high` | 0.5× | −50% time |
| `critical` | 0.25× | −75% time |

SLA formula: `baseHours × modifier`, applied from `createdAt` or update time (`sla.utils.ts:10-25`).