# Production Hardening, Bug Fix & UI/UX Polish Prompt for Antigravity Argon (`abdullah0samy/ABCH-T.S-PRO`)

You are an autonomous Principal Full-Stack Engineer (NestJS 11 + Prisma 6 + PostgreSQL + Redis/BullMQ + Socket.IO + React 19 + TypeScript + Tailwind CSS v4). Your mission is to execute a complete, zero-regression production hardening, bug-fix, and UI/UX/RTL polish pass on this repository (`abdullah0samy/ABCH-T.S-PRO`), verify that both `backend` and `frontend` compile cleanly (`tsc --noEmit` and `npm run build`), run tests, and commit/push the changes to GitHub (`main` branch).

## Strict Execution Rules

1. **Zero Hallucinations & Exact File Grounding**: Every task below cites exact files, functions, and line numbers verified against the current repository snapshot. Read each target file before modifying it.
2. **Preserve Existing Architecture**: Keep the existing NestJS modular structure, Prisma schema compatibility, in-memory access token + `httpOnly` refresh cookie flow, and Tailwind CSS v4 variable theme system (`--bg-main`, `--bg-surface`, `--text-main`, etc.).
3. **Verify Before Finishing**: After completing all phases, run `npm run build` in `backend/` and `npm run type-check && npm run build` in `frontend/` to guarantee zero TypeScript or bundler errors before committing.

## Overview of Issues to Fix

| Priority | ID | Area | Issue Summary | Target Files |
| :--- | :--- | :--- | :--- | :--- |
| P0 | BUG-01 | Frontend / Admin | `ReferenceError: roles is not defined` crashes User Management modal on open | `frontend/src/pages/admin/UserManagementPage.tsx` |
| P0 | BUG-02 | Backend / Validation | `numericString` (`^\d+$`) & strict `permissionsOverride` schema break creating/editing alphanumeric users (`admin`, `supervisor`) | `backend/src/common/schemas/users.schema.ts`, `frontend/src/pages/admin/UserManagementPage.tsx` |
| P0 | BUG-03 | Frontend / Inbox | Bulk Assign & Bulk Archive use raw `fetch()` without CSRF token or `credentials: 'include'`, failing with `403 CSRF_INVALID` | `frontend/src/pages/tickets/InboxPage.tsx` |
| P0 | BUG-04 | Frontend / Analytics | Excel export calls `response.blob()` on an already-parsed `Blob` from `apiFetch`, throwing `TypeError` | `frontend/src/pages/AnalyticsPage.tsx` |
| P0 | BUG-05 | Backend & Frontend / RBAC | `GET /api/admin/users` is locked to `super_admin`, breaking agent assignment dropdowns for `supervisor` and `agent` roles | `backend/src/modules/admin/controllers/admin-users.controller.ts`, `frontend/src/pages/tickets/InboxPage.tsx`, `frontend/src/pages/tickets/TicketDetailsPage.tsx` |
| P0 | BUG-06 | Frontend / Ticket Workflow | `isAgent` logic ignores `user.role === 'end_user'` and blocks creators from confirming resolution if they are in the same department | `frontend/src/pages/tickets/TicketDetailsPage.tsx`, `frontend/src/pages/tickets/NewTicketPage.tsx` |
| P1 | SEC-01 | Backend / Security | Internal agent notes (`messageType === 'internal_note'`) are leaked to `end_user` in `GET /api/tickets/:id` | `backend/src/modules/tickets/tickets.service.ts` |
| P1 | SEC-02 | Backend / CSRF & Proxy | `doubleCsrf` binds to volatile `req.ip`, lacks `trust proxy`, and overwrites CSRF cookies on every POST/PUT request | `backend/src/main.ts` |
| P1 | OPS-01 | Backend / Healthcheck | `GET /api/health` returns HTTP `200 OK` even when PostgreSQL is down, blinding Coolify/Docker healthchecks | `backend/src/common/health/health.controller.ts` |
| P1 | FEAT-01 | Full-Stack / Profile & Auth | Self-service password change UI is missing in `UserProfilePage.tsx` and `forcePasswordChange` is not returned on login/me | `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/users/users.service.ts`, `frontend/src/pages/UserProfilePage.tsx`, `frontend/src/App.tsx` |
| P1 | FEAT-02 | Full-Stack / Notifications | Persistent DB notifications are not created on ticket events and `/api/notifications` is never loaded by `NotificationProvider` | `backend/src/modules/tickets/tickets.service.ts`, `frontend/src/core/NotificationProvider.tsx` |
| P2 | UI-01 | Frontend / RTL & Layout | Hardcoded `text-left`, `left-3`, `pl-10`, `border-r`, and timeline positioning break Arabic RTL layout across pages | Multiple files in `frontend/src/` |
| P2 | UI-02 | Frontend / UX & Dead Buttons | Corrupted Arabic characters (``) in `translations.ts`, full-page reloads (`window.location.href`), dead buttons, and raw `alert()` calls | `frontend/src/core/translations.ts`, `DashboardPage.tsx`, `KnowledgeBasePage.tsx`, `AnalyticsPage.tsx`, `NewTicketPage.tsx` |

## Phase 1: Fix P0 Runtime Crashes & Broken Workflows

### 1.1 Fix `ReferenceError: roles is not defined` and Payload Sanitization in `UserManagementPage.tsx`
- **File**: `frontend/src/pages/admin/UserManagementPage.tsx`
- **Problem**:
  1. Lines 380–392 reference an undefined `roles` variable (`roles.find(...)` and `{roles.map(...)}`) left over from the deprecated relational Role model, crashing the page whenever the Add/Edit User modal opens.
  2. In `handleSubmit`, `saveUser({ id: currentUser?.id, data: currentUser })` sends the entire `User` row (including `id`, `department`, `userRole`, and `permissionsOverride.id` / `permissionsOverride.userId` / `permissionsOverride.allowedTransferDeptIds`) directly to `PUT /api/admin/users/:id`, which fails Zod validation on the backend.
- **Required Fix**:
  1. Remove the unused `Role` interface and replace the role `<select>` in `UserManagementPage.tsx` so it binds cleanly to `currentUser?.role || 'end_user'` with options `'end_user'`, `'agent'`, `'supervisor'`, and `'super_admin'` (no `roles.map` or `roleId`).
  2. Add all 13 permission override keys from `DeptPermissions` to `permissionKeys` in `UserManagementPage.tsx` (matching `RoleManagementPage.tsx`: `canReceiveTickets`, `canSendTickets`, `canViewAllDeptTickets`, `canAssignTickets`, `canChangeStatus`, `canTransferTickets`, `canArchiveTickets`, `canExportData`, `canViewAnalytics`, `canManageTeamNotes`, `canManageDeptUsers`, `canViewAuditLogs`, `canManageKnowledgeBase`).
  3. In `handleSubmit`, construct a clean payload before calling `saveUser`:
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
- **Problem**: `numericString` enforces `/^\d+$/`, which rejects valid usernames/badges like `admin`, `supervisor`, `agent`, `user`, or `EMP-001` that `auth.schema.ts` (`/^[a-zA-Z0-9_.-]+$/`) and `seed-local.ts` explicitly use. Also, `email` rejects empty string `""` if not preprocessed to `null`.
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
  3. Allow `permissionsOverrideSchema` to strip non-boolean keys or accept `z.record(z.string(), z.boolean().nullable().optional()).optional()`.

### 1.3 Fix Bulk Assign & Bulk Archive CSRF Failures in `InboxPage.tsx`
- **File**: `frontend/src/pages/tickets/InboxPage.tsx` (lines 145–191)
- **Problem**: `handleBulkAssign` and `handleBulkArchive` use raw `fetch(apiUrl(...))` without `credentials: 'include'` or `x-csrf-token`, causing `403 Forbidden` on every call.
- **Required Fix**:
  1. Refactor `handleBulkAssign` to use `apiFetch`:
     ```ts
     await apiFetch('/api/tickets/bulk-assign', {
       method: 'POST',
       body: JSON.stringify({
         ticketIds: selectedTickets,
         agentId: agentId === 'unassign' ? null : Number(agentId),
       }),
     });
     setSelectedTickets([]);
     queryClient.invalidateQueries({ queryKey: queryKeys.tickets.lists() });
     ```
  2. Refactor `handleBulkArchive` to use `apiFetch`:
     ```ts
     await apiFetch('/api/tickets/bulk-archive', {
       method: 'POST',
       body: JSON.stringify({ ticketIds: selectedTickets }),
     });
     setSelectedTickets([]);
     queryClient.invalidateQueries({ queryKey: queryKeys.tickets.lists() });
     ```
  3. Surface any errors via `useNotifications().addNotification({ title: t.error, message: error.message, type: 'error' })`.

### 1.4 Fix Excel Export Crash in `AnalyticsPage.tsx`
- **File**: `frontend/src/pages/AnalyticsPage.tsx` (lines 100–120)
- **Problem**: `apiFetch('/api/analytics/export')` already returns a `Blob`, so `await response.blob()` throws `TypeError: response.blob is not a function`.
- **Required Fix**:
  1. Import `apiDownload` from `../core/api.ts`.
  2. Replace `const response = await apiFetch('/api/analytics/export'); const blob = await response.blob();` with `const blob = await apiDownload('/api/analytics/export');`.
  3. Wire the date range filter button in `AnalyticsPage.tsx` (or pass `startDate` / `endDate` query params) and wire the `"View All"` button to navigate to `/inbox` or expand the full agent list instead of being a dead button.

### 1.5 Allow `supervisor` and `agent` to Fetch Department Agents for Ticket Assignment
- **Files**:
  - `backend/src/modules/admin/controllers/admin-users.controller.ts`
  - `frontend/src/pages/tickets/InboxPage.tsx`
  - `frontend/src/pages/tickets/TicketDetailsPage.tsx`
- **Problem**: `AdminUsersController` is locked to `@Roles('super_admin')` at the controller level, so `GET /api/admin/users` returns `403` when a `supervisor` or `agent` opens `InboxPage` or `TicketDetailsPage`. As a result, supervisors and agents see an empty `Assign To` dropdown.
- **Required Fix**:
  1. In `AdminUsersController.findAll` (`@Get()`), add `@Roles('super_admin', 'supervisor', 'agent')` and inject `@Req() req: any`.
  2. If `req.user.role !== 'super_admin'`, scope the query to `where: { deletedAt: null, isActive: true, departmentId: req.user.departmentId ?? -1 }` and omit `passwordHash` and `permissionsOverride` from every returned user object (`select` safe fields only!). Even for `super_admin`, always strip `passwordHash` from every user in `findAll()`!
  3. In `TicketDetailsPage.tsx` (line 138), only enable the `['admin', 'users']` query when `user?.role !== 'end_user'` (`enabled: Boolean(user && user.role !== 'end_user')`) so `end_user` accounts never trigger unnecessary `403` calls.

### 1.6 Fix `isAgent` Role Check, Confirm Resolution Button Visibility, and End-User Navigation
- **Files**:
  - `frontend/src/pages/tickets/TicketDetailsPage.tsx`
  - `frontend/src/pages/tickets/NewTicketPage.tsx`
- **Problem**:
  1. In `TicketDetailsPage.tsx` (line 410), `const isAgent = ticket.departmentId === (user?.departmentId || user?.department?.id) || user?.role === 'super_admin';` treats an `end_user` who belongs to the same department as an agent, and line 541 (`!isAgent && ticket.status === 'resolved' && ticket.createdById === user?.id`) hides the **Confirm Resolution** button if the ticket creator is also an agent/supervisor/super_admin or in the same department.
  2. In `NewTicketPage.tsx` (line 183), after creating a ticket, all users are redirected to `/inbox` — which `end_user` cannot access (`403 Forbidden`).
  3. In `TicketDetailsPage.tsx` (line 420), the Back button is hardcoded to `/inbox`, which breaks for `end_user`.
- **Required Fix**:
  1. In `TicketDetailsPage.tsx`, define:
     ```ts
     const userDeptId = user?.departmentId ?? user?.department?.id ?? null;
     const isAgent = user?.role === 'super_admin' || ((user?.role === 'supervisor' || user?.role === 'agent') && Number(ticket.departmentId) === Number(userDeptId));
     const canConfirmResolution = ticket.status === 'resolved' && Number(ticket.createdById) === Number(user?.id);
     ```
  2. Render the **Confirm Resolution** button whenever `canConfirmResolution` is `true` (regardless of `isAgent`).
  3. In `TicketDetailsPage.tsx`, make the Back button navigate to `user?.role === 'end_user' ? '/my-tickets' : '/inbox'` (or `window.history.length > 1 ? window.history.back() : ...`).
  4. In `NewTicketPage.tsx`, after creating a ticket (`data`), navigate to `/tickets/${data.id}` (or `user?.role === 'end_user' ? '/my-tickets' : '/inbox'`).
  5. In `TicketDetailsPage.tsx`, fix `handleAssign`: if `agentIdStr === ''`, pass `null` (unassign) instead of `parseInt('', 10)` (`NaN`), and update `useAssignTicket` in `useTickets.ts` to accept `agentId: number | null`.

## Phase 2: Security, Proxy, Healthcheck & Core Feature Completion (P1)

### 2.1 Prevent Leaking Internal Agent Notes (`internal_note`) to End Users
- **File**: `backend/src/modules/tickets/tickets.service.ts`
- **Problem**:
  1. In `findById()` (line 322), `messages` are fetched without filtering out `messageType: 'internal_note'` when the caller is an `end_user` (or not an agent of that department).
  2. In `addComment()` (line 532), `isInternal` is not restricted to agents/supervisors/super_admins, and when `isInternal` is `true`, lines 555 emit `new-comment` via WebSocket to `ticket.createdById` (leaking the internal note in real-time to the end user's browser toast!).
- **Required Fix**:
  1. In `findById()`, determine whether the caller is a department agent/supervisor or `super_admin`:
     ```ts
     const canSeeInternalNotes = isAdmin || (isDeptMember && (userRole === 'supervisor' || userRole === 'agent'));
     ```
     Filter `ticket.messages` before returning (or in the Prisma `messages: { where: ... }` clause) so `messageType !== 'internal_note'` when `!canSeeInternalNotes`.
  2. In `addComment()`, force `const effectiveInternal = (userRole === 'super_admin' || userRole === 'supervisor' || userRole === 'agent') ? Boolean(isInternal) : false;`.
  3. In `addComment()`, do **not** emit `new-comment` to `ticket.createdById` if `effectiveInternal` is `true` and `ticket.createdById` is not a department agent!

### 2.2 Harden CSRF Middleware & Reverse Proxy Handling for Coolify/Cloudflare
- **File**: `backend/src/main.ts`
- **Problem**:
  1. `app` does not configure Express `trust proxy`, and `doubleCsrf` uses `getSessionIdentifier: (req) => req.ip || 'unknown'`, which breaks when Cloudflare edge IPs rotate or behind Docker proxies.
  2. The middleware right after `app.use(csrfProtection.doubleCsrfProtection)` calls `csrfProtection.generateToken(req, res)` on **every** incoming request, overwriting the `csrf-internal` cookie on every parallel API call and causing race conditions.
- **Required Fix**:
  1. Enable trust proxy on the underlying Express instance when behind a reverse proxy:
     ```ts
     const expressApp = app.getHttpAdapter().getInstance();
     expressApp.set('trust proxy', 1);
     ```
  2. In `doubleCsrf({...})`, change `getSessionIdentifier: () => ''` so CSRF validation relies on the cryptographic HMAC binding between the `httpOnly` `csrf-internal` cookie and the `x-csrf-token` header without failing when a hospital user's IP shifts across Wi-Fi/Cloudflare edges.
  3. In the token-setting middleware, only generate a new token if `req.cookies?.['csrf-internal']` or `req.cookies?.['x-csrf-token']` is missing, OR when `req.path === '/api/health'`:
     ```ts
     app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
       if (req.path === '/api/health' || !req.cookies?.['csrf-internal'] || !req.cookies?.['x-csrf-token']) {
         const token = csrfProtection.generateToken(req, res);
         res.cookie('x-csrf-token', token, {
           sameSite: 'strict',
           secure: process.env.NODE_ENV === 'production',
           path: '/',
         });
       }
       next();
     });
     ```

### 2.3 Return Proper HTTP 503 on Healthcheck Failure
- **File**: `backend/src/common/health/health.controller.ts`
- **Problem**: When `this.prisma.$queryRaw` fails, `check()` returns `{ status: 'error' }` with HTTP `200 OK`, so Docker/Coolify healthchecks never detect an unhealthy container.
- **Required Fix**: Throw `new ServiceUnavailableException({ status: 'error', message: 'Database connection failed', timestamp: new Date().toISOString() })` in the `catch` block so HTTP `503` is returned.

### 2.4 Wire Self-Service Password Change in `UserProfilePage.tsx` and `forcePasswordChange` Support
- **Files**:
  - `backend/src/modules/auth/auth.service.ts`
  - `backend/src/modules/users/users.service.ts`
  - `backend/src/modules/profile/profile.service.ts`
  - `frontend/src/pages/UserProfilePage.tsx`
  - `frontend/src/core/translations.ts`
- **Problem**:
  1. `POST /api/profile/password` exists on the backend, but `UserProfilePage.tsx` has no UI section for users to change their password.
  2. `auth.service.ts` (`login`), `users.service.ts` (`getMe`), and `profile.service.ts` (`getProfile`) do not return `forcePasswordChange` or `email` consistently.
- **Required Fix**:
  1. Include `forcePasswordChange: user.forcePasswordChange` and `email: user.email` in the user object returned by `AuthService.login()`, `UsersService.getMe()`, and `ProfileService.getProfile()`.
  2. In `UserProfilePage.tsx`, add a clean **"Change Password" / "تغيير كلمة المرور"** card below the profile details card that calls `POST /api/profile/password` with `{ currentPassword, newPassword }`, validates password rules (min 12 chars, uppercase, lowercase, number), and upon success shows a notification and logs the user out cleanly to sign in with their new password.
  3. If `user.forcePasswordChange` is `true`, display a prominent warning banner at the top of `App.tsx` (or redirect to `/profile`) prompting the user to change their temporary password.

### 2.5 Persist Ticket Notifications in PostgreSQL & Load Them in `NotificationProvider.tsx`
- **Files**:
  - `backend/src/modules/tickets/tickets.service.ts`
  - `frontend/src/core/NotificationProvider.tsx`
- **Problem**:
  1. `TicketsService` emits Socket.IO events on `create`, `updateStatus`, `assign`, `transfer`, `addComment`, and `confirmResolution`, but never inserts rows into `prisma.notification`.
  2. `NotificationProvider.tsx` never fetches `GET /api/notifications` on startup and never calls `PUT /api/notifications/:id/read` or `PUT /api/notifications/read-all` when the user marks notifications as read.
- **Required Fix**:
  1. In `TicketsService`:
     - On `assign` (when `agentId` is set and `Number(agentId) !== userId`): create a `prisma.notification` record for `Number(agentId)` with `eventType: 'TICKET_ASSIGNED'`, `ticketId: ticket.id`, `titleAr: 'تم تعيين تذكرة لك'`, `titleEn: 'Ticket Assigned to You'`, `bodyAr: ...`, `bodyEn: ...`.
     - On `updateStatus`: create a `prisma.notification` record for `ticket.createdById` (if `ticket.createdById !== userId`) with `eventType: 'STATUS_CHANGED'`, `ticketId: ticket.id`, bilingual title/body.
     - On `addComment` (when not an internal note): create a `prisma.notification` record for the counterparty (`ticket.createdById` if sender is agent, or `ticket.assignedToId` if sender is creator).
  2. In `NotificationProvider.tsx`:
     - When `accessToken && user` becomes available, fetch `GET /api/notifications?limit=30` via `apiFetch`, map the returned database notifications (`id: String(n.id)`, `title: language === 'ar' ? n.titleAr : n.titleEn`, `message: language === 'ar' ? n.bodyAr : n.bodyEn`, `read: n.isRead`, `createdAt: new Date(n.createdAt)`, `link: n.ticketId ? \`/tickets/\${n.ticketId}\` : undefined`, `ticketId: n.ticketId`) into state so historical notifications persist across page reloads.
     - In `markAsRead(id)`, if `id` is numeric (`^\d+$`), also fire `apiFetch(\`/api/notifications/\${id}/read\`, { method: 'PUT' }).catch(() => {})`.
     - In `markAllAsRead()`, also fire `apiFetch('/api/notifications/read-all', { method: 'PUT' }).catch(() => {})`.

## Phase 3: UI/UX, RTL Localization & Polish (P2)

### 3.1 Fix Corrupted Arabic Strings & Missing Translation Keys in `frontend/src/core/translations.ts`
- **File**: `frontend/src/core/translations.ts`
- **Required Fix**:
  1. Line 550: Fix `noRelatedTickets: 'لا توج تذاكر مرتبطة'` -> `noRelatedTickets: 'لا توجد تذاكر مرتبطة'`.
  2. Line 639: Fix `dismissDetail: 'إغلاق التفاصي'` -> `dismissDetail: 'إغلاق التفاصيل'`.
  3. Add translation keys for the new Change Password section (`changePassword`, `currentPassword`, `newPassword`, `confirmNewPassword`, `passwordRequirementsHint`, `passwordChangedSuccess`, `forcePasswordChangeWarning`) in both `en` and `ar`.

### 3.2 Fix RTL Table Alignment, Search Inputs, Sidebar Borders, and Timeline Layout
- **Files**: All pages in `frontend/src/`
- **Required Fix**:
  1. **Tables**: Replace `className="w-full text-left ..."` with `className="w-full text-start ..."` and `text-right` action headers/cells with `text-end` in:
     - `frontend/src/pages/DashboardPage.tsx`
     - `frontend/src/pages/AnalyticsPage.tsx`
     - `frontend/src/pages/AuditLogPage.tsx`
     - `frontend/src/pages/tickets/InboxPage.tsx`
     - `frontend/src/pages/tickets/MyTicketsPage.tsx`
     - `frontend/src/pages/admin/AssetManagementPage.tsx`
     - `frontend/src/pages/admin/FloorsPage.tsx`
     - `frontend/src/pages/admin/UserManagementPage.tsx`
  2. **Sidebar & Header (`frontend/src/App.tsx`)**:
     - Line 235: Change `border-r border-[var(--border-main)]` on `<aside>` to `border-e border-[var(--border-main)]` so the border sits between the sidebar and content in both LTR and RTL.
     - Line 320: Fix notification dropdown positioning so it never overflows the screen (`end-0` or `${language === 'ar' ? 'left-0 sm:right-0' : 'right-0 sm:left-0'}`).
     - Line 361: Change `border-l border-[var(--border-main)] pl-2 sm:pl-4` to `border-s border-[var(--border-main)] ps-2 sm:ps-4` and `ml-2` to `ms-2`.
     - Line 395: Position the Toast Container at `bottom-4 end-4` so toasts appear in the appropriate corner in RTL and LTR.
  3. **Search Inputs (`GlobalSearch.tsx`, `InboxPage.tsx`, `MyTicketsPage.tsx`, `ArchivePage.tsx`, `TransferredPage.tsx`, `AuditLogPage.tsx`, `AssetManagementPage.tsx`, `UserManagementPage.tsx`, `KnowledgeBasePage.tsx`, `DashboardPage.tsx`)**:
     - Use logical positioning (`start-3` or `start-4` for the Search icon, `end-3` for the clear button, and `ps-10 pe-4` / `ps-12 pe-4` on the `<input>`) so the icon never overlaps Arabic text or placeholder in RTL.
  4. **Transfer History Timeline (`frontend/src/pages/tickets/TicketDetailsPage.tsx`, lines 593–625)**:
     - Change `before:left-4` to `before:start-4`, `pl-10` to `ps-10`, and `left-0` to `start-0` so the timeline vertical line and icons sit on the right in RTL and on the left in LTR without overlapping text.

### 3.3 Fix SPA Navigation, Dead Buttons, NewTicket Form Grid, and Replace Raw `alert()` Calls
- **Files**:
  - `frontend/src/pages/DashboardPage.tsx`
  - `frontend/src/pages/KnowledgeBasePage.tsx`
  - `frontend/src/pages/tickets/NewTicketPage.tsx`
  - `frontend/src/pages/admin/DepartmentsPage.tsx`
  - `backend/src/modules/admin/controllers/admin-departments.controller.ts`
- **Required Fix**:
  1. **Eliminate full-page reloads in `DashboardPage.tsx`**:
     - Line 199: Replace `window.location.href = \`/knowledge?search=...\`` with `window.dispatchEvent(new CustomEvent('navigate', { detail: \`/knowledge?search=\${encodeURIComponent((e.target as HTMLInputElement).value)}\` }))`.
     - Line 425: Replace `window.location.href = '/admin/assets'` with `window.dispatchEvent(new CustomEvent('navigate', { detail: '/admin/assets' }))`.
  2. **Fix Dead Buttons in `KnowledgeBasePage.tsx`**:
     - Read initial `?search=` query param from `window.location.search` on mount in `KnowledgeBasePage.tsx` so searching from the Dashboard actually filters the Knowledge Base!
     - Wire the `"Create a Ticket"` button (line 354) and `"Ask a Question"` button (line 283) to `window.dispatchEvent(new CustomEvent('navigate', { detail: '/tickets/new' }))`.
     - Wire the `"Share"` button (line 278) to copy the article URL to the clipboard and trigger `addNotification({ title: t.linkCopiedTitle, message: t.linkCopied, type: 'success' })`.
     - Wire the `"Helpful"` button (line 274) to toggle a helpful state and show a thank-you toast notification.
  3. **Fix Cramped Location Grid in `NewTicketPage.tsx` (lines 229–282)**:
     - Currently `relatedAsset` and `room` are nested inside the 3rd column of a 3-column grid (`grid-cols-1 md:grid-cols-3`), making them half-width. Flatten the Location section into a clean `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6` where `Building`, `Floor`, `Room/Ext`, and `Related Asset` are 4 equal-width sibling columns!
  4. **Add Department Deactivation/Deletion Support in `DepartmentsPage.tsx` & Filter Soft-Deleted Departments**:
     - In `backend/src/modules/admin/controllers/admin-departments.controller.ts`, update `findAll()` to filter `where: { deletedAt: null }`.
     - In `frontend/src/pages/admin/DepartmentsPage.tsx`, add a delete/deactivate button (calling `DELETE /api/admin/departments/:id`) and an SLA Hours (`slaHours`) input field in the Add/Edit Department modal (since the backend already accepts `slaHours` on `POST` and `PUT`!).
  5. **Replace `alert()` with Toast Notifications**:
     - Across admin and ticket pages, replace jarring `alert(...)` calls with `addNotification({ title: ..., message: ..., type: 'error' | 'success' })` from `useNotifications()`.

## Phase 4: Verification & Git Push

1. Run `cd backend && npx prisma generate && npm run build` and verify zero TypeScript compilation errors.
2. Run `cd frontend && npm run type-check && npm run build` and verify zero TypeScript or Vite build errors.
3. Stage all modified files (`git add -A`), commit with a clear message:
   `fix: resolve P0/P1 production bugs, RBAC agent assignment, CSRF proxy handling, internal note privacy, and RTL UI polish`
4. Push directly to `origin main`.
