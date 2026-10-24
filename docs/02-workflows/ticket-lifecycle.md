# Ticket Lifecycle

> Complete state machine with transitions, actors, data stamps, and side effects.

---

## State Diagram

```
                    ┌─────────┐
                    │ pending │ ◄── creation default (tickets.service.ts:156)
                    └────┬────┘
               ┌─────────┼──────────┐
               │         │          │
        ┌──────▼──┐  ┌───▼──┐ ┌────▼────┐
        │  open   │  │ in_   │ │ closed  │
        │         │  │progress│ │         │
        └────┬────┘  └───┬───┘ └─────────┘
             │           │      ▲    ▲
             │    ┌──────┘      │    │
             │    │             │    │ (reopen, super_admin only)
             │ ┌──▼────┐        │    │
             ▼  │       │        │    │
        ┌──────▼──┐ ┌───▼───┐   │    │
        │ closed  │ │resolved│──┘    │
        │         │ │       │────────┘
        └─────────┘ └──┬────┘
                        │
                    (confirm)
                        │
                        ▼
                    ┌─────────┐
                    │ closed  │
                    └─────────┘
```

### Full Transition Table

| From | To | Actor | Guard | File Evidence |
|------|-----|-------|-------|--------------|
| **pending** | open | Any dept member with canChangeStatus | ALLOWED_TRANSITIONS check | `workflow.constants.ts:8`, `tickets.service.ts:422-426` |
| **pending** | in_progress | Any dept member with canChangeStatus | ALLOWED_TRANSITIONS check; auto-transition on assign | `workflow.constants.ts:8`, `tickets.service.ts:519` |
| **pending** | closed | Any dept member with canChangeStatus | ALLOWED_TRANSITIONS check | `workflow.constants.ts:8` |
| **open** | in_progress | Any dept member with canChangeStatus | ALLOWED_TRANSITIONS check | `workflow.constants.ts:9` |
| **open** | closed | Any dept member with canChangeStatus | ALLOWED_TRANSITIONS check | `workflow.constants.ts:9` |
| **in_progress** | resolved | Dept member with canChangeStatus | assignedTo required; ticketType required | `workflow.constants.ts:10`, `tickets.service.ts:432-439` |
| **in_progress** | closed | Dept member with canChangeStatus | ticketType required | `workflow.constants.ts:10`, `tickets.service.ts:437-439` |
| **resolved** | in_progress | Dept member with canChangeStatus | ALLOWED_TRANSITIONS (reopen) | `workflow.constants.ts:16`, `tickets.service.ts:415-417` (lock for non-super_admin on resolved, but resolved→in_progress is allowed since it's a reopen) |
| **resolved** | closed | **Ticket creator only** | Creator ID match; via `/confirm` endpoint | `tickets.service.ts:657-662` |
| **closed** | in_progress | **Super admin only** | Role guard in service | `workflow.constants.ts:17`, `tickets.service.ts:428-430` |

### Transitions NOT Allowed
| From | Blocked To | Reason |
|------|-----------|--------|
| resolved | closed (via status change) | Removed from ALLOWED_TRANSITIONS; requires creator confirmation OR super_admin PATCH override | `workflow.constants.ts:16` |

---

## Status Detail: pending

**When created:** Ticket creation via `POST /api/tickets` defaults to `status: 'pending'` (`tickets.service.ts:156`).

**Data stamped at creation:**
- `ticketNumber`: `TKT-YYMMDD-###` (`tickets.service.ts:75`)
- `slaDeadline`: auto-calculated (`tickets.service.ts:133`)
- `creatorName`, `creatorPhone`, `creatorExtension`, `creatorDeptId/Name`: from creating user (`tickets.service.ts:153-155`)
- `buildingName`, `floorName`: from building/floor lookup (`tickets.service.ts:148-150`)

**Side effects:**
- Audit log: `TICKET_CREATED` with ticketNumber, subject, department, priority, location (`tickets.service.ts:164-168`)
- WebSocket: `new-ticket` event emitted to target department room (`tickets.service.ts:179`)

**Can transition from pending to:**
- `open` — agent changes status
- `in_progress` — agent changes status OR automatically on assignment (`tickets.service.ts:519`)
- `closed` — direct close without working (edge-case allowed by transition map)

---

## Status Detail: open

**Entered from:** `pending → open` status transition.

**Data stamped:** None additional (status change only).

**Side effects on entry:**
- Audit log: `STATUS_CHANGED` with from/to, comment, performedBy, timestamp (`tickets.service.ts:464-474`)
- Optional ticket message if comment provided (`tickets.service.ts:476-478`)
- WebSocket: `ticket-status-updated` to creator user + department + current ticket room (`tickets.service.ts:483-485`)

**Can transition from open to:**
- `in_progress` — agent begins working
- `closed` — direct close

---

## Status Detail: in_progress

**Entered from:** `pending → in_progress` (status or auto-assign), `open → in_progress`, or reopen from `resolved → in_progress`.

**Data stamped:** On assignment-driven transition, `assignedToId` set.

**Side effects on entry:**
- Same as open (audit + optional message + WebSocket)

**On reopen (resolved → in_progress):**
- `completedAt` reset to `null` (`tickets.service.ts:457`)
- Audit action: `TICKET_REOPENED` instead of `STATUS_CHANGED` (`tickets.service.ts:466`)

**Can transition from in_progress to:**
- `resolved` — **requires**: assignedToId set + ticketTypeId set
- `closed` — requires: ticketTypeId set

---

## Status Detail: resolved

**Entered from:** `in_progress → resolved` ONLY (not from pending/open directly).

**Guards at transition:**
- `assignedToId` must be set (`tickets.service.ts:432-434`)
- `ticketTypeId` must be set (`tickets.service.ts:437-439`)

**Data stamped:**
- `completedAt`: set to `new Date()` (`tickets.service.ts:457`)
- Optionally: `requiresExternalResource`, `externalResourceCost`, `externalResourceNote` if external resolution (`tickets.service.ts:455-457`)

**External resource modal:** UI triggers on resolve click (`TicketDetailsPage.tsx:797-909`). Requires ticket type selection + optional external resource checkbox + cost + notes.

**Side effects on entry:**
- Audit log: `STATUS_CHANGED` with ticketTypeId, external resource fields (`tickets.service.ts:464-474`)
- WebSocket: `ticket-status-updated` to all parties (`tickets.service.ts:483-485`)
- Browser notification with `confirm=true` link for creator (`NotificationProvider.tsx:130-139`)

**Can transition from resolved to:**
- `in_progress` — reopen (agent, via standard status change; resets `completedAt`)
- `closed` — **ONLY** via creator confirmation (`PUT /:id/confirm`) or super_admin force-close (`PATCH /:id`)

**Modification restrictions:**
- Non-super_admin cannot modify resolved tickets via standard status/assign/transfer endpoints (line 415-417, 497-499, 549-551). But resolved→in_progress is an exception: `ALLOWED_TRANSITIONS` allows it and the guard at line 415 fires first—check the code: the lock guard (`(status === 'resolved') && userRole !== 'super_admin'` throws Forbidden). **Wait**: line 415 blocks resolved for non-super_admin BEFORE the transition check. So in practice, a non-super_admin CANNOT do resolved→in_progress via the standard endpoint. BUT re-read: the code at `tickets.service.ts:415-417`:
```ts
if ((ticket.status === 'closed' || ticket.status === 'resolved') && userRole !== 'super_admin') {
  throw new ForbiddenException(...);
}
```
This means **only super_admin** can modify resolved tickets via `updateStatus`. The `ALLOWED_TRANSITIONS` entry `resolved: ['in_progress']` would only be reachable by super_admin through this endpoint. The regular agent reopen must work through a different mechanism — but no other reopen endpoint exists. The UI at `TicketDetailsPage.tsx:664-680` shows the resolved→in_progress button, but it would fail the `isLocked` check when user is not super_admin (`TicketDetailsPage.tsx:569`: `isLocked = (resolved || closed) && role !== super_admin`). 

**CORRECTION:** In practice, only super_admin can transition FROM resolved status via the `updateStatus` endpoint. The `resolved: ['in_progress']` ALLOWED_TRANSITIONS entry serves the super_admin override path.

**Can transition to closed:** Via `confirmResolution` (creator only) at `tickets.service.ts:651-689`.

---

## Status Detail: closed

**Entered from three paths:**

### Path 1: Direct close (pending/open/in_progress → closed)
- Standard status transition via `updateStatus`
- `closedAt` set to `new Date()` (`tickets.service.ts:458`)

### Path 2: Creator confirmation (resolved → closed)
- Endpoint: `PUT /api/tickets/:id/confirm` (`tickets.service.ts:651-689`)
- Requires: creator match + status = `resolved`
- **Data stamped:**
  - `closedAt`: `new Date()` (`tickets.service.ts:667`)
  - `rating`: optional 1-5 (`tickets.service.ts:667`)
  - `feedback`: optional text (`tickets.service.ts:667`)
- **Side effects:**
  - Audit: `USER_CONFIRMATION` (`tickets.service.ts:670-676`)
  - Message: feedback posted as public comment (`tickets.service.ts:678-682`)
  - WebSocket: `ticket-closed` to department (`tickets.service.ts:687`)

### Path 3: Super admin reopen (closed → in_progress → ...)
- `closed → in_progress` transition requires `userRole === 'super_admin'` (`tickets.service.ts:428-430`)
- `closedAt` reset to `null` (`tickets.service.ts:458`)
- Audit: `TICKET_REOPENED`

**After closed:**
- Ticket locked for non-super_admin modification
- Can be archived (if `canArchiveTickets` permission)
- Auto-archived after 30 days (`cron.service.ts:113-145`)

---

## Lifecycle: Archive Phase

Tickets in `resolved` or `closed` status can be archived:

### Manual Archive
- `PUT /api/tickets/:id/archive` (`tickets.service.ts:909-932`)
- Requires `canArchiveTickets` permission + resolved/closed status
- Sets `isArchived = true`, `archivedAt = now()`, `archivedById = userId`
- Audit: `TICKET_ARCHIVED`

### Auto-Archive
- Cron at 4 AM daily (`jobs.module.ts:28-30`)
- Archives resolved/closed tickets with `completedAt < 30 days ago` and `isArchived = false`
- Audit: `AUTO_ARCHIVED`

Archived tickets remain in DB but excluded from active inbox/list views (`where: { isArchived: false }` in service queries).

---

## Side Effects Matrix

| Event | Audit Log | WebSocket | In-App Notification | Browser Push |
|-------|-----------|-----------|-------------------|--------------|
| Ticket created | TICKET_CREATED | new-ticket → dept | Yes (dept members) | Yes (if permitted) |
| Status changed | STATUS_CHANGED | status-updated → user + dept + ticket | Yes | Yes (if permitted) |
| Ticket reopened | TICKET_REOPENED | status-updated → user + dept + ticket | Yes | Yes (if permitted) |
| Ticket assigned | ASSIGNED | assigned → agent + ticket | Yes | Yes (if permitted) |
| Ticket transferred | TRANSFERRED | new-ticket → target dept; transferred → source dept | Yes | Yes (if permitted) |
| Comment added | (no audit) | new-comment → dept + creator + assignee | Yes | Yes (if permitted) |
| Creator confirmed | USER_CONFIRMATION | ticket-closed → dept | Yes | Yes (if permitted) |
| Ticket archived | TICKET_ARCHIVED | (none emitted) | No | No |
| SLA warning | (DB notification) | (not emitted via WS in cron) | Yes (in-app DB notification) | No |
| SLA breach | (DB notification) | (not emitted via WS in cron) | Yes (in-app DB notification) | No |