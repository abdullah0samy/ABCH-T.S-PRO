# Business Rules

> Every rule extracted directly from code with file:line citation.

---

## TICKET_STATUSES

**CONFIRMED** — `workflow.constants.ts:1`

```ts
['pending', 'open', 'in_progress', 'resolved', 'closed']
```

Default status on creation: `'pending'` — `tickets.service.ts:156`.

---

## ALLOWED_TRANSITIONS

**CONFIRMED** — `workflow.constants.ts:7-18`

| From | Allowed To | Notes |
|------|-----------|-------|
| pending | open, in_progress, closed | Direct close allowed |
| open | in_progress, closed | Direct close allowed |
| in_progress | resolved, closed | Resolve or direct close |
| resolved | in_progress only | **Resolved → closed intentionally removed**; close requires creator confirmation (line 16) |
| closed | in_progress only | Reopen is super_admin only (enforced in route handler, line 17) |

Code reference:
```ts
ALLOWED_TRANSITIONS: {
  pending: ['open', 'in_progress', 'closed'],
  open: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['in_progress'],
  closed: ['in_progress'],
}
```

### Additional Transition Guards (NOT in ALLOWED_TRANSITIONS, enforced in service)

- **resolved→closed**: NOT in ALLOWED_TRANSITIONS. Only path is creator confirmation via `PUT /:id/confirm` (`tickets.service.ts:657-662`).
- **closed→in_progress**: In ALLOWED_TRANSITIONS as `[in_progress]`, but additional guard requires `userRole === 'super_admin'` (`tickets.service.ts:428-430`).

---

## PRIORITY_SLA_MODIFIERS

**CONFIRMED** — `workflow.constants.ts:20-25`

| Priority | Multiplier | Effect |
|----------|-----------|--------|
| low | 1.5 | +50% time (e.g., 24h → 36h) |
| normal | 1.0 | Base time |
| high | 0.5 | −50% time (e.g., 24h → 12h) |
| critical | 0.25 | −75% time (e.g., 24h → 6h) |

---

## Ticket Number Format

**CONFIRMED** — `tickets.service.ts:59-76`

Format: **TKT-YYMMDD-###** (e.g., `TKT-250115-001`)

```ts
const dateStr = now.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
const prefix = 'TKT';
// Sequence: finds last TKT-{dateStr}-###, increments by 1
return `${prefix}-${dateStr}-${sequence.toString().padStart(3, '0')}`;
```

Retry on unique constraint: `MAX_RETRIES = 5` (`tickets.service.ts:135-137`).

---

## Account Lockout

**CONFIRMED** — `auth.service.ts:39-65`

- **Threshold:** 5 consecutive failed login attempts
- **Lock duration:** 15 minutes (`15 * 60 * 1000` ms)
- **Behavior:** 
  - On failed attempt, increments `failedLoginAttempts` (`auth.service.ts:56`)
  - If `>= 5`, sets `lockUntil = now + 15 minutes` (`auth.service.ts:57-59`)
  - HTTP 423 returned with `lockUntil` timestamp (`auth.service.ts:39-43`)
  - On expired lock, resets `failedLoginAttempts = 0, lockUntil = null` (`auth.service.ts:46-51`)
  - On successful login, resets counters (`auth.service.ts:68-75`)

---

## SLA Deadline Calculation

**CONFIRMED** — `tickets.service.ts:132-133`, `sla.utils.ts:10-25`

```
slaDeadline = startTime + (baseHours × priorityModifier)
```

Where `baseHours` selection priority:
1. `ticketType.slaHours` (if ticket type assigned and has custom SLA) (`schema.prisma:195`)
2. `department.slaHours` (default 24) (`schema.prisma:67`)
3. Fallback: `24` hours (`tickets.service.ts:132`)

---

## Auto-Archive

**CONFIRMED** — `cron.service.ts:113-145`, `jobs.module.ts:28-30`

```sql
WHERE status IN ('resolved', 'closed')
  AND completedAt < (NOW() - 30 days)
  AND isArchived = false
```

- **Schedule:** Daily at 4:00 AM (`0 4 * * *`)
- **Threshold:** 30 days since `completedAt`
- **Audit action:** `AUTO_ARCHIVED`

---

## Transfer: DeptTransferAllowlist Check

**CONFIRMED** — `tickets.service.ts:559-565`

Non-super_admin transfers require an active `DeptTransferAllowlist` entry:
```ts
this.prisma.deptTransferAllowlist.findFirst({
  where: {
    sourceDeptId: ticket.departmentId,
    targetDeptId: targetDeptId,
    isActive: true,
  },
})
```

Super admins bypass this check. Not found → `TRANSFER_NOT_ALLOWED` (`tickets.service.ts:564`).

---

## Archive: Status Requirement

**CONFIRMED** — `tickets.service.ts:917-919`

Only tickets with status `resolved` or `closed` can be archived:
```ts
if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
  throw new BadRequestException({ message: 'Only resolved or closed tickets can be archived' });
}
```

---

## Confirm Resolution: Creator-Only

**CONFIRMED** — `tickets.service.ts:657-662`

Only the ticket creator (`createdById`) can confirm resolution. Ticket must be in `resolved` status. Transition: `resolved → closed`. Captures optional `rating` (1-5) and `feedback`.

---

## Reopen Rules

**CONFIRMED**

1. **resolved → in_progress**: Allowed by ALLOWED_TRANSITIONS without additional role guard (`workflow.constants.ts:16`). Resets `completedAt = null` (`tickets.service.ts:457`). Audit action: `TICKET_REOPENED`.

2. **closed → in_progress**: In ALLOWED_TRANSITIONS (`workflow.constants.ts:17`), but guarded to require `userRole === 'super_admin'` (`tickets.service.ts:428-430`). Resets `closedAt = null` (`tickets.service.ts:458`). Audit action: `TICKET_REOPENED`.

---

## External Resource Flag

**CONFIRMED** — `schema.prisma:236-238`

Independent boolean flag on resolved/closed tickets:
- `requiresExternalResource`: boolean, default `false`
- `externalResourceCost`: float (optional)
- `externalResourceNote`: string (optional)

Set during transition to `resolved` or `closed` with the external resource modal (`TicketDetailsPage.tsx:797-909`).

Service: only set when status is resolved/closed (`tickets.service.ts:455-457`).

---

## File Upload Constraints

**CONFIRMED** — `uploads.controller.ts:12-63`, `uploads.service.ts:6-17`

- **Size limit:** 5 MB (`uploads.controller.ts:56`: `fileSize: 5 * 1024 * 1024`)
- **Allowed MIME types:**
  - `image/jpeg`, `image/png`
  - `application/pdf`
  - `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `audio/wav`, `audio/mpeg`, `audio/webm`
  (`uploads.controller.ts:13-19`)
- **Magic byte validation:** File contents verified against declared MIME type by reading first 8 bytes (`uploads.service.ts:6-33`). Mismatch → file deleted + `UnprocessableEntityException`.
- **Path traversal protection:** Downloads use `path.basename()` and verify resolved path starts within uploads directory (`uploads.service.ts:38-42`).

---

## Export Auto-Cleanup

**CONFIRMED** — `analytics.service.ts:348`, `cron.service.ts:11-34`, `jobs.module.ts:14-16`

- **Expires at:** 27 hours after creation (`analytics.service.ts:348`: `new Date(new Date().setHours(27, 0, 0, 0))`)
- **Cleanup schedule:** Daily at 3:00 AM (`0 3 * * *`, `jobs.module.ts:14-16`)
- **Cleanup action:** Deletes expired files from disk + removes `ExportHistory` DB rows (`cron.service.ts:20-33`)

---

## Resolution Requires Agent Assignment

**CONFIRMED** — `tickets.service.ts:432-434`, `tickets.service.ts:711`

A ticket must be assigned to an agent (`assignedToId` is not null) before it can be resolved:
```ts
if (status === 'resolved' && !ticket.assignedToId) {
  throw new BadRequestException({
    message: 'A ticket must be assigned to an agent before it can be resolved',
    code: 'ASSIGNMENT_REQUIRED',
  });
}
```

---

## Resolution/Close Requires Ticket Type

**CONFIRMED** — `tickets.service.ts:437-439`, `tickets.service.ts:712`

Issue type (`ticketTypeId`) must be selected before resolving or closing:
```ts
if ((status === 'resolved' || status === 'closed') && !effectiveTypeId) {
  throw new BadRequestException({
    message: 'Issue Type must be selected before resolving or closing the ticket',
    code: 'ISSUE_TYPE_REQUIRED',
  });
}
```

---

## Closed/Resolved Ticket Modification Lock

**CONFIRMED** — `tickets.service.ts:415-417`, `tickets.service.ts:497-499`, `tickets.service.ts:549-551`

Closed or resolved tickets cannot be modified (status change, assignment, transfer) unless the acting user is `super_admin`:
```ts
if ((ticket.status === 'closed' || ticket.status === 'resolved') && userRole !== 'super_admin') {
  throw new ForbiddenException(...);
}
```

---

## Commenting on Closed/Resolved Tickets

**CONFIRMED** — `tickets.service.ts:612-617`

| Ticket Status | end_user | agent/supervisor | super_admin |
|--------------|----------|-----------------|-------------|
| active | Can comment | Can comment | Can comment |
| closed | Forbidden | Forbidden | Allowed |
| resolved (not creator) | Forbidden | Can comment | Allowed |
| resolved (is creator) | Can comment | Can comment | Allowed |

---

## Permission Caching

**CONFIRMED** — `permissionCache.ts:1-40`

User permissions are cached in memory per (userId, deptId) with 30-second TTL (`permissionCache.ts:10`: `TTL_MS = 30_000`). Permissions checked in order:
1. User `UserPermissionOverride` record (null = not overridden)
2. Department `DeptPermissions` defaults
3. Default: `true` for canChangeStatus/canAssign/canTransfer; `false` for canArchiveTickets (unless supervisor)

---

## Agent/Supervisor Department Scoping

**CONFIRMED** — `tickets.service.ts:221-234`, `analytics.service.ts:7-12`

- **Agents:** See department tickets (same scope as supervisors), not just their own tickets
- **Supervisors:** Same department scope as agents
- **Super admin:** Global access to all departments
- **End user:** Only own created tickets

When `canViewAllDeptTickets = false`, agents/supervisors further scoped to own assigned+created tickets (`tickets.service.ts:221-234`).

---

## Export Permission Rules

**CONFIRMED** — `analytics.service.ts:281-296`

Export is governed by `canExportData`:
- Super admin: always allowed
- Supervisor: default-allowed (canExportData defaults to false, but `canExport === null && role === 'supervisor'` passes)
- Agent/end_user: default-denied unless explicitly granted via override or dept permissions

---

## Token Security

**CONFIRMED** — `auth.utils.ts:1-33`, `ticket.gateway.ts:41-53`

- **Access token:** JWT, 8-hour expiry, contains `id`, `role`, `departmentId` (`auth.utils.ts:11-16`)
- **Refresh token:** JWT, 7-day expiry, contains `id` only (`auth.utils.ts:19-24`)
- **WebSocket auth:** Socket.IO authentication via access token (`ticket.gateway.ts:41-53`)
- **Cookie security:** `httpOnly`, `sameSite: 'strict'`, `secure: true` in production (`auth.controller.ts:23-28`)

---

## Badge Number and Username Format

**CONFIRMED** — `auth.service.ts:21-23`, `admin-users.controller.ts:49-50`

At login: `! /^[a-zA-Z0-9_.-]+$/.test(identifier)` → rejects invalid format (`auth.service.ts:21-23`).
At user creation/update: `! /^\d+$/.test(badgeNumber)` OR `! /^\d+$/.test(username)` → numeric only required (`admin-users.controller.ts:49-50`).

---

## Password Storage

**CONFIRMED** — `auth.service.ts:54`, `admin-users.controller.ts:62`

Passwords hashed with `bcrypt.hash(password, 12)` (salt rounds = 12). Comparison via `bcrypt.compare()`.

---

## Soft Deletion

**CONFIRMED** — `schema.prisma:122-123`, `admin-users.controller.ts:171-172`, `assets.service.ts:114`

Users and assets use soft deletion (`deletedAt` timestamp). User deletion sets `isActive = false, deletedAt = now()`. Asset deletion sets `deletedAt = now()`.