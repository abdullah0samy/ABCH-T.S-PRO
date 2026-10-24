# Super Admin Guide

This is the detailed step-by-step operational guide for Super Admins managing the ABCH Hospital Ticketing CRM.

## 1. User Management

**Frontend**: `UserManagementPage.tsx`  
**API**: `backend/src/modules/admin/controllers/admin-users.controller.ts`

### 1.1 Create User

1. Navigate to **Admin > Users**
2. Click "Create User"
3. Fill in required fields:

| Field            | Type          | Required | Notes                                            |
|------------------|---------------|----------|--------------------------------------------------|
| Badge Number     | String        | Yes      | Must be unique; hospital ID format               |
| Username         | String        | Yes      | Unique; alphanumerics, underscore, dot, hyphen   |
| Password         | String        | Yes      | Hashed with bcrypt before storage                |
| Full Name (Ar)   | String        | Yes      | Arabic display name                              |
| Full Name (En)   | String        | No       | English display name                             |
| Email            | String        | No       | Validated with regex                             |
| Role             | Enum          | Yes      | super_admin, supervisor, agent, end_user         |
| Department       | Reference     | No       | Required for agents/supervisors                  |
| Language Pref    | String        | No       | `ar` (default) or `en`                           |
| Active           | Boolean       | No       | Default: `true`                                  |
| Force Password Change | Boolean  | No       | Default: `false`                                 |

4. Click "Save"

**Validation**: Username format enforced by regex `^[a-zA-Z0-9_.-]+$` (`backend/src/modules/auth/auth.service.ts:21`).

### 1.2 Edit User

1. Navigate to **Admin > Users**
2. Find the user by searching badge number, username, or name
3. Click the edit icon
4. Modify fields as needed
5. Click "Save"

### 1.3 Edit User with Permission Overrides

A Super Admin can grant or revoke specific permissions for individual users without changing their role:

1. Navigate to **Admin > Users**
2. Select the user
3. Go to "Permission Overrides"
4. Toggle any of the 13 permission flags:
   - `canReceiveTickets` (default: true)
   - `canSendTickets` (default: false)
   - `canViewAllDeptTickets` (default: true)
   - `canAssignTickets` (default: true)
   - `canChangeStatus` (default: true)
   - `canTransferTickets` (default: true)
   - `canArchiveTickets` (default: false)
   - `canExportData` (default: false)
   - `canViewAnalytics` (default: false)
   - `canManageTeamNotes` (default: true)
   - `canManageDeptUsers` (default: false)
   - `canViewAuditLogs` (default: false)
   - `canManageKnowledgeBase` (default: false)
5. Optionally set `allowedTransferDeptIds` to restrict which departments this user can transfer tickets to
6. Save

Permission overrides are stored in `UserPermissionOverride` (`schema.prisma:L167-187`) and take precedence over department defaults.

### 1.4 Delete User

1. Navigate to **Admin > Users**
2. Select the user
3. Click "Delete"
4. Confirm deletion

**Note**: This is a soft delete — sets `deletedAt` timestamp. The user record is preserved for audit trail continuity.

### 1.5 Reset Password / Force Password Change

1. Navigate to **Admin > Users**
2. Select the user
3. Enable "Force Password Change"
4. Optionally reset `failedLoginAttempts` to 0 and clear `lockUntil`
5. Save

## 2. Role & Permission Management

**Frontend**: `RoleManagementPage.tsx`  
**API**: `backend/src/modules/admin/controllers/admin-roles.controller.ts`

### 2.1 Create a Role

1. Navigate to **Admin > Roles**
2. Click "Create Role"
3. Enter:
   - **Name** (unique string)
   - **Description** (optional)
4. Select permissions from the available list
5. Save

### 2.2 Assign Permissions to a Role

The `Role` → `Permission` relationship is many-to-many (`schema.prisma:L155-165`):

1. Select an existing role
2. Toggle permissions on/off
3. Each `Permission` record has a `name` (unique) and optional `description`
4. Save

### 2.3 Assign a Role to a User

1. Navigate to **Admin > Users**
2. Select or create a user
3. Select the desired role from the dropdown
4. Save

### 2.4 Default Roles

The project seeds these default roles:
- **super_admin**: Full system access
- **supervisor**: Department management + analytics
- **agent**: Ticket handling within department
- **end_user**: Create tickets, view own tickets, KB access

## 3. Department Setup

**Frontend**: `DepartmentsPage.tsx`  
**API**: `backend/src/modules/admin/controllers/admin-departments.controller.ts`

### 3.1 Create a Department

1. Navigate to **Admin > Departments**
2. Click "Create Department"
3. Fill in:

| Field                 | Type       | Required | Default          | Notes                                   |
|-----------------------|------------|----------|------------------|-----------------------------------------|
| Name (Ar)             | String     | Yes      |                  | Arabic display name                     |
| Name (En)             | String     | Yes      |                  | English display name                    |
| Description (Ar)      | String     | No       |                  | Arabic description                      |
| Description (En)      | String     | No       |                  | English description                     |
| Department Type       | Enum       | Yes      | `RECEIVER_ONLY`  | RECEIVER_ONLY, SENDER_ONLY, or BOTH    |
| SLA Hours             | Integer    | Yes      | 24               | Base SLA window in hours               |
| Default Permissions   | Reference  | Yes      | New record       | Links to a DeptPermissions record      |
| Active                | Boolean    | Yes      | `true`           | Soft-activate/deactivate               |

### 3.2 Configure Transfer Allowlist

Transfer allowlist entries define which departments can send tickets to which other departments (`DeptTransferAllowlist`, `schema.prisma:L88-98`):

1. Navigate to **Admin > Departments**
2. Select a department
3. Go to "Transfer Allowlist"
4. Add entries:
   - **Source Department**: Which department can send
   - **Target Department**: Which department receives
   - **Active**: Enable/disable (default: true)
5. Save

**Constraint**: Unique on `[sourceDeptId, targetDeptId]` — only one allowlist entry per source-target pair.

## 4. Building & Floor Management

**Frontend**: `BuildingsPage.tsx`, `FloorsPage.tsx`  
**API**: `admin-buildings.controller.ts`, `admin-floors.controller.ts`

### 4.1 Create a Building

1. Navigate to **Admin > Buildings**
2. Click "Create Building"
3. Enter:
   - **Name (Ar)**: Arabic building name
   - **Name (En)**: English building name
   - **Active**: true (default)
4. Save

### 4.2 Create a Floor

1. Navigate to **Admin > Floors**
2. Click "Create Floor"
3. Select the parent building
4. Enter:
   - **Name (Ar)**: Arabic floor name
   - **Name (En)**: English floor name
   - **Active**: true (default)
5. Save

**Constraint**: Unique on `[buildingId, nameAr]` — no duplicate floor names within a building (`schema.prisma:L53-54`).

**Cascade**: Deleting a building deletes all its floors (`onDelete: Cascade` on the Floor→Building relation, `schema.prisma:L50`).

## 5. Ticket Type Management

**Frontend**: `TicketTypesPage.tsx`  
**API**: `admin-ticket-types.controller.ts`

### 5.1 Create Ticket Type

1. Navigate to **Admin > Ticket Types**
2. Click "Create Ticket Type"
3. Enter:

| Field            | Type     | Required | Default        | Notes                             |
|------------------|----------|----------|----------------|-----------------------------------|
| Name (Ar)        | String   | Yes      |                | Arabic display name               |
| Name (En)        | String   | Yes      |                | English display name              |
| Department       | Ref      | No       | Global         | Scope to specific department      |
| Color            | String   | No       | `#6B7280`      | Hex color for UI indicators       |
| SLA Hours        | Integer  | No       | Uses dept SLA  | Override department's SLA         |
| Active           | Boolean  | Yes      | `true`         | Enable/disable                    |
| Display Order    | Integer  | Yes      | 0              | Sort order in dropdown            |

### 5.2 SLA Hours Override

If a ticket type has `slaHours` set, it overrides the department's default SLA. Priority modifiers are still applied on top of this type-level SLA (`backend/src/modules/tickets/sla.utils.ts`).

## 6. Asset Lifecycle Management

**Frontend**: `AssetManagementPage.tsx`  
**API**: Assets module controller

### 6.1 Create Asset

1. Navigate to **Admin > Assets**
2. Click "Create Asset"
3. Enter:

| Field            | Type     | Required | Default    | Notes                              |
|------------------|----------|----------|------------|------------------------------------|
| Name             | String   | Yes      |            | Asset display name                 |
| Serial Number    | String   | No       |            | Unique identifier (auto-unique)   |
| Type             | String   | Yes      |            | e.g. "Medical Device", "IT Hardware" |
| Location         | String   | No       |            | Physical location                  |
| Department       | Ref      | No       |            | Responsible department             |
| Status           | Enum     | Yes      | `active`   | active, maintenance, retired       |
| Purchase Date    | Date     | No       |            | Acquisition date                   |
| Warranty Expiry  | Date     | No       |            | Warranty end date                  |

### 6.2 Asset Status Transitions

| From        | To          | When                                  |
|-------------|-------------|---------------------------------------|
| active      | maintenance | Asset needs repair or servicing       |
| maintenance | active      | Asset returned to service             |
| maintenance | retired     | Asset decommissioned                  |
| active      | retired     | Direct decommission                   |

Assets can be linked to tickets via `Ticket.assetId` to track which assets are involved in specific service requests.

## 7. Audit Log Filtering

**Frontend**: `AuditLogPage.tsx`  
**API**: `GET /api/audit-logs` (audit.service.ts)

### Filtering Options

| Filter           | Type     | Description                              |
|------------------|----------|------------------------------------------|
| User ID          | Number   | Filter by specific user                  |
| Action           | String   | Filter by action type (e.g., CREATE_TICKET) |
| Department ID    | Number   | Filter by department                     |
| Ticket ID        | Number   | Filter by specific ticket                |
| Start Date       | String   | ISO date string (inclusive)              |
| End Date         | String   | ISO date string (inclusive, end of day)  |
| Page             | Number   | Page number (default: 1)                 |
| Limit            | Number   | Items per page (default: 20, max: 100)   |

### Response Format

```json
{
  "logs": [...],
  "pagination": {
    "total": 1234,
    "page": 1,
    "limit": 20,
    "totalPages": 62
  }
}
```

Each log entry includes: `id`, `action`, `entityType`, `entityId`, `oldData`, `newData`, `ipAddress`, `userAgent`, `createdAt`, plus joined user/department/ticket details.

### Available Action Types

The system dynamically returns available actions via `GET /api/audit-logs/actions` (`audit.service.ts:L52-54`). Common actions include:
- `CREATE_TICKET`, `UPDATE_TICKET_STATUS`, `CLOSE_TICKET`
- `CREATE_USER`, `DELETE_USER`, `UPDATE_USER`
- `CREATE_ROLE`, `UPDATE_ROLE`, `DELETE_ROLE`
- `CREATE_DEPARTMENT`, `UPDATE_DEPARTMENT`
- `SLA_BREACH`, `SLA_WARNING`
- `AUTO_ARCHIVED`
- `EXPORT_DATA`
- `TRANSFER_TICKET`

## 8. Knowledge Base Article Management

**Frontend**: `KnowledgeBasePage.tsx`  
**API**: `knowledge.controller.ts`

### 8.1 Create Category

1. Navigate to **Knowledge Base > Categories**
2. Click "Create Category"
3. Enter name in Arabic and English
4. Save

### 8.2 Create Article

1. Navigate to **Knowledge Base**
2. Click "Create Article"
3. Fill in:

| Field       | Type   | Required | Notes                               |
|-------------|--------|----------|-------------------------------------|
| Title (Ar)  | String | Yes      | Arabic article title                |
| Title (En)  | String | Yes      | English article title               |
| Content (Ar)| String | Yes     | Arabic article body                |
| Content (En)| String | Yes     | English article body               |
| Category    | Ref    | Yes      | Parent category                    |
| Active      | Boolean| Yes      | `true` to publish, `false` for draft |

### 8.3 Managing Articles

- **Publish/Unpublish**: Toggle `isActive` flag
- **View Analytics**: Check `views` count per article (`schema.prisma:L536`)
- **Authorship**: Each article tracks `authorId` for content ownership
- **Search**: End users can browse and search published articles by category and content

### 8.4 Seeding Knowledge Base

Run the seed script to populate initial KB content:
```sh
npm run seed-kb
```

## 9. Ticket Force Override (Super Admin Exclusive)

**API**: `PATCH /api/tickets/:id` (tickets.controller.ts:L126-128)

As a super admin, you can override ANY ticket status, regardless of the normal workflow rules:

1. Open the ticket detail view
2. Access the admin override option
3. Set any field: status, department, assignee, priority, etc.
4. The action is recorded in `AuditLog` with the super admin's user ID

This bypasses `ALLOWED_TRANSITIONS` constraints and is useful for:
- Force-closing problematic tickets
- Reopening tickets that should have been closed
- Correcting miscategorized tickets (wrong department/type)
- Emergency reassignments

## Quick Reference Commands

```sh
# Reset a locked user account
psql -h localhost -p 5445 -U johndoe -d abch_db \
  -c "UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = <id>;"

# View transfer allowlist for a department
psql -h localhost -p 5445 -U johndoe -d abch_db \
  -c "SELECT s.name_en AS source, t.name_en AS target FROM dept_transfer_allowlist dta JOIN departments s ON dta.source_dept_id = s.id JOIN departments t ON dta.target_dept_id = t.id WHERE dta.source_dept_id = <id> AND dta.is_active = true;"

# Find all users with permission overrides
psql -h localhost -p 5445 -U johndoe -d abch_db \
  -c "SELECT u.username, upo.* FROM user_permission_overrides upo JOIN users u ON upo.user_id = u.id;"
```