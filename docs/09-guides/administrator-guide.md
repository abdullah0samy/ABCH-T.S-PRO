# Administrator Guide

This guide covers Super Admin operations for the ABCH Hospital Ticketing CRM. For detailed step-by-step procedures with UI references, see the `super-admin-guide.md`.

## Overview of Admin Capabilities

The Super Admin role (`role = 'super_admin'` in the `User` schema) has unrestricted access to:
- All tickets across all departments
- User management (CRUD + password reset)
- Role and Permission management
- Department and Transfer Allowlist configuration
- Building and Floor hierarchy
- Ticket Type management with SLA overrides
- Asset lifecycle management
- Audit Log review
- Knowledge Base oversight
- Analytics and Reporting
- Ticket override (force any status transition)

## User Management

**API**: `POST/PATCH/DELETE /api/admin/users` (admin-users.controller.ts)  
**Frontend page**: `UserManagementPage.tsx`

### Create User

Required fields from `User` schema (`schema.prisma:L101-143`):
- `badgeNumber` (unique)
- `username` (unique, alphanumerics, underscores, dots, hyphens, plus signs)
- `passwordHash` (bcrypt-hashed by the service)
- `fullNameAr` (required)
- `role` (one of: `super_admin`, `supervisor`, `agent`, `end_user`)
- `departmentId` (optional for end users, required for agents/supervisors)

### Edit User

Fields that can be updated:
- `fullNameAr`, `fullNameEn`, `email`, `role`, `departmentId`, `isActive`, `langPref`, `avatarUrl`, `about`

### Reset Password

Set `forcePasswordChange = true` to require password change on next login. Also reset `failedLoginAttempts` and `lockUntil` if the account was locked.

### Delete User

Soft delete sets `deletedAt` timestamp. The user remains in the database for audit trail continuity.

### Account Lockout Recovery

If a user is locked due to failed login attempts (5+ failures → 15 min lock):

```sql
UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = <user_id>;
```

See `backend/src/modules/auth/auth.service.ts:58-60`.

## Department Management

**API**: `POST/PATCH/DELETE /api/admin/departments` (admin-departments.controller.ts)  
**Frontend page**: `DepartmentsPage.tsx`

### Department Types

`deptType` field values (`schema.prisma:L65`):
- `RECEIVER_ONLY` — can only receive tickets, cannot create (default)
- `SENDER_ONLY` — can send tickets to other departments
- `BOTH` — can both send and receive

### Default Permissions

Each department links to a `DeptPermissions` record (`defaultPermissionsId`, L66). This defines the department's default capability matrix across 13 permission flags (L12-27 in schema).

### SLA Hours

`slaHours` (default: 24) sets the base SLA window. Priority modifiers adjust this (`backend/src/modules/tickets/workflow.constants.ts:20-24`):
| Priority  | Modifier | Effect          |
|-----------|----------|-----------------|
| low       | 1.5x     | +50% time       |
| normal    | 1.0x     | base time       |
| high      | 0.5x     | -50% time       |
| critical  | 0.25x    | -75% time       |

## Role & Permission Management

**API**: `POST/PATCH/DELETE /api/admin/roles` (admin-roles.controller.ts)  
**Frontend page**: `RoleManagementPage.tsx`

### Role-Permission Model

- `Role` → `Permission` (many-to-many via `Role.permissions`)
- Each `Role` is assigned to zero or more `User`s via `roleId`

### Department-Level Permissions

Beyond the Role-Permission model, departments have a second permission layer via `DeptPermissions` (13 flags). A user's effective permissions are computed as:
1. Check `UserPermissionOverride` for the user (if exists)
2. Fall back to department's `defaultPermissions`
3. Fall back to role-level permissions

### Permission Override

`UserPermissionOverride` (`schema.prisma:L167-187`) allows per-user permission adjustments:
- Each of the 13 permission flags can be overridden per user
- `allowedTransferDeptIds` (JSON string) restricts which departments a user can transfer tickets to

## Ticket Operations (Super Admin Override)

**API**: `PATCH /api/tickets/:id` — `superAdminOverride` (tickets.controller.ts:L126-128)

The Super Admin can force any status transition, bypassing the normal workflow constraints defined in `ALLOWED_TRANSITIONS` (`backend/src/modules/tickets/workflow.constants.ts:7-18`). This includes:
- Force-closing a ticket from any status
- Reopening a `closed` ticket
- Changing department or assignee without restrictions

### Normal Status Flow (for reference)

```
pending → open → in_progress → resolved → (creator confirms) → closed
```

`resolved` → `closed` is **only** possible via:
1. Creator confirmation (`PUT /api/tickets/:id/confirm`)
2. Super Admin force-close (`PATCH /api/tickets/:id`)

See `workflow.constants.ts:14-15` comments.

## Analytics & Reporting

**API**: `/api/analytics/*` (analytics.controller.ts)  
**Frontend page**: `AnalyticsPage.tsx`

### Available Metrics

From `AnalyticsService.getDashboardSummary()` (analytics.service.ts:L35-114):
- **Stats**: total, pending, open, resolved, overdue, SLA breaches, avg resolution time, internal vs external resource resolution counts
- **Status Distribution**: ticket counts grouped by status
- **Priority Distribution**: ticket counts grouped by priority
- **Department Performance**: ticket volume per department
- **Agent Performance**: resolved count, avg resolution time, avg response time, SLA adherence rate per agent
- **Export History**: recent data exports with metadata
- **Asset Summary**: total, active, maintenance, retired counts

### Data Export (Excel)

**API**: `POST /api/analytics/export` → uses ExcelJS (`analytics.service.ts:299-352`)
- Requires `canExportData` permission for non-super-admins
- Generates `.xlsx` files with columns: Ticket #, Subject, Status, Priority, Department, Type, Creator, Assigned To, Created At, SLA Deadline
- Export files expire after 24 hours and are cleaned by the 3 AM cron job

## Audit Log Review

**API**: `GET /api/audit-logs` (audit.controller.ts), paginated (max 100 per page)  
**Frontend page**: `AuditLogPage.tsx`

### Filtering

Parameters (`audit.service.ts:L10-28`):
- `userId` — filter by user
- `action` — filter by action type (e.g., `CREATE_TICKET`, `UPDATE_STATUS`, `AUTO_ARCHIVED`)
- `departmentId` — filter by department
- `startDate` / `endDate` — date range
- `ticketId` — filter by specific ticket
- `page` / `limit` — pagination (default: page 1, 20 per page)

### Common Actions to Monitor

- `CREATE_USER` / `DELETE_USER` — account management changes
- `UPDATE_PERMISSIONS` — permission modifications
- `SLA_BREACH` / `SLA_WARNING` — SLA events
- `AUTO_ARCHIVED` — automated archival
- `EXPORT_DATA` — data export operations

## Knowledge Base Oversight

**API**: `/api/knowledge/*` (knowledge.controller.ts)  
**Frontend page**: `KnowledgeBasePage.tsx`

The Super Admin has full access to:
- View all knowledge categories and articles
- Create/edit/publish/unpublish articles
- Review article view counts
- Manage category hierarchy

Articles support bilingual content (`titleAr`/`titleEn`, `contentAr`/`contentEn`).

## Asset Management

**API**: `/api/assets/*` (assets module)  
**Frontend page**: `AssetManagementPage.tsx`

**Asset statuses** (`schema.prisma:L506`):
- `active` — operational asset
- `maintenance` — currently under maintenance
- `retired` — decommissioned

Fields: `name`, `serialNumber` (unique), `type`, `location`, `departmentId`, `purchaseDate`, `warrantyExpiry`.

Assets can be linked to tickets via `Ticket.assetId`.

## Quick Reference: Frontend Admin Pages

| Page                    | Route                 | Admin Module                    |
|-------------------------|-----------------------|---------------------------------|
| UserManagementPage.tsx  | admin/users           | admin-users.controller.ts       |
| DepartmentsPage.tsx     | admin/departments     | admin-departments.controller.ts |
| RoleManagementPage.tsx  | admin/roles           | admin-roles.controller.ts       |
| BuildingsPage.tsx       | admin/buildings       | admin-buildings.controller.ts   |
| FloorsPage.tsx          | admin/floors          | admin-floors.controller.ts      |
| TicketTypesPage.tsx     | admin/ticket-types    | admin-ticket-types.controller.ts|
| AssetManagementPage.tsx | admin/assets          | assets controller               |
| AuditLogPage.tsx        | audit-logs            | audit.controller.ts             |
| AnalyticsPage.tsx       | analytics             | analytics.controller.ts         |
| KnowledgeBasePage.tsx   | knowledge-base        | knowledge.controller.ts         |