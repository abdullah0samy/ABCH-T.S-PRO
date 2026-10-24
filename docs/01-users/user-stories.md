# User Stories

> Every story cites code evidence. Status: CONFIRMED = code exists, NOT CONFIRMED = spec claim not found in code, UNKNOWN = incomplete evidence.

---

## Authentication

### US-001: Login with Badge Number or Username
As an authenticated user (any role), I want to log in using my badge number or username and password, so that I can access the hospital ticketing system.
- **CONFIRMED** — `Login.tsx:18-43` identifies user via `identifier` field. `auth.service.ts:28-32` queries `badgeNumber` OR `username`.

### US-002: Account Lockout Protection
As a system administrator, I want accounts to lock after 5 failed login attempts for 15 minutes, so that brute-force attacks are mitigated.
- **CONFIRMED** — `auth.service.ts:56-60`: `newAttempts >= 5` sets `lockUntil = now + 15 * 60 * 1000ms`. HTTP 423 returned (`auth.service.ts:39-43`).

### US-003: Token Refresh
As an authenticated user, I want my access token (8h) to be refreshable via the refresh token (7d), so that my session persists without re-login.
- **CONFIRMED** — Access token: `8h` (`auth.utils.ts:14`). Refresh token: `7d` (`auth.utils.ts:20`). Refresh endpoint: `POST /api/auth/refresh` (`auth.controller.ts:37-46`). Cookie: `maxAge: 7 days` (`auth.controller.ts:23-28`).

### US-004: Logout
As an authenticated user, I want to log out, so that my session is terminated and my refresh token is cleared.
- **CONFIRMED** — `authStore.logout()` clears localStorage + calls `POST /api/auth/logout` (`authStore.ts:17-21`). Backend clears refresh token cookie (`auth.controller.ts:51-57`).

---

## Ticket Creation

### US-005: Create a New Ticket
As a hospital staff member or patient representative, I want to create a support ticket with location, contact info, issue details, and attachments, so that the issue is formally recorded and routed.
- **CONFIRMED** — `NewTicketPage.tsx:30-562`. Fields: subject, description, department, building, floor, room/extension, phone, priority, ticket type, asset, attachments. API: `POST /api/tickets` (`tickets.controller.ts:17-27`).

### US-006: Record Voice Notes as Attachments
As an end user, I want to record voice notes when creating a ticket, so that I can describe the issue more effectively.
- **CONFIRMED** — `NewTicketPage.tsx:168-228`: startRecording/stopRecording using `MediaRecorder`, uploads as `audio/webm`. Backend: `isVoiceNote: true`, `voiceDuration` stored (`tickets.service.ts:159-161`).

### US-007: Knowledge Base Suggestions During Ticket Creation
As a ticket creator, I want to see relevant knowledge base articles while typing my subject/description, so that I can self-resolve or provide more context.
- **CONFIRMED** — `NewTicketPage.tsx:118-135`: Debounced (300ms) call to `GET /api/knowledge/suggest?q=...` on subject/description change. `knowledge.service.ts:87-132`: Suggests up to 3 articles via exact + individual word matching.

### US-008: Floor- Building Cross-Validation
As a ticket creator, I want the system to validate that my selected floor belongs to my selected building, so that location data is accurate.
- **CONFIRMED** — `tickets.service.ts:125-127`: Throws `FLOOR_BUILDING_MISMATCH` if `flr.buildingId !== buildingId`.

### US-009: Supervisor/Agent Department-Scope Restriction on Ticket Creation
As a supervisor or agent, I want to be restricted to creating tickets only for my own department, so that tickets are routed to the correct destination.
- **CONFIRMED** — `tickets.service.ts:120-122`: `CROSS_DEPT_FORBIDDEN` if role is `supervisor`/`agent` and `departmentId !== user.departmentId`.

---

## Ticket Management

### US-010: View Department Inbox
As an agent, I want to see all unarchived tickets in my department with filtering (status, priority, date range, search), so that I can identify and prioritize work.
- **CONFIRMED** — `InboxPage.tsx`. API: `GET /api/tickets/department` with extensive query filters (`tickets.service.ts:209-269`).

### US-011: Assign a Ticket to an Agent
As an agent or supervisor, I want to assign a ticket to a specific team member in my department, so that ownership is clear.
- **CONFIRMED** — `PUT /api/tickets/{id}/assign` → `tickets.service.ts:491-539`. Agent must belong to same department as ticket (unless super_admin: `tickets.service.ts:507-509`).

### US-012: Bulk Assign Tickets
As a supervisor, I want to assign multiple tickets at once to the same agent, so that I can quickly distribute workload.
- **CONFIRMED** — `POST /api/tickets/bulk-assign` → `tickets.service.ts:738-784`. Iterates ticket IDs, checks permissions per ticket.

### US-013: Update Ticket Status
As an agent, I want to transition a ticket through its status workflow (pending → open → in_progress → resolved), so that the ticket progression is tracked.
- **CONFIRMED** — `PUT /api/tickets/{id}/status` → `tickets.service.ts:408-488`. Guards: `ALLOWED_TRANSITIONS` check (`workflow.constants.ts:7-18`), agent required before resolve (`tickets.service.ts:432-434`), ticketType required before resolve/close (`tickets.service.ts:437-439`).

### US-014: Bulk Update Status
As a supervisor, I want to update the status of multiple tickets at once, so that I can efficiently manage batch closures.
- **CONFIRMED** — `POST /api/tickets/bulk-update-status` → `tickets.service.ts:692-735`.

### US-015: Confirm Resolution to Close a Ticket
As a ticket creator, I want to confirm that a resolved ticket satisfies my issue (with optional rating and feedback), so that the ticket transitions to closed.
- **CONFIRMED** — `PUT /api/tickets/{id}/confirm` → `tickets.service.ts:651-689`. Creator-only guard (`tickets.service.ts:657-659`). Sets `rating` and `feedback` fields (`schema.prisma:242-243`).

### US-016: Transfer a Ticket to Another Department
As an agent, I want to transfer a ticket to a different department when it's out of scope for us, so that the ticket reaches the right team.
- **CONFIRMED** — `PUT /api/tickets/{id}/transfer` → `tickets.service.ts:541-600`. Requires `DeptTransferAllowlist` entry (`tickets.service.ts:559-565`). Resets status to `pending`, clears assignment, recalculates SLA (`tickets.service.ts:580-582`).

### US-017: Archive a Ticket
As an agent with archiving permission, I want to manually archive resolved or closed tickets, so that the inbox stays uncluttered.
- **CONFIRMED** — `PUT /api/tickets/{id}/archive` → `tickets.service.ts:909-932`. Requires status = `resolved` or `closed` (`tickets.service.ts:917-918`). Permission via `canArchiveTickets` (`permissionCache.ts:2`); defaults to `false` (`schema.prisma:20`), `supervisor` role defaults to `true` (`tickets.service.ts:34,55`).

### US-018: Super Admin Override
As a super admin, I want to forcibly modify any field on any ticket (including locked tickets), so that I can correct data errors or unlock stuck workflows.
- **CONFIRMED** — `PATCH /api/tickets/{id}` → `tickets.service.ts:935-972`. Strips `ticketNumber`, `id`, `createdAt`. Recalculates SLA if priority/type/dept changes.

---

## Comments and Collaboration

### US-019: Add Comments to a Ticket
As any authorized user, I want to add public or internal notes to a ticket's message thread, so that context builds over time.
- **CONFIRMED** — `POST /api/tickets/{id}/comments` → `tickets.service.ts:603-648`. `messageType`: `public` or `internal_note`. Closed tickets locked for non-super_admin (`tickets.service.ts:612-614`).

### US-020: First Response Timestamp
As an agent, I want the system to record when I make my first response to a ticket, so that response-time SLAs can be measured.
- **CONFIRMED** — `tickets.service.ts:634-639`: If `firstResponseAt` is null and sender is agent/supervisor/super_admin (not creator), sets `firstResponseAt = message.createdAt`.

### US-021: Team Feed (Department-Wide Notes)
As a team member, I want to post notes to my department's shared feed, so that I can communicate tips, updates, and observations outside of tickets.
- **CONFIRMED** — `TeamFeedPage.tsx`. API: `GET /api/team-notes` (`team-notes.service.ts:8-41`). Create: `team-notes.service.ts:43-75` (forbidden for end_user). Comment and like functionality (`team-notes.service.ts:77-112`).

---

## Notifications

### US-022: Real-time Notifications via WebSocket
As an authenticated user, I want to receive real-time notifications for new tickets, status changes, assignments, comments, and SLA alerts, so that I can respond promptly.
- **CONFIRMED** — `NotificationProvider.tsx:118-177`: Handles `new-ticket`, `ticket-status-updated`, `ticket-assigned`, `new-comment`, `sla-warning`, `sla-breach`. Backend emits via `TicketGateway.emitToDept`, `emitToUser`, `emitToTicket` (`ticket.gateway.ts:90-100`).

### US-023: In-App Notification Bell
As a user, I want to see unread notification count in the header bell icon and mark notifications as read, so that I can track what needs my attention.
- **CONFIRMED** — `App.tsx:226-390`: Bell with unread count badge. Click opens dropdown with mark-read and mark-all-read.

### US-024: Browser Push Notifications
As a user, I want browser push notifications for important events, so that I'm notified even when the app is in the background.
- **CONFIRMED** — `NotificationProvider.tsx:78-80`: `new Notification(title, { body })` when `Notification.permission === 'granted'`. Permission requested on mount (`NotificationProvider.tsx:201-205`).

### US-025: SLA Breach and Warning Notifications (Cron-Based)
As a department member, I want to receive in-app notifications when a ticket's SLA is breached or exceeds 80% consumption, so that I can escalate or act quickly.
- **CONFIRMED** — `cron.service.ts:36-111`. `slaCheck()`: For breached tickets → creates `SLA_BREACH` notification for all active dept users. For ≥80% consumed (not breached) → creates `SLA_WARNING` notification. `slaBreachSent` / `slaWarningSent` flags prevent duplicate notifications.

---

## Knowledge Base

### US-026: Browse and Search Knowledge Base
As any user, I want to browse and search knowledge base articles with category filtering, so that I can find self-service solutions.
- **CONFIRMED** — `KnowledgeBasePage.tsx`. Search: `GET /api/knowledge/articles?search=...` -> `knowledge.service.ts:23-51` (searches titleAr/En, contentAr/En, category name). Arabic normalization (`knowledge.service.ts:30`).

### US-027: Manage Knowledge Base Articles
As a user with KB management permission, I want to create, edit, and delete articles (in both Arabic and English), so that I can maintain the knowledge base.
- **CONFIRMED** — `knowledge.service.ts:134-190`. Permission: `canManageKnowledgeBase` in user override or dept defaults (`knowledge.service.ts:9-21`). Requires titleAr/En + contentAr/En + categoryId.

### US-028: View Count Tracking
As a knowledge base administrator, I want view counts to be tracked per article, so that I can identify the most helpful content.
- **CONFIRMED** — `knowledge.service.ts:192-194`: `incrementView` increments `views` field. Tracked in schema (`schema.prisma:537`).

---

## Analytics

### US-029: Dashboard Analytics
As an agent or supervisor, I want to see ticket statistics, status/priority distributions, department performance, AHT, and agent performance on my dashboard, so that I can monitor operations.
- **CONFIRMED** — `DashboardPage.tsx`. API: `GET /api/analytics/dashboard-summary` (`analytics.service.ts:35-115`) returns stats, distributions, department performance, agent performance, recent activity, export history, asset summary.

### US-030: Agent Performance Report
As a supervisor or super admin, I want to see per-agent metrics (resolved count, avg response time, avg resolution time, SLA adherence rate), so that I can evaluate team performance.
- **CONFIRMED** — `analytics.service.ts:163-187`. Agent-scoped: supervisor sees own department only (`analytics.service.ts:165-167`). Calculates `slaAdherenceRate` as `% resolved on time`.

### US-031: Export Tickets to Excel
As an authorized user, I want to export ticket data to an Excel file with date range filtering, so that I can generate offline reports.
- **CONFIRMED** — `GET /api/analytics/export` → `analytics.service.ts:279-353`. Permission: `canExportData` in user override or dept defaults; supervisors default-allowed; agents/end_users default-denied (`analytics.service.ts:281-296`).

---

## Audit Logs

### US-032: View Audit Logs
As a super admin, I want to view the audit log trail for all actions, so that I can track accountability and compliance.
- **CONFIRMED** — `AuditLogPage.tsx`. Audit logs auto-created on every mutation: ticket creation, status changes, assignments, transfers, archive, resolves, profile updates, user CRUD, asset CRUD, KB CRUD, etc. (`AuditLog` model: `schema.prisma:446-468`).

---

## Profile Management

### US-033: Update Profile
As any user, I want to update my avatar and "about" bio, so that my profile is current.
- **CONFIRMED** — `UserProfilePage.tsx:46-96`. API: `PUT /api/profile` with `avatarUrl` and/or `about` (`profile.service.ts:21-47`). Audit log created on update.

---

## Asset Management

### US-034: Manage Hospital Assets
As an authorized user, I want to create, update, and deactivate assets (medical devices, IT hardware), so that I can track equipment linked to tickets.
- **CONFIRMED** — `assets.service.ts`. Fields: name, serialNumber, type, location, departmentId, status, purchaseDate, warrantyExpiry. Soft delete (`assets.service.ts:114`).

### US-035: Link Asset to Ticket
As a ticket creator, I want to associate an asset with a ticket, so that the equipment involved in the issue is tracked.
- **CONFIRMED** — `NewTicketPage.tsx:30` (assetId field). `tickets.service.ts:151` stores `assetId`. `schema.prisma:254-255`: `Ticket.asset` relation.

---

## SLA Management

### US-036: SLA Auto-Calculation at Ticket Creation
As the system, I want to automatically calculate the SLA deadline based on department/ticket-type SLA hours × priority modifier, so that every ticket has a resolution deadline.
- **CONFIRMED** — `tickets.service.ts:132-133`: `baseSlaHours = ticketType?.slaHours || department.slaHours || 24`. Modified by priority (`sla.utils.ts:10-25`).

### US-037: SLA Visual Indicators on Ticket
As a user viewing a ticket, I want to see the SLA deadline with red color when breached, so that I can assess urgency at a glance.
- **CONFIRMED** — `TicketDetailsPage.tsx:592-601`: SLA badge with `danger-red` styling when deadline passed and ticket not resolved/closed.

---

## Link Tickets

### US-038: Link/Unlink Related Tickets
As an agent, I want to link/unlink related tickets, so that interconnected issues are tracked together.
- **CONFIRMED** — `POST /api/tickets/{id}/link`, `POST /api/tickets/{id}/unlink` → `tickets.service.ts:854-907`. Stores as JSON array in `relatedTickets` field (`schema.prisma:231`).

### US-039: Update Due Date
As a department agent, I want to manually set or clear a due date on a ticket, so that I can set external deadlines beyond the SLA.
- **CONFIRMED** — `PUT /api/tickets/{id}/due-date` → `tickets.service.ts:787-814`. Permission: dept member or super_admin. Creates `DUE_DATE_CHANGED` audit log.

### US-040: Update Ticket Type (Issue Type)
As a department agent, I want to change the ticket type on an existing ticket, so that the SLA and categorization reflect the current understanding.
- **CONFIRMED** — `PUT /api/tickets/{id}/type` → `tickets.service.ts:817-851`. Recalculates SLA deadline on type change. Creates `TYPE_CHANGED` audit log.