# Supervisor Guide

Supervisors have all agent capabilities plus department-level oversight, analytics access, and team management features.

## What You Can Do

As a supervisor, your role field is `supervisor` (`schema.prisma:L109`). You inherit all agent capabilities and gain:
- Department analytics dashboard
- Team feed management
- Transfer oversight
- Team performance tracking
- Data export (if department grants `canExportData`)

## 1. Agent Capabilities (Inherited)

You can do everything an agent can do:
- View and manage department inbox
- Accept, assign, and update tickets
- Add public and internal comments
- Progress tickets through status workflow
- Transfer tickets between departments
- Archive resolved tickets

See the **Agent Guide** for details on each of these operations.

## 2. Department Analytics

**Frontend**: `AnalyticsPage.tsx`  
**API**: `GET /api/analytics/*`

You have access to all analytics data for your department. Supervisors see department-scoped data (`analytics.service.ts:C-4`).

### Available Analytics

#### Dashboard Summary (`GET /api/analytics/dashboard`)

Returns:
- Ticket counts: pending, open, resolved, total, overdue (SLA breached)
- SLA breach statistics (current breaches + resolved-but-breached)
- Average resolution time in hours
- Internal vs external resource resolution counts
- Status and priority distributions
- Agent performance metrics (your team only)
- Asset summary: active, maintenance, retired counts

#### Agent Performance (`GET /api/analytics/agent-performance`)

For each agent in your department, reports:
- `resolvedCount` — total resolved/closed tickets
- `avgResolutionTimeHours` — mean time from creation to completion
- `avgResponseTimeHours` — mean time to first response
- `slaAdherenceRate` — percentage of tickets completed within SLA

Supervisors can only see metrics for agents in **their own department** (`analytics.service.ts:165-166`).

#### Average Handling Time (`GET /api/analytics/aht`)

AHT measures the time tickets spend in `in_progress` status, derived from `TicketStatusHistory` entries. Unlike resolution time (creation to completion), AHT excludes time spent waiting. Reports:
- Overall AHT in hours
- AHT by priority level
- Ticket count per priority

#### Status & Priority Distribution

- `GET /api/analytics/status-distribution` — ticket counts by status
- `GET /api/analytics/priority-distribution` — ticket counts by priority

### Access Requirements

Supervisors have analytics access by default (`analytics.service.ts:L31: if (userRole === 'supervisor') return true`). However, this can be overridden via `UserPermissionOverride.canViewAnalytics`.

## 3. Data Export

**API**: `POST /api/analytics/export`  
**Requires**: `canExportData` department permission or `UserPermissionOverride`

### Generating an Export

1. Navigate to Analytics > Exports
2. Set date range (optional)
3. Click "Export"
4. Download the `.xlsx` file

The export includes columns: Ticket #, Subject, Status, Priority, Department, Type, Creator, Assigned To, Created At, SLA Deadline (`analytics.service.ts:314-325`).

### Export Constraints

- ExcelJS is used for file generation
- Export files are stored on the server under `uploads/exports/`
- Files expire after 24 hours
- Cleanup runs at 3 AM daily
- Export history is tracked in `ExportHistory` with `ticketCount`, `fileName`, `fileSize`, `expiresAt`
- Maximum of 100 records per page in export history listing

### Viewing Export History

**API**: `GET /api/analytics/exports` (paginated, supervisors see their own exports, super_admins see all)

## 4. Team Feed Management

**Frontend**: `TeamFeedPage.tsx`  
**Models**: `TeamNote`, `TeamNoteComment`, `TeamNoteLike`, `TeamNoteAttachment` (`schema.prisma:L376-432`)

### Creating Team Notes

Team notes are internal department communication. As a supervisor:

1. Go to the Team Feed page
2. Create a new note with your message
3. Optionally attach files (images, docs, voice notes)
4. The note is visible to all members of your department

### Managing Team Notes

You can:
- Comment on existing notes
- Like notes (toggle on/off)
- View note authors and timestamps
- See attachment previews

Team notes support soft delete (`deletedAt` field).

## 5. Transfer Oversight

### Viewing Transfers

**Frontend**: `TransferredPage.tsx`  
**API**: `GET /api/tickets/transferred`

View all tickets that have been transferred to your department or transferred out from your department. Each transfer record includes:
- Original ticket number
- Source and target departments
- Transfer reason
- Who performed the transfer (`transferredBy`)
- Timestamp

### Transfer Allowlist

Transfers can only occur between departments that have an entry in `DeptTransferAllowlist` (`schema.prisma:L88-98`). Check valid transfer destinations:

```sql
-- Departments your dept can transfer TO
SELECT d.name_en FROM departments d
JOIN dept_transfer_allowlist dt ON d.id = dt.target_dept_id
WHERE dt.source_dept_id = <your_dept_id> AND dt.is_active = true;

-- Departments that can transfer TO your dept
SELECT d.name_en FROM departments d
JOIN dept_transfer_allowlist dt ON d.id = dt.source_dept_id
WHERE dt.target_dept_id = <your_dept_id> AND dt.is_active = true;
```

## 6. Team Performance Tracking

### Key Metrics to Monitor

| Metric                   | Source                      | Interpretation                                      |
|--------------------------|-----------------------------|-----------------------------------------------------|
| SLA Breach Rate          | `analytics.slaBreaches`     | Percentage of tickets missing SLA deadlines         |
| Avg Resolution Time      | `analytics.avgResolutionTimeHours` | Mean time to resolve (lower is better)       |
| Agent SLA Adherence      | `agentPerformance.slaAdherenceRate` | % of tickets resolved within SLA per agent |
| Pending/Backlog Count    | `analytics.pending`         | Number of unaccepted tickets                        |
| AHT by Priority          | `analytics/aht`             | Active handling time by priority level              |

### Alerting on SLA Breaches

The system automatically notifies all active department users when a ticket breaches SLA. Monitor the notification panel for `SLA_BREACH` events.

Reassign overloaded agents if their backlog is growing or SLA adherence is dropping.

## Quick Reference: Supervisor vs Agent Permissions

| Capability                  | Agent   | Supervisor                        |
|-----------------------------|---------|-----------------------------------|
| Department inbox            | Yes     | Yes                               |
| Ticket CRUD operations      | Yes     | Yes                               |
| Comment (public/internal)   | Yes     | Yes                               |
| Transfer tickets            | Yes     | Yes                               |
| Department analytics        | No*     | Yes (default)                     |
| Agent performance metrics   | No      | Yes (own department only)         |
| Data export                 | No*     | If dept permission `canExportData`|
| Team feed management        | Yes (if dept allows) | Yes                         |
| Transfer oversight          | No      | Yes                               |

*Unless explicitly granted via `UserPermissionOverride`