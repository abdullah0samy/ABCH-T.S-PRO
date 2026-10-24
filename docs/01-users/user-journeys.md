# User Journeys

> Reverse-engineered from codebase. Every step cites source file:line evidence.

## Roles Overview

Four roles are defined in the sidebar role filter logic:
`super_admin`, `supervisor`, `agent`, `end_user`
(**CONFIRMED** — `frontend/src/App.tsx:156-178`)

---

## Role 1: end_user

**Accessible sidebar items:** Dashboard, New Ticket, My Tickets, Knowledge Base, Profile
(**CONFIRMED** — `App.tsx:163,165` — roles arrays include `'end_user'` for dashboard, newTicket, outgoing/my-tickets, knowledge, profile)

### Step 1: Login
- **Component:** `frontend/src/pages/Login.tsx`
- **API Call:** `POST /api/auth/login` with `{ identifier, password }` (`Login.tsx:27`)
- **Backend:** `auth.controller.ts:16-35` → `auth.service.ts:12-93`
- **Auth:** Identifier matched against `badgeNumber` OR `username` (`auth.service.ts:28-32`). Password compared via bcrypt (`auth.service.ts:54`).
- **Tokens:** Access token (`8h` expiry, `auth.utils.ts:12-16`), refresh token in httpOnly cookie (`7d` expiry, `auth.controller.ts:23-28`).
- **State:** On success, `authStore.setAuth(user, accessToken)` stores user + token in localStorage (`authStore.ts:12-15`).
- **Navigation:** Custom event `navigate → /dashboard` (`Login.tsx:37`).
- **Lockout:** 5 failed attempts triggers 15-minute lock (`auth.service.ts:56-60`).

### Step 2: Dashboard
- **Component:** `frontend/src/pages/DashboardPage.tsx`
- **API Calls:**
  - `GET /api/analytics/dashboard-summary` (`DashboardPage.tsx:148`)
  - `GET /api/analytics/aht` (`DashboardPage.tsx:166`)
- **Data displayed:** Stats (total, pending, resolved, overdue, avg resolution time), status distribution bar chart, priority pie chart, AHT by priority, asset summary (`DashboardPage.tsx:282-593`).
- **Real-time:** Listeners on `ws:ticket-created`, `ws:ticket-status-updated`, `ws:ticket-assigned` re-fetch dashboard (`DashboardPage.tsx:135-143`).
- **State:** Uses `useAuthStore.user` for role/name, `useState` for local data.

### Step 3: New Ticket
- **Component:** `frontend/src/pages/tickets/NewTicketPage.tsx`
- **API Calls on mount:**
  - `GET /api/tickets/form-data` → departments, buildings, floors, ticketTypes (`NewTicketPage.tsx:85`)
- **API Call on submit:** `POST /api/tickets` with full form body + attachments (`NewTicketPage.tsx:237-240`)
- **Backend:** `tickets.controller.ts:20-26` → `tickets.service.ts:106-181`
- **Data captured:** subject, description, departmentId, buildingId, floorId, ticketTypeId, priority, roomExtension, creatorPhone, creatorExtension, assetId, attachments.
- **Validation:** Zod schema `createTicketSchema` (`tickets.controller.ts:21`). Floor must belong to selected building (`tickets.service.ts:125-127`).
- **Ticket number:** Generated as `TKT-YYMMDD-###` (`tickets.service.ts:59-76`).
- **SLA deadline:** Auto-calculated at creation (`tickets.service.ts:132-133`).
- **On success:** Navigates to `/inbox` after 1.5s (`NewTicketPage.tsx:243`).

### Step 4: My Tickets
- **Component:** `frontend/src/pages/tickets/MyTicketsPage.tsx`
- **API Call:** `GET /api/tickets/my` with query params (page, limit, status, search) (`tickets.service.ts:184-206`)
- **Filtering:** `createdById = userId`, `isArchived = false` (`tickets.service.ts:190`). Optional status filter and search on `ticketNumber`/`subject`.
- **Displayed fields:** Ticket number, subject, status, priority, department, assigned agent, creation date.
- **Actions:** Click navigates to `/tickets/{id}`.

### Step 5: Ticket Details
- **Component:** `frontend/src/pages/tickets/TicketDetailsPage.tsx`
- **API Call:** `GET /api/tickets/{id}` (`tickets.service.ts:361-406`)
  - Fetches full ticket with department, ticketType, createdBy, assignedTo, attachments, messages, auditLogs (last 20), transfers.
- **Permission check:** Can view if creator, assigned, same department with `canViewAllDeptTickets`, or super_admin (`tickets.service.ts:379-403`).
- **Displayed:** Ticket number, subject, description, status badge, priority, SLA deadline, due date, transfer history, attachments, messages, audit logs.
- **Actions available to end_user:**
  - Add public comments (`POST /api/tickets/{id}/comments`, `tickets.service.ts:603-648`).
  - Confirm resolution if status = `resolved` and user is creator (`PUT /api/tickets/{id}/confirm`, `tickets.service.ts:651-689`).
  - **Cannot** change status, assign, transfer, or archive.

### Step 6: Knowledge Base
- **Component:** `frontend/src/pages/KnowledgeBasePage.tsx`
- **API Calls:**
  - `GET /api/knowledge/categories` (`KnowledgeBasePage.tsx:131`)
  - `GET /api/knowledge/articles?page=&search=&categoryId=` (paginated, `KnowledgeBasePage.tsx:144-161`)
  - `POST /api/knowledge/articles/{id}/view` increments view count (`KnowledgeBasePage.tsx:167`)
- **Search:** Debounced 400ms on `searchTerm`, `selectedCategory`, `page` changes (`KnowledgeBasePage.tsx:118`).
- **Permission to manage KB:** Only `super_admin` or users with `canManageKnowledgeBase = true` in override/dept defaults (`KnowledgeBasePage.tsx:56-65`).
- **Data displayed:** Article cards (title, snippet, author, views, category). Article detail view (full content, breadcrumbs, author).

### Step 7: Profile
- **Component:** `frontend/src/pages/UserProfilePage.tsx`
- **API Calls:**
  - `GET /api/profile` (`profile.service.ts:8-19`)
  - `PUT /api/profile` with `{ avatarUrl, about }` (`profile.service.ts:21-47`)
  - `POST /api/uploads` for avatar upload (`UserProfilePage.tsx:68-72`)
- **Displayed:** Read-only: fullNameAr/En, badgeNumber, username, role, department. Editable: avatarUrl, about (bio).
- **Audit:** Profile update creates `PROFILE_UPDATED` audit log (`profile.service.ts:36-44`).

---

## Role 2: agent

**Accessible sidebar items:** All end_user pages + Inbox, Transferred, Archive, Analytics, Team Feed
(**CONFIRMED** — `App.tsx:158-164` — `'agent'` in roles for all six additional items)

### Step 8: Inbox (Department Tickets)
- **Component:** `frontend/src/pages/tickets/InboxPage.tsx`
- **API Call:** `GET /api/tickets/department` with filters (`tickets.service.ts:209-269`)
- **Filters:** status, priority, ticketTypeId, creatorName, agentId, date range, text search.
- **RBAC:** Non-super_admin scoped to `departmentId`. If `canViewAllDeptTickets = false`, filtered to `assignedToId OR createdById = userId` (`tickets.service.ts:221-234`).
- **Displayed:** paginated table with ticket number, subject, status, priority, department, agent, creator, SLA deadline.
- **Bulk actions:** Bulk status update (`POST /api/tickets/bulk-update-status`), bulk assign (`POST /api/tickets/bulk-assign`), bulk archive (`POST /api/tickets/bulk-archive`).

### Step 9: Transferred Tickets
- **Component:** `frontend/src/pages/tickets/TransferredPage.tsx`
- **API Call:** `GET /api/tickets/transferred` (`tickets.service.ts:322-358`)
- **Query:** Finds tickets with transfers involving the user's department (inbound or outbound).
- **Displayed:** Direction (inbound/outbound), from/to departments, reason, transferred by, timestamp.

### Step 10: Archive
- **Component:** `frontend/src/pages/tickets/ArchivePage.tsx`
- **API Call:** `GET /api/tickets/archived` (`tickets.service.ts:296-319`)
- **Filtering:** `isArchived = true`, scoped to department for non-super_admin.
- **Displayed:** Paginated archive of resolved/closed tickets.

### Step 11: Analytics
- **Component:** `frontend/src/pages/AnalyticsPage.tsx`
- **API Calls (via DashboardPage.tsx shared endpoints):**
  - `GET /api/analytics/dashboard-summary` — stats, distributions, department/agent performance
  - `GET /api/analytics/aht` — average handle time by priority/department
- **Permission:** Requires `canViewAnalytics` in user override or dept defaults, or `supervisor` role (`analytics.service.ts:22-33`).

### Step 12: Team Feed
- **Component:** `frontend/src/pages/TeamFeedPage.tsx`
- **API Calls:**
  - `GET /api/team-notes` → team notes for user's department (`team-notes.service.ts:8-41`)
  - `POST /api/team-notes` → create note (`team-notes.service.ts:43-75`)
  - `POST /api/team-notes/{id}/comment` → add comment (`team-notes.service.ts:77-91`)
  - `POST /api/team-notes/{id}/like` → toggle like (`team-notes.service.ts:93-112`)
- **RBAC:** `end_user` cannot create, comment, or like team notes (`team-notes.service.ts:53-54,79,95`). Non-super_admin scoped to own department notes.

---

## Role 3: super_admin

**Accessible sidebar items:** All agent pages + Admin section (Buildings, Floors, Departments, Ticket Types, Users, Roles, Assets, Audit Logs)
(**CONFIRMED** — `App.tsx:169-178,183,247`)
Admin paths guarded: `user.role !== 'super_admin'` returns DashboardPage (`App.tsx:183`).

### Admin: Buildings
- **Component:** `frontend/src/pages/admin/BuildingsPage.tsx`
- **API Calls:** CRUD on `GET/POST/PUT/DELETE /api/admin/buildings`
- **Backend:** `admin-buildings.controller.ts`

### Admin: Floors
- **Component:** `frontend/src/pages/admin/FloorsPage.tsx`
- **API Calls:** CRUD on `GET/POST/PUT/DELETE /api/admin/floors`
- **Backend:** `admin-floors.controller.ts`
- **Constraint:** Floor belongs to a building (`schema.prisma:49-53`).

### Admin: Departments
- **Component:** `frontend/src/pages/admin/DepartmentsPage.tsx`
- **API Calls:** CRUD on `GET/POST/PUT/DELETE /api/admin/departments`
- **Backend:** `admin-departments.controller.ts`
- **Data:** deptType, slaHours, defaultPermissions, transfer allowlist.

### Admin: Ticket Types
- **Component:** `frontend/src/pages/admin/TicketTypesPage.tsx`
- **API Calls:** CRUD on `GET/POST/PUT/DELETE /api/admin/ticket-types`
- **Backend:** `admin-ticket-types.controller.ts`
- **Data:** nameAr/En, departmentId, color, slaHours, displayOrder.

### Admin: Users
- **Component:** `frontend/src/pages/admin/UserManagementPage.tsx`
- **API Calls:**
  - `GET /api/admin/users` — all users with pagination (`admin-users.controller.ts:18-38`)
  - `POST /api/admin/users` — create (`admin-users.controller.ts:42-94`)
  - `PUT /api/admin/users/{id}` — update role, department, permissions (`admin-users.controller.ts:96-138`)
  - `POST /api/admin/users/{id}/reset-password` — reset (`admin-users.controller.ts:140-167`)
  - `DELETE /api/admin/users/{id}` — soft delete (sets `isActive = false`) (`admin-users.controller.ts:169-186`)
- **Validation:** Badge number and username must be numeric (`admin-users.controller.ts:49-50`).
- **Audit:** USER_CREATED, USER_UPDATED, PASSWORD_RESET, USER_DEACTIVATED logs.

### Admin: Roles
- **Component:** `frontend/src/pages/admin/RoleManagementPage.tsx`
- **API Calls:** CRUD on `GET/POST/PUT/DELETE /api/admin/roles`
- **Backend:** `admin-roles.controller.ts`

### Admin: Assets
- **Component:** `frontend/src/pages/admin/AssetManagementPage.tsx`
- **API Calls:** CRUD on `GET/POST/PUT/DELETE /api/admin/assets`
- **Backend:** `assets.controller.ts` → `assets.service.ts`
- **RBAC:** Non-super_admin can only manage own department assets (`assets.service.ts:36,64,111`).
- **Fields:** name, serialNumber, type, location, departmentId, status (active/maintenance/retired), purchaseDate, warrantyExpiry.

### Admin: Audit Logs
- **Component:** `frontend/src/pages/AuditLogPage.tsx`
- **Displayed:** All audit log entries with userId, action, entityType, oldData, newData, timestamp.

---

## Cross-cutting: WebSocket Real-time

- **Provider:** `frontend/src/core/NotificationProvider.tsx` — single socket connection (`NotificationProvider.tsx:93-100`).
- **Authentication:** Socket auth via `accessToken` (`ticket.gateway.ts:41-53`).
- **Room subscriptions:** `join-user`, `join-department`, `join-ticket` (`ticket.gateway.ts:60-88`).
- **Incoming event handlers:** `new-ticket`, `ticket-status-updated`, `ticket-assigned`, `new-comment`, `sla-warning`, `sla-breach` (`NotificationProvider.tsx:118-177`).
- **Re-dispatch:** WS events re-emitted as DOM custom events (`ws:ticket-status-updated`, etc.) for component consumption (`NotificationProvider.tsx:129,142,152`).
- **Toasts:** 6-second auto-dismiss, max 100 notifications in history (`NotificationProvider.tsx:33-34,68-76`).
- **Browser push:** Requests `Notification.permission` on mount, fires `new Notification()` when granted (`NotificationProvider.tsx:78-80,201-205`).