# Master Production, Logic, Brand Identity & Multi-Screen UI/UX Upgrade Prompt for Antigravity Argon (`abdullah0samy/ABCH-T.S-PRO`)

You are an autonomous Principal Full-Stack Architect & Lead Product Designer (NestJS 11 + Prisma 6 + PostgreSQL + Redis/BullMQ + Socket.IO + React 19 + TypeScript + Tailwind CSS v4). Your mission is to execute a comprehensive, zero-regression production upgrade across `abdullah0samy/ABCH-T.S-PRO` covering:
1. **Phase 1 — P0 Runtime Crash & Broken Workflow Fixes**
2. **Phase 2 — Security, Proxy/CSRF Hardening & Complete Business Logic (Transfer Allowlist, Creator Reopen, Internal Notes Privacy, Password Change, Persistent Notifications, Print Work Order)**
3. **Phase 3 — ABCH Brand Identity, Color System & Visual Polish**
4. **Phase 4 — Full RTL Localization & Multi-Screen Responsiveness (Mobile 320px–480px, Tablet 768px, Desktop 1024px–1920px+)**
5. **Phase 5 — Build Verification & Direct Git Push to `main`**

## Strict Execution Rules

1. **Zero Hallucinations & Exact File Grounding**: Every task below cites exact files, functions, and line numbers verified against the repository. Read each target file before modifying it.
2. **Preserve Existing Architecture**: Keep the NestJS modular structure, Prisma schema compatibility, in-memory access token + `httpOnly` refresh cookie flow, and Tailwind CSS v4 CSS-variable theme system.
3. **Verify Before Finishing**: After completing all phases, run `npm run build` in `backend/` and `npm run type-check && npm run build` in `frontend/` to guarantee zero TypeScript or bundler errors before committing and pushing.

## Master Summary of All Upgrades & Fixes

| Priority | ID | Category | Issue / Upgrade Summary | Target Files |
| :--- | :--- | :--- | :--- | :--- |
| P0 | BUG-01 | Admin UI Crash | `ReferenceError: roles is not defined` crashes User Management modal on open; unsanitized payload fails PUT validation | `frontend/src/pages/admin/UserManagementPage.tsx` |
| P0 | BUG-02 | Backend Validation | `numericString` (`^\d+$`) rejects alphanumeric usernames/badges (`admin`, `supervisor`, `EMP-01`) | `backend/src/common/schemas/users.schema.ts` |
| P0 | BUG-03 | Inbox Bulk Actions | Bulk Assign & Bulk Archive use raw `fetch()` without CSRF token or `credentials: 'include'`, failing with `403 CSRF_INVALID` | `frontend/src/pages/tickets/InboxPage.tsx` |
| P0 | BUG-04 | Analytics Export | Excel export calls `response.blob()` on an already-parsed `Blob` from `apiFetch`, throwing `TypeError` | `frontend/src/pages/AnalyticsPage.tsx` |
| P0 | BUG-05 | Agent Assignment RBAC | `GET /api/admin/users` is locked to `super_admin`, leaving the Assign Agent dropdown empty for `supervisor` and `agent` | `backend/src/modules/admin/controllers/admin-users.controller.ts`, `TicketDetailsPage.tsx`, `InboxPage.tsx` |
| P0 | BUG-06 | Ticket Lifecycle & RBAC | `isAgent` ignores `user.role === 'end_user'`, hides Confirm Resolution for same-dept creators, and redirects `end_user` to `/inbox` (`403`) | `TicketDetailsPage.tsx`, `NewTicketPage.tsx`, `useTickets.ts` |
| P1 | LOGIC-01 | Transfer Allowlist & Dept Type | `DeptTransferAllowlist` has 0 rows and no Admin UI, blocking all non-super_admin transfers (`403`); Transfer modal shows `SENDER_ONLY` & inactive depts | `tickets.service.ts`, `admin-departments.controller.ts`, `DepartmentsPage.tsx`, `TicketDetailsPage.tsx` |
| P1 | LOGIC-02 | Creator Reopen Flow | Ticket creator (`end_user`) can confirm resolution (`resolved -> closed`) but has no button/permission to reject resolution & reopen (`resolved -> in_progress`) | `tickets.service.ts`, `TicketDetailsPage.tsx`, `translations.ts` |
| P1 | LOGIC-03 | Team Feed Deletion | Post three-dots menu in `TeamFeedPage.tsx` has no handler even though `DELETE /api/team-notes/:id` exists on the backend | `frontend/src/pages/TeamFeedPage.tsx` |
| P1 | LOGIC-04 | Real KPI & Date Filters | Dashboard/Analytics have hardcoded `+12%` badges, non-functional date selectors, and check `priority === 'medium'` instead of `'normal'` | `DashboardPage.tsx`, `AnalyticsPage.tsx`, `analytics.controller.ts`, `analytics.service.ts` |
| P1 | SEC-01 | Internal Note Privacy | Internal agent notes (`messageType === 'internal_note'`) are leaked to `end_user` in `GET /api/tickets/:id` and via WebSocket `new-comment` | `backend/src/modules/tickets/tickets.service.ts` |
| P1 | SEC-02 | Coolify/Cloudflare CSRF | `doubleCsrf` binds to volatile `req.ip`, lacks `trust proxy`, and overwrites CSRF cookies on every parallel request | `backend/src/main.ts` |
| P1 | OPS-01 | Docker Healthcheck | `GET /api/health` returns HTTP `200 OK` when PostgreSQL fails instead of `503 Service Unavailable` | `backend/src/common/health/health.controller.ts` |
| P1 | FEAT-01 | Password Change UI | `POST /api/profile/password` exists on backend, but `UserProfilePage.tsx` lacks a Change Password form and `forcePasswordChange` banner | `auth.service.ts`, `users.service.ts`, `profile.service.ts`, `UserProfilePage.tsx`, `App.tsx` |
| P1 | FEAT-02 | Persistent Notifications & Sound | Ticket events don't insert DB `Notification` rows, `NotificationProvider` never loads `/api/notifications`, and lacks Web Audio chime | `tickets.service.ts`, `NotificationProvider.tsx` |
| P1 | FEAT-03 | Work Order Print Slip | Hospital technicians need a clean `@media print` Work Order print button in `TicketDetailsPage.tsx` | `frontend/src/pages/tickets/TicketDetailsPage.tsx`, `frontend/src/index.css` |
| P2 | BRAND-01 | ABCH Brand & Color System | `logo.png` (Champagne Gold `#C8925A` + Silver `#C3C5C7` + White `H`) washes out on white backgrounds; broken `/logo-512x512.png` meta tags; inconsistent colors in `ArchivePage`/`TransferredPage` and typo `bg-[var(--bg-main)]0/10` | `index.html`, `index.css`, `Login.tsx`, `App.tsx`, `AssetManagementPage.tsx`, `ArchivePage.tsx`, `TransferredPage.tsx`, `KnowledgeBasePage.tsx` |
| P2 | RESP-01 | All-Screen Responsiveness & RTL | Mobile sidebar state bug on resize; hover-only action buttons invisible on touch devices; `TicketDetailsPage` header overflow; `NewTicketPage` cramped 3rd grid column & unlocalized priorities; RTL table/search/timeline alignment | Multiple files across `frontend/src/` |

## Phase 1: Fix P0 Runtime Crashes & Broken Workflows

### 1.1 Fix `ReferenceError: roles is not defined` and Payload Sanitization in `UserManagementPage.tsx`
- **File**: `frontend/src/pages/admin/UserManagementPage.tsx`
- **Problem**:
  1. Lines 380–392 reference an undefined `roles` variable (`roles.find(...)` and `{roles.map(...)}`), crashing the page whenever the Add/Edit User modal opens.
  2. In `handleSubmit`, `saveUser({ id: currentUser?.id, data: currentUser })` sends the raw `User` object (including `id`, `department`, `userRole`, and `permissionsOverride.id` / `userId` / `allowedTransferDeptIds`) directly to `PUT /api/admin/users/:id`, failing backend Zod validation.
- **Required Fix**:
  1. Replace the role `<select>` in `UserManagementPage.tsx` so it binds cleanly to `currentUser?.role || 'end_user'` with the 4 system roles (`'end_user'`, `'agent'`, `'supervisor'`, `'super_admin'`) and remove all references to `roles` and `roleId`.
  2. Expand `permissionKeys` in `UserManagementPage.tsx` to include all 13 permission flags from `DeptPermissions` (`canReceiveTickets`, `canSendTickets`, `canViewAllDeptTickets`, `canAssignTickets`, `canChangeStatus`, `canTransferTickets`, `canArchiveTickets`, `canExportData`, `canViewAnalytics`, `canManageTeamNotes`, `canManageDeptUsers`, `canViewAuditLogs`, `canManageKnowledgeBase`).
  3. In `handleSubmit`, sanitize the payload before calling `saveUser`:
     ```ts
     const cleanPermissions: Record<string, boolean | null> = {};
     if (currentUser?.permissionsOverride) {
       for (const { key } of permissionKeys) {
         const val = (currentUser.permissionsOverride as any)[key];
         if (typeof val === 'boolean' || val === null) {
           cleanPermissions[key] = val;
         }
       }
     }
     const payload: Record<string, any> = {
       badgeNumber: currentUser?.badgeNumber?.trim(),
       username: currentUser?.username?.trim(),
       fullNameAr: currentUser?.fullNameAr?.trim(),
       fullNameEn: currentUser?.fullNameEn?.trim() || null,
       email: currentUser?.email?.trim() || null,
       role: currentUser?.role || 'end_user',
       departmentId: currentUser?.departmentId ?? null,
       isActive: currentUser?.isActive ?? true,
       permissionsOverride: cleanPermissions,
     };
     if (!currentUser?.id && (currentUser as any)?.password) {
       payload.password = (currentUser as any).password;
     }
     await saveUser({ id: currentUser?.id, data: payload });
     ```

### 1.2 Fix Overly Restrictive `badgeNumber` / `username` Regex in `backend/src/common/schemas/users.schema.ts`
- **File**: `backend/src/common/schemas/users.schema.ts`
- **Problem**: `numericString` enforces `/^\d+$/`, rejecting valid identifiers like `admin`, `supervisor`, `agent`, `user`, or `EMP-001` that `auth.schema.ts` (`/^[a-zA-Z0-9_.-]+$/`) and `seed-local.ts` use.
- **Required Fix**:
  1. Replace `numericString` with an identifier schema matching `loginSchema`:
     ```ts
     const identifierString = z
       .string()
       .trim()
       .min(1, 'Identifier is required')
       .max(64)
       .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, dots, hyphens, and underscores are allowed');
     ```
  2. Preprocess optional `email` and `fullNameEn` so empty strings `""` convert to `null`:
     ```ts
     const optionalEmail = z.preprocess(
       (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
       z.string().email('Invalid email').max(160).nullable().optional(),
     );
     ```
  3. Update `permissionsOverrideSchema` to `z.record(z.string(), z.boolean().nullable().optional()).optional()`.

### 1.3 Fix Bulk Assign & Bulk Archive CSRF Failures in `InboxPage.tsx`
- **File**: `frontend/src/pages/tickets/InboxPage.tsx` (lines 145–191)
- **Problem**: `handleBulkAssign` and `handleBulkArchive` use raw `fetch(apiUrl(...))` without `credentials: 'include'` or `x-csrf-token`, failing with `403 Forbidden (CSRF_INVALID)`.
- **Required Fix**:
  1. Convert both `handleBulkAssign` and `handleBulkArchive` to use `apiFetch('/api/tickets/bulk-assign', ...)` and `apiFetch('/api/tickets/bulk-archive', ...)`.
  2. When `agentId === 'unassign'`, send `agentId: null`; otherwise send `agentId: Number(agentId)`.
  3. Show toast notifications via `useNotifications().addNotification(...)` on success and error.

### 1.4 Fix Excel Export Crash in `AnalyticsPage.tsx`
- **File**: `frontend/src/pages/AnalyticsPage.tsx` (lines 100–120)
- **Problem**: `apiFetch('/api/analytics/export')` already returns a `Blob`, so calling `await response.blob()` throws `TypeError: response.blob is not a function`.
- **Required Fix**: Use `const blob = await apiDownload('/api/analytics/export');` from `../core/api.ts`.

### 1.5 Allow `supervisor` and `agent` to Fetch Department Agents for Ticket Assignment
- **Files**:
  - `backend/src/modules/admin/controllers/admin-users.controller.ts`
  - `frontend/src/pages/tickets/InboxPage.tsx`
  - `frontend/src/pages/tickets/TicketDetailsPage.tsx`
- **Problem**: `AdminUsersController` is locked to `@Roles('super_admin')`, so `GET /api/admin/users` returns `403` for supervisors and agents, leaving the agent assignment dropdown empty.
- **Required Fix**:
  1. In `AdminUsersController.findAll` (`@Get()`), add `@Roles('super_admin', 'supervisor', 'agent')` and inject `@Req() req: any`.
  2. If `req.user.role !== 'super_admin'`, filter `where: { deletedAt: null, isActive: true, departmentId: req.user.departmentId ?? -1 }`.
  3. Always strip `passwordHash` from every user returned by `findAll()`!
  4. In `TicketDetailsPage.tsx` (line 138), pass `enabled: Boolean(user && user.role !== 'end_user')` to the `['admin', 'users']` `useQuery`.

### 1.6 Fix `isAgent` Role Check, Confirm Resolution Button, Unassign (`null`), and End-User Navigation
- **Files**:
  - `frontend/src/pages/tickets/TicketDetailsPage.tsx`
  - `frontend/src/pages/tickets/NewTicketPage.tsx`
  - `frontend/src/core/hooks/useTickets.ts`
- **Required Fix**:
  1. In `TicketDetailsPage.tsx`:
     ```ts
     const userDeptId = user?.departmentId ?? user?.department?.id ?? null;
     const isAgent = user?.role === 'super_admin' || ((user?.role === 'supervisor' || user?.role === 'agent') && Number(ticket.departmentId) === Number(userDeptId));
     const canConfirmResolution = ticket.status === 'resolved' && Number(ticket.createdById) === Number(user?.id);
     ```
  2. Render the **Confirm Resolution** button whenever `canConfirmResolution` is `true` (even if the creator is also an agent/supervisor in the same department!).
  3. In `TicketDetailsPage.tsx`, update `handleAssign`: if `agentIdStr === ''`, pass `null` instead of `parseInt('', 10)` (`NaN`), and update `useAssignTicket` in `useTickets.ts` to accept `agentId: number | null`.
  4. In `TicketDetailsPage.tsx`, make the Back button navigate to `user?.role === 'end_user' ? '/my-tickets' : '/inbox'`.
  5. In `NewTicketPage.tsx` (line 183), after creating a ticket, navigate to `/tickets/${data.id}` (or `user?.role === 'end_user' ? '/my-tickets' : '/inbox'`).

## Phase 2: Business Logic Completion, Security & Backend Hardening (P1)

### 2.1 Fix `DeptTransferAllowlist` Blocking All Transfers & Add Transfer Allowlist Management
- **Files**:
  - `backend/src/modules/tickets/tickets.service.ts`
  - `backend/src/modules/admin/controllers/admin-departments.controller.ts`
  - `frontend/src/pages/admin/DepartmentsPage.tsx`
  - `frontend/src/pages/tickets/TicketDetailsPage.tsx`
- **Problem**:
  1. `TicketsService.transfer()` checks `deptTransferAllowlist.findFirst({ where: { sourceDeptId, targetDeptId, isActive: true } })`. Because no allowlist rows are seeded and no Admin UI exists to manage them, **every transfer by a supervisor or agent fails with `403 TRANSFER_NOT_ALLOWED`**!
  2. `TicketDetailsPage.tsx` transfer modal shows all departments including `SENDER_ONLY` and inactive departments.
  3. `AdminDepartmentsController.findAll()` returns soft-deleted departments (`deletedAt !== null`), and `DepartmentsPage.tsx` lacks a delete/deactivate button and `slaHours` input.
- **Required Fix**:
  1. In `TicketsService.transfer()` (lines 469–480):
     - First verify `targetDept.isActive && !targetDept.deletedAt && (targetDept.deptType === 'RECEIVER_ONLY' || targetDept.deptType === 'BOTH')`. If not, throw `BadRequestException('Target department cannot receive tickets')`.
     - For `userRole !== 'super_admin'`, check how many active allowlist rules exist for `sourceDeptId: ticket.departmentId`:
       ```ts
       const configuredRulesCount = await this.prisma.deptTransferAllowlist.count({
         where: { sourceDeptId: ticket.departmentId, isActive: true },
       });
       if (configuredRulesCount > 0) {
         const allowed = await this.prisma.deptTransferAllowlist.findFirst({
           where: { sourceDeptId: ticket.departmentId, targetDeptId: parseInt(targetDeptId), isActive: true },
         });
         if (!allowed) {
           throw new ForbiddenException({ message: 'This department is not on the allowed transfer list for your department', code: 'TRANSFER_NOT_ALLOWED' });
         }
       }
       ```
       This ensures transfers work out-of-the-box when no restriction rules are configured, while strictly enforcing the allowlist whenever rules are configured for a department!
  2. In `AdminDepartmentsController`:
     - Filter `findAll()` by `where: { deletedAt: null }` and include `allowedTransferTargets: { where: { isActive: true } }`.
     - In `create()` and `update()`, accept an optional `allowedTransferTargetIds?: number[]` array and sync `deptTransferAllowlist` for that department.
  3. In `DepartmentsPage.tsx`:
     - Add `slaHours` (number input, default 24) to the Add/Edit Department modal.
     - Add a multi-select checkbox list for **"Allowed Transfer Targets / الأقسام المسموح بالتحويل إليها"** (optional — leave empty to allow all receiving departments).
     - Add a Delete/Deactivate button on each department card calling `DELETE /api/admin/departments/:id`.
  4. In `TicketDetailsPage.tsx` (line 567):
     - Filter the Transfer Modal department options to `departments.filter(d => d.id !== ticket.departmentId && d.isActive !== false && (d.deptType === 'RECEIVER_ONLY' || d.deptType === 'BOTH' || !d.deptType))`.

### 2.2 Add Creator "Reopen / Issue Not Resolved" (`رفض الحل / إعادة فتح`) Workflow
- **Files**:
  - `backend/src/modules/tickets/tickets.service.ts`
  - `frontend/src/pages/tickets/TicketDetailsPage.tsx`
  - `frontend/src/core/translations.ts`
- **Problem**: When a ticket is `resolved`, the requester (`createdById === userId`) can confirm resolution (`resolved -> closed`), but if the issue was not fixed, an `end_user` is blocked from reopening (`resolved -> in_progress`) because `updateStatus` checks `ticket.status === 'resolved'` lock and `checkTicketPermission`.
- **Required Fix**:
  1. In `TicketsService.updateStatus()` (line 361):
     - Allow the ticket creator (`Number(ticket.createdById) === Number(userId)`) OR a department agent/supervisor (`hasPermission`) to transition a ticket from `resolved` to `in_progress` (reopen)!
     - Specifically:
       ```ts
       const isCreatorReopening = ticket.status === 'resolved' && status === 'in_progress' && Number(ticket.createdById) === Number(userId);
       if ((ticket.status === 'closed' || (ticket.status === 'resolved' && status !== 'in_progress')) && userRole !== 'super_admin') {
         throw new ForbiddenException({ message: 'Ticket is locked. Only Super Admin can modify closed or resolved tickets via this endpoint.' });
       }
       if (!isCreatorReopening) {
         const hasPermission = await this.checkTicketPermission(userId, userRole, userDeptId ? Number(userDeptId) : null, ticket.departmentId, 'canChangeStatus');
         if (!hasPermission) throw new ForbiddenException({ message: 'You do not have permission to update ticket status' });
       }
       ```
  2. In `TicketDetailsPage.tsx`:
     - Next to the **Confirm Resolution (`تأكيد الحل`)** button (and inside the Confirm Resolution modal as a secondary action), provide a **"Reopen Ticket / إعادة فتح التذكرة"** button for the creator when `ticket.status === 'resolved'` that calls `handleStatusChange('in_progress', { comment: feedback || 'Reopened by requester' })`.

### 2.3 Prevent Leaking Internal Agent Notes (`internal_note`) to End Users
- **File**: `backend/src/modules/tickets/tickets.service.ts`
- **Required Fix**:
  1. In `findById()`, compute `const canSeeInternalNotes = isAdmin || (isDeptMember && (userRole === 'supervisor' || userRole === 'agent'));`. Filter `ticket.messages` so `messageType !== 'internal_note'` when `!canSeeInternalNotes`.
  2. In `addComment()`, only allow `isInternal` to be `true` when `userRole !== 'end_user'`. When `messageType === 'internal_note'`, do **not** emit `new-comment` to `ticket.createdById` unless `ticket.createdById` is a member of `ticket.departmentId` with agent/supervisor role.

### 2.4 Wire Team Feed Post Deletion (`TeamFeedPage.tsx`)
- **File**: `frontend/src/pages/TeamFeedPage.tsx`
- **Problem**: Line 325 renders a dead `<MoreHorizontal size={20} />` button on every post, while `DELETE /api/team-notes/:id` is already implemented on the backend.
- **Required Fix**:
  1. Add a `deleteNote` mutation calling `apiFetch(\`/api/team-notes/\${noteId}\`, { method: 'DELETE' })` and invalidating `['team-notes']`.
  2. When `user?.id === note.author.id || user?.role === 'super_admin'`, render a delete button (`Trash2` icon) on the post header that confirms and deletes the post.

### 2.5 Harden CSRF Middleware, `trust proxy`, and Healthcheck HTTP 503
- **Files**:
  - `backend/src/main.ts`
  - `backend/src/common/health/health.controller.ts`
- **Required Fix**:
  1. In `backend/src/main.ts`:
     - Set `app.getHttpAdapter().getInstance().set('trust proxy', 1);`.
     - Change `getSessionIdentifier: () => ''` in `doubleCsrf({...})` so Cloudflare/mobile IP rotation does not invalidate active CSRF tokens.
     - Only call `csrfProtection.generateToken(req, res)` when `req.path === '/api/health' || !req.cookies?.['csrf-internal'] || !req.cookies?.['x-csrf-token']` so concurrent requests do not overwrite each other's CSRF cookies.
  2. In `backend/src/common/health/health.controller.ts`:
     - Throw `new ServiceUnavailableException({ status: 'error', message: 'Database connection failed', timestamp: new Date().toISOString() })` inside `catch` so Coolify/Docker receives HTTP `503`.

### 2.6 Add Self-Service Password Change Card (`UserProfilePage.tsx`) & `forcePasswordChange` Alert
- **Files**:
  - `backend/src/modules/auth/auth.service.ts`
  - `backend/src/modules/users/users.service.ts`
  - `backend/src/modules/profile/profile.service.ts`
  - `frontend/src/pages/UserProfilePage.tsx`
  - `frontend/src/App.tsx`
- **Required Fix**:
  1. Return `forcePasswordChange: user.forcePasswordChange` and `email: user.email` in `AuthService.login()`, `UsersService.getMe()`, and `ProfileService.getProfile()`.
  2. In `UserProfilePage.tsx`, add a **"Change Password / تغيير كلمة المرور"** card that submits `{ currentPassword, newPassword }` to `POST /api/profile/password`, validates the 12-character policy (uppercase, lowercase, digit), and signs the user out with a success toast upon completion.
  3. In `App.tsx`, if `user.forcePasswordChange` is `true`, display a clickable warning banner at the top of `<main>` directing the user to `/profile` to update their temporary password.

### 2.7 Persist Notifications in DB, Sync `NotificationProvider.tsx`, & Add Subtle Audio Alert
- **Files**:
  - `backend/src/modules/tickets/tickets.service.ts`
  - `frontend/src/core/NotificationProvider.tsx`
- **Required Fix**:
  1. In `TicketsService`: create `prisma.notification` rows on ticket assignment (`TICKET_ASSIGNED`), status change (`STATUS_CHANGED`), and public comments (`NEW_COMMENT`) so notifications survive page refreshes.
  2. In `NotificationProvider.tsx`:
     - Fetch `GET /api/notifications?limit=30` on login and merge with live Socket.IO notifications.
     - Call `PUT /api/notifications/:id/read` and `PUT /api/notifications/read-all` when marking notifications as read.
     - Play a gentle, short Web Audio API chime (`AudioContext` sine wave beep, wrapped in `try/catch`) when a real-time toast arrives.

### 2.8 Add Real KPI Badges, Working Date Range Filter, & Work Order Print View
- **Files**:
  - `backend/src/modules/analytics/analytics.controller.ts`
  - `backend/src/modules/analytics/analytics.service.ts`
  - `frontend/src/pages/DashboardPage.tsx`
  - `frontend/src/pages/AnalyticsPage.tsx`
  - `frontend/src/pages/tickets/TicketDetailsPage.tsx`
  - `frontend/src/index.css`
- **Required Fix**:
  1. In `DashboardPage.tsx` and `AnalyticsPage.tsx`, replace the hardcoded `12%` / `+12%` badges on KPI cards with real computed percentages from `stats` (e.g. resolution rate `Math.round((stats.resolved / Math.max(stats.total, 1)) * 100) + '%'`).
  2. In `DashboardPage.tsx` line 365, fix `item.priority === 'medium'` to `item.priority === 'normal'`.
  3. Connect the period filter (`7d` / `30d` / `all`) in `DashboardPage.tsx` and `AnalyticsPage.tsx` to pass `?days=7` or `?days=30` to `/api/analytics/dashboard-summary` (and support optional `days` filtering in `AnalyticsController` / `AnalyticsService`).
  4. In `TicketDetailsPage.tsx`, add a **"Print / طباعة"** button (`Printer` icon from `lucide-react`) that calls `window.print()`, and add `@media print` rules in `frontend/src/index.css` to hide `<aside>`, `<header>`, and the comment form while formatting the ticket details card cleanly on A4 paper.

## Phase 3: ABCH Brand Identity, Color System & Visual Polish (P2)

### 3.1 Harmonize Brand Colors with Official `ABCH` Gold & Silver Logo (`logo.png`)
- **Files**:
  - `frontend/index.html`
  - `frontend/src/index.css`
  - `frontend/src/pages/Login.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/pages/admin/AssetManagementPage.tsx`
  - `frontend/src/pages/tickets/ArchivePage.tsx`
  - `frontend/src/pages/tickets/TransferredPage.tsx`
  - `frontend/src/pages/KnowledgeBasePage.tsx`
- **Problem**:
  1. `frontend/public/logo.png` features Warm Champagne Gold (`#C8925A` – `#DDB080`) for `ABC` and Platinum Silver (`#C3C5C7`) + White (`#FEFEFE`) for `[H]` and `ABC HOSPITAL`. On a white card in Light Mode, the white `H` and light silver `ABC HOSPITAL` text lose contrast.
  2. `frontend/index.html` lines 14 & 20 reference `/logo-512x512.png` (which does not exist; the file is `/favicon-512x512.png`).
  3. `AssetManagementPage.tsx` line 154 has a broken class typo `bg-[var(--bg-main)]0/10`.
  4. `ArchivePage.tsx` and `TransferredPage.tsx` use raw Tailwind colors (`bg-blue-600`, `bg-yellow-100`) instead of the design system classes (`premium-card`, `input-surface`, `bg-primary-blue`).
  5. `KnowledgeBasePage.tsx` line 269 uses `prose-invert` unconditionally, making article text low-contrast in Light Mode.
- **Required Fix**:
  1. In `frontend/index.html`: change `/logo-512x512.png` to `/favicon-512x512.png` in both `og:image` and `twitter:image`.
  2. In `frontend/src/index.css`:
     - Add brand gold variables to `@theme`:
       `--color-brand-gold: #C8925A;`
       `--color-brand-gold-light: #E2B886;`
     - Add a `.logo-badge` utility class that gives the logo a refined dark-slate/warm-gold bordered container (`bg-[#0F172A] dark:bg-white/5 border border-[#C8925A]/30 rounded-2xl p-2 shadow-md`) so the Champagne Gold `ABC`, Silver `[H]`, and `ABC HOSPITAL` text have crisp, high-contrast visibility in both Light Mode and Dark Mode!
  3. Apply `.logo-badge` to the logo container in `Login.tsx` (line 69) and `App.tsx` sidebar header (line 237), and add a subtle gold accent glow (`bg-[#C8925A]/10`) to `Login.tsx`.
  4. In `AssetManagementPage.tsx` line 154: fix `bg-[var(--bg-main)]0/10` to `bg-slate-500/10`.
  5. In `ArchivePage.tsx` and `TransferredPage.tsx`: align table cards, search inputs, status/priority badges, and pagination buttons with `InboxPage.tsx` (`premium-card`, `input-surface`, `bg-primary-blue`).
  6. In `KnowledgeBasePage.tsx` line 269: replace `prose prose-invert max-w-none text-[var(--text-secondary)]` with `prose dark:prose-invert max-w-none text-[var(--text-main)]`.

## Phase 4: Full RTL Localization & Multi-Screen Responsiveness (Mobile / Tablet / Desktop)

### 4.1 Fix Mobile Sidebar Drawer State & Breakpoint Mismatch
- **Files**:
  - `frontend/src/App.tsx`
  - `frontend/src/index.css`
- **Problem**:
  1. In `App.tsx` (line 169), `sidebarOpen` defaults to `false`, but `handleResize` sets `if (window.innerWidth >= 1024) setSidebarOpen(true)`. Because desktop already uses `<div className="hidden lg:flex w-64 shrink-0">{sidebar}</div>` (which doesn't even read `sidebarOpen`!), setting `sidebarOpen = true` on desktop causes the mobile drawer + dark overlay to pop open whenever a user resizes below `1024px` or rotates a tablet!
  2. In `index.css` (line 156), `@media (max-width: 1024px)` conflicts with Tailwind's `lg:` (`>= 1024px`) at exactly `1024px` width.
- **Required Fix**:
  1. In `App.tsx`, `sidebarOpen` must only control the mobile drawer: change `handleResize` to `if (window.innerWidth >= 1024) setSidebarOpen(false);`.
  2. In `index.css`, change `@media (max-width: 1024px)` to `@media (max-width: 1023.98px)`.

### 4.2 Fix Touch-Device Invisible Action Buttons (`opacity-0 group-hover:opacity-100`)
- **Files**:
  - `frontend/src/pages/admin/BuildingsPage.tsx`
  - `frontend/src/pages/admin/TicketTypesPage.tsx`
  - `frontend/src/pages/admin/AssetManagementPage.tsx`
  - `frontend/src/pages/admin/UserManagementPage.tsx`
  - `frontend/src/pages/KnowledgeBasePage.tsx`
  - `frontend/src/pages/tickets/TicketDetailsPage.tsx`
- **Problem**: Edit/Delete/Unlink buttons use `opacity-0 group-hover:opacity-100`, making them invisible on mobile and tablet touchscreens where hover does not exist.
- **Required Fix**: Change `opacity-0 group-hover:opacity-100` to `opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100` across all 6 files.

### 4.3 Fix Mobile Overflows in `TicketDetailsPage`, `NewTicketPage`, `InboxPage`, `AuditLogPage`, and `App.tsx` Header
- **Files**:
  - `frontend/src/App.tsx`
  - `frontend/src/pages/tickets/TicketDetailsPage.tsx`
  - `frontend/src/pages/tickets/NewTicketPage.tsx`
  - `frontend/src/pages/tickets/InboxPage.tsx`
  - `frontend/src/pages/AuditLogPage.tsx`
- **Required Fix**:
  1. **`App.tsx` Notification Dropdown (line 320)**: Change positioning/width to `max-sm:fixed max-sm:inset-x-3 max-sm:top-16 max-sm:w-auto sm:absolute sm:top-12 sm:end-0 sm:w-80` so it never clips off mobile screens.
  2. **`TicketDetailsPage.tsx` Action Bar (line 454)**: Change `<div className="flex items-center gap-3">` to `<div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">` so the Assign select, Transfer/Archive/Print/Share buttons, and status buttons wrap cleanly on mobile and tablet screens.
  3. **`NewTicketPage.tsx` Location Grid (lines 229–282) & Priority Buttons (line 340)**:
     - Flatten the Location card fields (`Building`, `Floor`, `Room/Ext`, `Related Asset`) into a single `grid grid-cols-1 sm:grid-cols-2 gap-6` (removing the cramped nested 2-column div inside the 3rd column).
     - Change the Priority buttons grid from `grid-cols-4 gap-4` to `grid-cols-2 sm:grid-cols-4 gap-3` and display localized priority labels (`t.low`, `t.normal`, `t.high`, `t.critical`).
  4. **`InboxPage.tsx` Filters & Bulk Bar (lines 256 & 398)**:
     - Make the search input `w-full sm:w-64` and the creator filter `w-full sm:w-40`.
     - Add `flex-wrap gap-3` to the Bulk Actions bar so bulk controls wrap cleanly on mobile screens.
  5. **`AuditLogPage.tsx` Diff Grid (line 141)**:
     - Change `grid-cols-[120px_1fr_auto_1fr]` to `grid-cols-1 sm:grid-cols-[120px_1fr_auto_1fr]`.

### 4.4 Complete RTL Logical Properties, Translations & SPA Navigation
- **Files**: All pages in `frontend/src/` and `frontend/src/core/translations.ts`
- **Required Fix**:
  1. In `frontend/src/core/translations.ts`:
     - Fix corrupted characters on line 550 (`noRelatedTickets: 'لا توجد تذاكر مرتبطة'`) and line 639 (`dismissDetail: 'إغلاق التفاصيل'`).
     - Add localized priority keys (`low`, `normal`, `high`, `critical`), password change keys, reopen keys, and print keys in both `en` and `ar`.
  2. Replace `text-left` with `text-start` and `text-right` with `text-end` on all tables across `DashboardPage`, `AnalyticsPage`, `AuditLogPage`, `InboxPage`, `MyTicketsPage`, `AssetManagementPage`, `FloorsPage`, and `UserManagementPage`.
  3. In `App.tsx`, replace `border-r` on `<aside>` with `border-e`, and `border-l pl-2 sm:pl-4` in `<header>` with `border-s ps-2 sm:ps-4`.
  4. In `TicketDetailsPage.tsx` (lines 593–600), replace `before:left-4`, `pl-10`, `left-0` on the Transfer History timeline with `before:start-4`, `ps-10`, `start-0`.
  5. Replace `window.location.href` in `DashboardPage.tsx` (lines 199 & 425) with `window.dispatchEvent(new CustomEvent('navigate', { detail: ... }))`, and wire the dead buttons in `KnowledgeBasePage.tsx` (`Create a Ticket`, `Ask a Question`, `Share`, `Helpful`, and initial `?search=` URL param).

## Phase 5: Verification & Git Push

1. Run `cd backend && npx prisma generate && npm run build` and verify zero TypeScript compilation errors.
2. Run `cd frontend && npm run type-check && npm run build` and verify zero TypeScript or Vite build errors.
3. Stage all modified files (`git add -A`), commit with:
   `feat: complete production logic, RBAC, ABCH brand identity, RTL, and multi-screen responsiveness`
4. Push directly to `origin main`.
