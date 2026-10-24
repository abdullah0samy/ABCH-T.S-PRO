# Agent Guide

This guide covers the daily workflow for agents in the ABCH Hospital Ticketing CRM. Agents are hospital staff assigned to handle service requests within their department.

## Daily Workflow Overview

```
Check Inbox → Accept Tickets → Work Tickets → Resolve → Confirm by Creator → Auto-Close
```

## 1. Inbox Management

**Frontend**: `InboxPage.tsx`  
**API**: `GET /api/tickets/department`

When you log in, your department inbox shows all tickets assigned to your department that are not yet archived. Tickets are sorted by creation time and can be filtered by status.

### Viewing Tickets in Your Inbox

The inbox displays:
- Ticket number (e.g., `TK-2024-0001`)
- Subject and description preview
- Status (pending, open, in_progress, resolved, closed)
- Priority (low, normal, high, critical)
- Creator name and department
- SLA deadline (if applicable)
- Building/Floor location info
- Linked asset (if applicable)

Tickets in your department inbox query uses `departmentId` filter from your user profile (`analytics.service.ts:L10-11`).

## 2. Ticket Acceptance

**API**: `PUT /api/tickets/:id/status`

When a new ticket arrives in `pending` status, you can accept it by changing its status to `open`.

### Steps

1. Navigate to your department inbox
2. Filter or search for `pending` tickets
3. Click on the ticket to open the detail view (`TicketDetailsPage.tsx`)
4. Change status from `pending` → `open`

**Effect**: This acknowledges the ticket and starts the active work timeline. The status transition `pending → open` is defined in `ALLOWED_TRANSITIONS` (`backend/src/modules/tickets/workflow.constants.ts:8`).

## 3. Assignment

**API**: `PUT /api/tickets/:id/assign`

Assign the ticket to yourself or another agent in your department.

### Steps

1. Open the ticket detail view
2. Click "Assign"
3. Select an agent from your department
4. Confirm assignment

The `assignedTo` field on the `Ticket` model (`schema.prisma:L222`) links to a `User`. Only users in the same department (or super_admins) can be assigned.

### Bulk Assignment

**API**: `POST /api/tickets/bulk-assign` (tickets.controller.ts:L81-83)

Select multiple tickets from the inbox and assign them all to the same agent in one operation.

## 4. Commenting

**API**: `POST /api/tickets/:id/comments` (tickets.controller.ts:L90-93)

Two types of comments (stored in `TicketMessage` with `messageType` field, `schema.prisma:L296`):

### Public Comments

Visible to all parties involved in the ticket, including the creator.

1. Open the ticket detail view
2. Type your message in the comment box
3. Set type to "public"
4. Submit

### Internal (Private) Comments

Visible only to agents and supervisors within the department. Use these for internal coordination.

1. Open the ticket detail view
2. Type your message
3. Set type to "internal"
4. Submit

### Attachments in Comments

Comments can include file attachments via `MessageAttachment` (`schema.prisma:L309-323`), including voice notes (`isVoiceNote = true`).

## 5. Status Progression

**API**: `PUT /api/tickets/:id/status`

The ticket lifecycle follows a strict state machine (`backend/src/modules/tickets/workflow.constants.ts:1-18`):

```
pending → open → in_progress → resolved → [creator confirms] → closed
```

### Transition Rules

| From          | To                  | Description                                           |
|---------------|---------------------|-------------------------------------------------------|
| pending       | open                | Agent accepts the ticket                              |
| pending       | in_progress         | Agent accepts and starts working immediately          |
| pending       | closed              | Close without action (e.g., duplicate, invalid)       |
| open          | in_progress         | Begin active work                                     |
| open          | closed              | Close without resolution                              |
| in_progress   | resolved            | Work is done, awaiting creator confirmation            |
| in_progress   | closed              | Force close without resolution                        |
| resolved      | in_progress         | Reopen — creator rejected resolution or more work needed |
| closed        | in_progress         | Reopen (super_admin only)                             |

**Important**: `resolved → closed` is **not** a direct transition. The creator must confirm the resolution via `PUT /api/tickets/:id/confirm`. Only a Super Admin can bypass this with `PATCH /api/tickets/:id`.

## 6. Bulk Operations

**API endpoints** (tickets.controller.ts):

| Operation           | Endpoint                        | Description                    |
|---------------------|---------------------------------|--------------------------------|
| Bulk Update Status  | `POST /api/tickets/bulk-update-status` | Change status for multiple tickets |
| Bulk Assign         | `POST /api/tickets/bulk-assign` | Assign multiple tickets to an agent |
| Bulk Archive        | `POST /api/tickets/bulk-archive` | Archive multiple tickets at once |

## 7. SLA Monitoring

### Understanding SLA

When a ticket is created, the SLA deadline is calculated based on:
1. Department's `slaHours` (default: 24) from `Department.slaHours` (`schema.prisma:L67`)
2. Ticket priority modifier from `PRIORITY_SLA_MODIFIERS` (`workflow.constants.ts:20-24`):
   - Low: 1.5x (36h for a 24h department)
   - Normal: 1.0x (24h)
   - High: 0.5x (12h)
   - Critical: 0.25x (6h)

### SLA Notifications

The cron job runs every 5 minutes (`backend/src/modules/jobs/cron.service.ts:36-110`) and sends:
- **SLA Warning** (`SLA_WARNING`): When 80% of SLA time is consumed
- **SLA Breach** (`SLA_BREACH`): When the deadline is past

These appear in your notification panel. To check overdue tickets:
1. Go to your inbox
2. Look for tickets with an expired SLA deadline
3. Prioritize high and critical tickets first

## 8. Transfer Process

**API**: `PUT /api/tickets/:id/transfer` (tickets.controller.ts:L85-87)

Transferring a ticket moves it to another department.

### Steps

1. Open the ticket detail view
2. Click "Transfer"
3. Select the target department (must be in your department's transfer allowlist)
4. Provide a reason for the transfer
5. Confirm

### Transfer Constraints

- The target department must be listed in `DeptTransferAllowlist` (`schema.prisma:L88-98`)
- A transfer record is created in `TicketTransfer` with `fromDepartmentId`, `toDepartmentId`, `reason`, and `transferredBy`
- The ticket's `departmentId` is updated to the target department
- The ticket status resets to `pending` in the new department

### View Transferred Tickets

**API**: `GET /api/tickets/transferred`  
**Frontend**: `TransferredPage.tsx`  
Shows all tickets that have been transferred to or from your department.

## 9. Archive

### Manual Archive

**API**: `PUT /api/tickets/:id/archive` (tickets.controller.ts:L121-123)

Archive a ticket to remove it from active views. Only tickets with status `resolved` or `closed` can be archived manually.

**Requires**: `canArchiveTickets` department permission.

### Auto-Archive

Tickets that have been `resolved` or `closed` for 30+ days are automatically archived at 4 AM daily (`backend/src/modules/jobs/cron.service.ts:113-145`).

### View Archived Tickets

**API**: `GET /api/tickets/archived`  
**Frontend**: `ArchivePage.tsx`

## Quick Reference

| Task               | Action                        | API Endpoint                         |
|--------------------|-------------------------------|--------------------------------------|
| Accept ticket      | Status → open                 | `PUT /api/tickets/:id/status`        |
| Assign ticket      | Set assignee                  | `PUT /api/tickets/:id/assign`        |
| Comment (public)   | Add public message            | `POST /api/tickets/:id/comments`     |
| Comment (internal) | Add internal note             | `POST /api/tickets/:id/comments`     |
| Work on ticket     | Status → in_progress          | `PUT /api/tickets/:id/status`        |
| Resolve ticket     | Status → resolved             | `PUT /api/tickets/:id/status`        |
| Transfer ticket    | Move to another dept          | `PUT /api/tickets/:id/transfer`      |
| Archive ticket     | Move to archive               | `PUT /api/tickets/:id/archive`       |
| Link tickets       | Associate related tickets     | `POST /api/tickets/:id/link`         |
| Unlink tickets     | Remove ticket association     | `POST /api/tickets/:id/unlink`       |
| View inbox         | Department ticket list        | `GET /api/tickets/department`        |