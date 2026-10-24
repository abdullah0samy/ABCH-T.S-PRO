# Workflow Documentation

> End-to-end workflows with file:line evidence. Every step traced to source code.

---

## 1. Authentication Flow

### 1.1 Login
```
Client                          Server                          DB
  |                               |                               |
  |-- POST /api/auth/login ------>|                               |
  |   { identifier, password }    |                               |
  |                               |-- query User OR badge/username>|
  |                               |<-- user object ---------------|
  |                               |                               |
  |                               |-- check isActive              |
  |                               |-- check lockUntil             |
  |                               |-- bcrypt.compare(password)    |
  |                               |                               |
  |                               |-- if invalid: increment       |
  |                               |  failedLoginAttempts >---------|
  |                               |  (lock if >= 5)               |
  |                               |                               |
  |                               |-- jwt.sign(access, 8h)        |
  |                               |-- jwt.sign(refresh, 7d)       |
  |                               |-- update lastLoginAt -------->|
  |<-- { accessToken, user } -----|                               |
  |-- Set refresh cookie (7d,    | (response interceptor)         |
  |  httpOnly, secure, sameSite) |                               |
  |                               |                               |
```
- Login: `auth.controller.ts:16-35`, `auth.service.ts:12-93`
- Token generation: `auth.utils.ts:11-25`
- Lockout: `auth.service.ts:56-65` (5 attempts → 15 min lock)
- Cookie: `auth.controller.ts:23-28` (7 days, httpOnly)

### 1.2 Token Refresh
The refresh token can be sent either in request body or read from httpOnly cookie (`auth.controller.ts:44`).

```
Client                          Server
  |                               |
  |-- POST /api/auth/refresh ---->|
  |  (body or cookie refreshToken)|
  |                               |-- verifyRefreshToken (jwt)    |
  |                               |-- validate user + isActive    |
  |<-- { accessToken: newToken }--|
  |                               |
```
- Endpoint: `auth.controller.ts:37-46`
- Service: `auth.service.ts:95-121`

### 1.3 Logout
```
Client                          Server
  |                               |
  |-- POST /api/auth/logout ----->|                               |
  |-- localStorage.removeItem     |-- clear refresh cookie ------>|
  |                               |                               |
  |-- navigate to login (UI)      |                               |
```
- Frontend: `authStore.ts:17-21`
- Backend: `auth.controller.ts:48-58`, `auth.service.ts:123-125`

---

## 2. Ticket Creation Workflow

```
Browser                   Backend Controller          Service                 DB              WebSocket
  |                           |                          |                     |                  |
  |-- POST /api/tickets ------|                          |                     |                  |
  |  { subject, description,  |                          |                     |                  |
  |   departmentId, ... }     |-- zod validate ---->|   |                     |                  |
  |                            <--- parsed or error   --|                     |                  |
  |                           |-- create(userId, body) ->|                     |                  |
  |                           |                          |-- validate user     |                  |
  |                           |                          |-- validate dept     |                  |
  |                           |                          |-- cross-dept guard--|                  |
  |                           |                          |-- floor/building    |                  |
  |                           |                          |   match             |                  |
  |                           |                          |-- calc SLA deadline |                  |
  |                           |                          |                     |                  |
  |                           |                          |-- $transaction:     |                  |
  |                           |                          |  1. generateTicket# |                  |
  |                           |                          |  2. tx.ticket.create->| (insert)       |
  |                           |                          |     + auditLog.create->| (insert)       |
  |                           |                          |  Retry on P2002    |                  |
  |                           |                          |                     |                  |
  |                           |-- emitToDept(new-ticket) ->|                     |                  |
  |                           |                          |-- emit (WS)         |                  |-- new-ticket event -->|
  |<-- ticket object ---------|                          |                     |                  |         connected agents
```

- Controller: `tickets.controller.ts:17-26`
- Zod: `tickets.controller.ts:21-23` (validates request body)
- Service: `tickets.service.ts:106-181`:
  - User/Dept validation: lines 110-117
  - Cross-dept guard: lines 120-122
  - Floor/building: lines 124-127
  - SLA calc: lines 132-133
  - Transaction with ticket # generation: lines 137-176
  - WS emit: line 179
- Ticket number format: `TKT-YYMMDD-###` (`tickets.service.ts:59-76`)
- Retry logic: `MAX_RETRIES = 5` for unique constraint collisions (`tickets.service.ts:135-137`)

---

## 3. Status Transition Workflow

```
Browser                   Controller                Service                 DB               WebSocket
  |                         |                         |                     |                   |
  |-- PUT /tickets/123/status|                         |                     |                   |
  |   { status: 'open' }    |-- updateStatus() ------>|                     |                   |
  |                         |                         |-- fetch ticket      |                   |
  |                         |                         |                     |                   |
  |                         |                         |-- check closed/resolved lock |           |
  |                         |                         |   (super_admin only)|                   |
  |                         |                         |-- checkTicketPermission|               |
  |                         |                         |   (cached lookup)   |                   |
  |                         |                         |-- ALLOWED_TRANSITIONS|                   |
  |                         |                         |   check [oldStatus] |                   |
  |                         |                         |-- special guards:   |                   |
  |                         |                         |   closed→in_progress:|                   |
  |                         |                         |   super_admin only  |                   |
  |                         |                         |   resolved: agent   |                   |
  |                         |                         |   required          |                   |
  |                         |                         |   resolved/closed:  |                   |
  |                         |                         |   ticketType req'd  |                   |
  |                         |                         |                     |                   |
  |                         |                         |-- $transaction:     |                   |
  |                         |                         |  1. ticket.update   -->| (update status) |
  |                         |                         |  2. auditLog.create  -->| (STATUS_CHANGED)|
  |                         |                         |  3. ticketMessage    -->| (if comment)   |
  |                         |                         |                     |                   |
  |                         |                         |-- emitToUser        |                   |
  |                         |                         |-- emitToDept        |                   |-- status-updated -->|
  |                         |                         |-- emitToTicket      |                   |-- status-updated -->|
  |<-- updatedTicket -------|                         |                     |                   |     connected clients
```

- Controller: `tickets.controller.ts:64-67`
- Service: `tickets.service.ts:408-488`:
  - Lock check: lines 415-417
  - Permission: line 419
  - Transition validation: lines 422-426
  - Closed reopen guard: lines 428-430
  - Assignment required before resolve: lines 432-434
  - Issue type required before resolve/close: lines 437-439
  - Transaction: lines 443-481
    - SLA recalculation if type changed: lines 445-449
    - `completedAt` stamp on resolve: line 457
    - `closedAt` stamp on close: line 458
    - Audit log: lines 464-474
    - Comment message: lines 476-478
  - WS emits: lines 483-485

### Allowed Transitions (workflow.constants.ts:7-18)
| From | To |
|------|-----|
| pending | open, in_progress, closed |
| open | in_progress, closed |
| in_progress | resolved, closed |
| resolved | in_progress (reopen only; close requires creator confirm) |
| closed | in_progress (reopen, super_admin only) |

---

## 4. Assignment Workflow

### 4.1 Single Assignment
```
Browser                   Service                 DB              WebSocket
  |                         |                     |                 |
  |-- PUT /tickets/123/assign|                    |                 |
  |   { agentId }           |-- fetch ticket      |                 |
  |                         |-- check closed lock |                 |
  |                         |-- check canAssign   |                 |
  |                         |-- validate agent    |                 |
  |                         |-- agent.department ==|                |
  |                         |   ticket.department |                 |
  |                         |-- $transaction:     |                 |
  |                         |  1. ticket.update   -->| (set assignedTo) |
  |                         |     auto-transition:|                 |
  |                         |     pending → in_progress |            |
  |                         |  2. auditLog.create  -->| (ASSIGNED)   |
  |                         |-- emitToUser (agent)|                 |-- ticket-assigned -->|
  |                         |-- emitToTicket      |                 |-- ticket-assigned -->|
  |<-- updatedTicket -------|                     |                 |                   |
```

- Service: `tickets.service.ts:491-539`
- Agent dept validation: lines 507-509
- Pending→in_progress auto-transition: `tickets.service.ts:519`
- WS: emits to assigned agent + ticket room (lines 533-536)

### 4.2 Bulk Assignment
- Service: `tickets.service.ts:738-784`
- Iterates ticketIds, checks permissions per ticket, same dept validation, same auto-transition.

---

## 5. Transfer Workflow

```
Browser                   Service                 DB              WebSocket
  |                         |                     |                 |
  |-- PUT /tickets/123/transfer|                    |                 |
  |   { targetDeptId, reason}|                     |                 |
  |                         |-- fetch ticket      |                 |
  |                         |-- check closed lock |                 |
  |                         |-- check canTransfer |                 |
  |                         |-- validate target   |                 |
  |                         |-- DeptTransferAllowlist check (non-super_admin)|        |
  |                         |  FIND: sourceDept=old, targetDept=new, isActive|            |
  |                         |                     |                 |
  |                         |-- $transaction:     |                 |
  |                         |  1. ticketTransfer.create -->|         |
  |                         |  2. recalc SLA (new dept hours)|      |
  |                         |  3. ticket.update   -->|         |     |
  |                         |     departmentId = new |     |     |
  |                         |     assignedToId = null|    |     |
  |                         |     status = 'pending'    |     |     |
  |                         |     slaDeadline = new   |     |     |
  |                         |  4. auditLog.create  -->| (TRANSFERRED)|
  |                         |-- emitToDept(newDept,|                 |     |
  |                         |   new-ticket)        -->|        |-- new-ticket -->|
  |                         |-- emitToDept(oldDept,|                 |     |
  |                         |   ticket-transferred) -->|       |-- ticket-transferred -->|
  |<-- updatedTicket -------|                     |                 |     |
```

- Service: `tickets.service.ts:541-600`
- Allowlist check: lines 559-565 (queries `DeptTransferAllowlist` table, `schema.prisma:88-99`)
- SLA recalculation: `tickets.service.ts:577-578`
- Status reset to `pending`, assignment cleared: `tickets.service.ts:580-582`
- Dual department notification: lines 597-598

---

## 6. Archive Workflow

### 6.1 Manual Archive
- Service: `tickets.service.ts:909-932`
- Requires: `canArchiveTickets` permission AND status = `resolved` or `closed`
- Sets `isArchived = true`, `archivedAt = now()`, `archivedById = userId`
- Creates `TICKET_ARCHIVED` audit log

### 6.2 Automatic Archive (Cron)
```
Cron Scheduler            CronProcessor           CronService            DB
    |                         |                     |                     |
    |-- every day at 4:00 AM-|                     |                     |
    |  (jobs.module.ts:28)   |                     |                     |
    |                         |-- process(auto-archive)|                     |
    |                         |-- autoArchive()   ->|                     |
    |                         |                     |-- query tickets:  |                     |
    |                         |                     |   status IN resolved/closed, completedAt < 30 days ago, not archived|
    |                         |                     |                     |
    |                         |                     |-- for each:       |                     |
    |                         |                     |  update isArchived|                     |
    |                         |                     |  audit AUTO_ARCHIVED|                    |
    |                         |                     |                     |
```
- Schedule: `0 4 * * *` (cron pattern, `jobs.module.ts:28-30`)
- 30-day threshold: `cron.service.ts:113-116`
- Uses first super_admin userId for audit log attribution (`cron.service.ts:125-127`)

### 6.3 Bulk Archive
- Service: `tickets.service.ts:975-1006`
- Iterates ticket IDs, checks permissions per ticket, skips non-resolved/closed, returns success/fail counts.

---

## 7. SLA Management

### 7.1 Calculation at Creation
```
Formula:  slaDeadline = createdAt + (baseHours × priorityModifier)

Where:
  baseHours = ticketType.slaHours || department.slaHours || 24
  priorityModifier:
    low = 1.5      (+50% time)
    normal = 1.0   (base)
    high = 0.5     (-50% time)
    critical = 0.25 (-75% time)
```
- `tickets.service.ts:132-133`: `baseSlaHours = ticketType?.slaHours || targetDept.slaHours || 24`
- `sla.utils.ts:10-25`: `calculateSLADeadline(baseHours, priority, startTime)`
- Modifiers: `workflow.constants.ts:20-25`

### 7.2 SLA Cron Monitoring
```
Cron (*/5 * * * *)        CronService            DB                     Notifications
  |-- every 5 min --------->|                     |                       |
  |                         |-- slaCheck() ------>|                       |
  |                         |                     |                       |
  |                         |-- Query 1:          |                       |
  |                         |  breached tickets:  |                       |
  |                         |  status NOT IN resolved/closed,            |
  |                         |  slaDeadline < now, slaBreachSent = false  |
  |                         |  for each:          |                       |
  |                         |    create SLA_BREACH|                       |
  |                         |    notification    -->| for all active dept users|
  |                         |    set slaBreachSent= true                 |
  |                         |                     |                       |
  |                         |-- Query 2:          |                       |
  |                         |  warning tickets:   |                       |
  |                         |  slaDeadline > now, slaWarningSent = false |
  |                         |  for each:          |                       |
  |                         |    calc % consumed  |                       |
  |                         |    if >= 80%:       |                       |
  |                         |      create SLA_WARNING notification      |
  |                         |      set slaWarningSent = true             |
```
- Schedule: `*/5 * * * *` (`jobs.module.ts:21-23`)
- Service: `cron.service.ts:36-111`
  - Breach detection: lines 39-69
  - Warning at 80%: lines 72-109

### 7.3 Recalculation on Transfer / Type Change
- Transfer: `tickets.service.ts:577-578`: `calculateSLADeadline(targetDept.slaHours || 24, ticket.priority)`
- Type change: `tickets.service.ts:836-837`: recalculates with new type's SLA hours

---

## 8. Notification Delivery

### 8.1 In-App Notification Creation (DB)
```
Any mutation (slaCheck, etc.)
  |-- notifications.createMany(...)
  |   entityType: SLA_BREACH | SLA_WARNING
  |   titleEn/titleAr
  |   bodyEn/bodyAr
  |   userId, ticketId
  |   isRead: false
  |-- Notification DB row written
```
- `cron.service.ts:51-62` (breach), `cron.service.ts:87-98` (warning)

### 8.2 WebSocket Push
```
TicketGateway
  |-- emitToDept(deptId, event, data) → socket.io `dept-{id}` room
  |-- emitToUser(userId, event, data) → socket.io `user-{id}` room
  |-- emitToTicket(ticketId, event, data) → socket.io `ticket-{id}` room

NotificationProvider (browser)
  |-- socket.on(event, handler)
  |-- window.dispatchEvent(CustomEvent('ws:{event}', detail))
  |-- addNotification() → state + toast + browser notification
```
- Gateway: `ticket.gateway.ts:90-100`
- Client: `NotificationProvider.tsx:118-177`

### 8.3 Browser Push
- `NotificationProvider.tsx:78-80`: `new Notification(title, { body })` when permission granted
- VAPID setup in `notifications.service.ts:7-16` (configurable via env vars)

---

## 9. Audit Logging Flow

### 9.1 Manual Audit Logging (Service-Level)
Every mutation service method that changes data explicitly creates an AuditLog entry in its transaction:

| Action | Service Method | File Location |
|--------|---------------|---------------|
| TICKET_CREATED | `tickets.service.create()` | `tickets.service.ts:164-168` |
| STATUS_CHANGED | `tickets.service.updateStatus()` | `tickets.service.ts:464-474` |
| TICKET_REOPENED | `tickets.service.updateStatus()` (reopen) | `tickets.service.ts:464-474` |
| ASSIGNED | `tickets.service.assign()` | `tickets.service.ts:522-528` |
| TRANSFERRED | `tickets.service.transfer()` | `tickets.service.ts:585-591` |
| USER_CONFIRMATION | `tickets.service.confirmResolution()` | `tickets.service.ts:670-676` |
| DUE_DATE_CHANGED | `tickets.service.updateDueDate()` | `tickets.service.ts:808-811` |
| TYPE_CHANGED | `tickets.service.updateTicketType()` | `tickets.service.ts:845-848` |
| TICKET_LINKED / UNLINKED | `tickets.service.linkTickets/unlinkTickets()` | `tickets.service.ts:873-876, 900-903` |
| TICKET_ARCHIVED | `tickets.service.archiveTicket()` | `tickets.service.ts:926-929` |
| TICKET_ARCHIVED_BULK | `tickets.service.bulkArchive()` | `tickets.service.ts:993-996` |
| SUPER_ADMIN_OVERRIDE | `tickets.service.superAdminOverride()` | `tickets.service.ts:966-969` |
| AUTO_ARCHIVED | `cron.service.autoArchive()` | `cron.service.ts:135-143` |
| PROFILE_UPDATED | `profile.service.updateProfile()` | `profile.service.ts:36-44` |
| USER_CREATED/UPDATED/DEACTIVATED | `admin-users.controller.ts` | `admin-users.controller.ts:82-91, 125-133, 176-181` |
| PASSWORD_RESET | `admin-users.controller.ts` | `admin-users.controller.ts:156-163` |
| ARTICLE_CREATED/UPDATED/DELETED | `knowledge.service.ts` | `knowledge.service.ts:145-148, 164-172, 182-188` |
| ASSET_CREATED/UPDATED/DELETED | `assets.service.ts` | `assets.service.ts:50-55, 97-101, 115-118` |

### 9.2 Audit Schema
```prisma
model AuditLog {
  userId, action, entityType, entityId, departmentId, ticketId
  oldData Json?, newData Json?           // full before/after snapshots
  ipAddress, userAgent                   // from HTTP request
  createdAt                              // auto-stamped
}
```
(`schema.prisma:446-468`)