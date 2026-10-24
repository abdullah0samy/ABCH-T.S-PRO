# Database Documentation — ABCH Hospital Ticketing CRM

**Source:** [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)
**Provider:** PostgreSQL
**ORM:** Prisma Client

---

## Table Summary (29 tables)

| # | Model | Table Name | Purpose |
|---|---|---|---|
| 1 | `DeptPermissions` | `dept_permissions` | Granular department permission flags |
| 2 | `Building` | `buildings` | Hospital buildings |
| 3 | `Floor` | `floors` | Floors within buildings |
| 4 | `Department` | `departments` | Hospital departments |
| 5 | `DeptTransferAllowlist` | `dept_transfer_allowlist` | Allowed inter-department ticket transfers |
| 6 | `User` | `users` | User accounts |
| 7 | `Role` | `roles` | Named roles |
| 8 | `Permission` | `permissions` | Individual permission flags linked to roles |
| 9 | `UserPermissionOverride` | `user_permission_overrides` | Per-user permission overrides |
| 10 | `TicketType` | `ticket_types` | Ticket issue types |
| 11 | `Ticket` | `tickets` | Core ticket records |
| 12 | `TicketAttachment` | `ticket_attachments` | Files attached to tickets |
| 13 | `TicketMessage` | `ticket_messages` | Comments/messages on tickets |
| 14 | `MessageAttachment` | `message_attachments` | Files attached to messages |
| 15 | `TicketTransfer` | `ticket_transfers` | Ticket transfer audit trail |
| 16 | `TicketStatusHistory` | `ticket_status_history` | Status change history |
| 17 | `Notification` | `notifications` | User notifications |
| 18 | `TeamNote` | `team_notes` | Team collaboration notes |
| 19 | `TeamNoteComment` | `team_note_comments` | Comments on team notes |
| 20 | `TeamNoteLike` | `team_note_likes` | Likes on team notes |
| 21 | `TeamNoteAttachment` | `team_note_attachments` | Files on team notes |
| 22 | `PushSubscription` | `push_subscriptions` | Web Push (VAPID) subscriptions |
| 23 | `AuditLog` | `audit_logs` | System-wide audit trail |
| 24 | `SystemSetting` | `system_settings` | Key-value system configuration |
| 25 | `ExportHistory` | `export_history` | Data export records |
| 26 | `Asset` | `assets` | Hospital assets/equipment |
| 27 | `KnowledgeCategory` | `knowledge_categories` | Knowledge base categories |
| 28 | `KnowledgeArticle` | `knowledge_articles` | Knowledge base articles |

---

## 1. DeptPermissions

**Model:** `DeptPermissions` | **Table:** `dept_permissions` | **Source:** `schema.prisma:12-30`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `canReceiveTickets` | `Boolean` | — | `can_receive_tickets` | `true` |
| `canSendTickets` | `Boolean` | — | `can_send_tickets` | `false` |
| `canViewAllDeptTickets` | `Boolean` | — | `can_view_all_dept_tickets` | `true` |
| `canAssignTickets` | `Boolean` | — | `can_assign_tickets` | `true` |
| `canChangeStatus` | `Boolean` | — | `can_change_status` | `true` |
| `canTransferTickets` | `Boolean` | — | `can_transfer_tickets` | `true` |
| `canArchiveTickets` | `Boolean` | — | `can_archive_tickets` | `false` |
| `canExportData` | `Boolean` | — | `can_export_data` | `false` |
| `canViewAnalytics` | `Boolean` | — | `can_view_analytics` | `false` |
| `canManageTeamNotes` | `Boolean` | — | `can_manage_team_notes` | `true` |
| `canManageDeptUsers` | `Boolean` | — | `can_manage_dept_users` | `false` |
| `canViewAuditLogs` | `Boolean` | — | `can_view_audit_logs` | `false` |
| `canManageKnowledgeBase` | `Boolean` | — | `can_manage_knowledge_base` | `false` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `departments` | O → M | `Department.defaultPermissions` | — (no onDelete specified) |

---

## 2. Building

**Model:** `Building` | **Table:** `buildings` | **Source:** `schema.prisma:32-43`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `nameAr` | `String` | Required | `name_ar` | — |
| `nameEn` | `String` | Required | `name_en` | — |
| `isActive` | `Boolean` | — | `is_active` | `true` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `floors` | O → M | `Floor.building` | onDelete: Cascade |
| `tickets` | O → M | `Ticket.building` | — |

---

## 3. Floor

**Model:** `Floor` | **Table:** `floors` | **Source:** `schema.prisma:45-57`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `nameAr` | `String` | Required; `@@unique([buildingId, nameAr])` | `name_ar` | — |
| `nameEn` | `String` | Required | `name_en` | — |
| `buildingId` | `Int` | Required; FK → `Building.id` | `building_id` | — |
| `isActive` | `Boolean` | — | `is_active` | `true` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `building` | M → 1 | `Building.floors` | onDelete: Cascade |
| `tickets` | O → M | `Ticket.floor` | — |

---

## 4. Department

**Model:** `Department` | **Table:** `departments` | **Source:** `schema.prisma:59-86`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `nameAr` | `String` | Required | `name_ar` | — |
| `nameEn` | `String` | Required | `name_en` | — |
| `descriptionAr` | `String?` | Optional | `description_ar` | — |
| `descriptionEn` | `String?` | Optional | `description_en` | — |
| `deptType` | `String` | Required | `dept_type` | `"RECEIVER_ONLY"` |
| `defaultPermissionsId` | `Int` | Required; FK → `DeptPermissions.id` | `default_permissions_id` | — |
| `slaHours` | `Int` | Required | `sla_hours` | `24` |
| `isActive` | `Boolean` | — | `is_active` | `true` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |
| `deletedAt` | `DateTime?` | Optional | `deleted_at` | `null` |

### Soft Delete
`deletedAt` — soft-delete field used by `admin-departments.controller.ts:98`.

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `defaultPermissions` | M → 1 | `DeptPermissions.departments` | — |
| `allowedTransferTargets` | O → M | `DeptTransferAllowlist.targetDept` | — |
| `allowedTransferSources` | O → M | `DeptTransferAllowlist.sourceDept` | — |
| `exports` | O → M | `ExportHistory.department` | — |
| `teamNotes` | O → M | `TeamNote.department` | — |
| `transfersTo` | O → M | `TicketTransfer.toDepartment` | — |
| `transfersFrom` | O → M | `TicketTransfer.fromDepartment` | — |
| `ticketTypes` | O → M | `TicketType.department` | — |
| `ticketsIn` | O → M | `Ticket.department` | — |
| `users` | O → M | `User.department` | — |
| `assets` | O → M | `Asset.department` | — |
| `auditLogs` | O → M | `AuditLog.department` | — |

---

## 5. DeptTransferAllowlist

**Model:** `DeptTransferAllowlist` | **Table:** `dept_transfer_allowlist` | **Source:** `schema.prisma:88-99`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `sourceDeptId` | `Int` | Required; FK → `Department.id`; `@@unique([sourceDeptId, targetDeptId])` | `source_dept_id` | — |
| `targetDeptId` | `Int` | Required; FK → `Department.id` | `target_dept_id` | — |
| `isActive` | `Boolean` | — | `is_active` | `true` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `sourceDept` | M → 1 | `Department.allowedTransferSources` | — |
| `targetDept` | M → 1 | `Department.allowedTransferTargets` | — |

---

## 6. User

**Model:** `User` | **Table:** `users` | **Source:** `schema.prisma:101-143`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `badgeNumber` | `String` | Required, `@unique` | `badge_number` | — |
| `username` | `String` | Required, `@unique` | `username` | — |
| `email` | `String?` | Optional, `@unique` | `email` | — |
| `passwordHash` | `String` | Required | `password_hash` | — |
| `fullNameAr` | `String` | Required | `full_name_ar` | — |
| `fullNameEn` | `String?` | Optional | `full_name_en` | — |
| `role` | `String` | Required (stored string: `super_admin`, `supervisor`, `agent`, `end_user`) | `role` | `"end_user"` |
| `roleId` | `Int?` | Optional; FK → `Role.id` | `role_id` | — |
| `departmentId` | `Int?` | Optional; FK → `Department.id` | `department_id` | — |
| `avatarUrl` | `String?` | Optional | `avatar_url` | — |
| `about` | `String?` | Optional | `about` | — |
| `langPref` | `String` | Required | `lang_pref` | `"ar"` |
| `isActive` | `Boolean` | — | `is_active` | `true` |
| `forcePasswordChange` | `Boolean` | — | `force_password_change` | `false` |
| `lastLoginAt` | `DateTime?` | Optional | `last_login_at` | — |
| `lastLoginIp` | `String?` | Optional | `last_login_ip` | — |
| `failedLoginAttempts` | `Int` | — | `failed_login_attempts` | `0` |
| `lockUntil` | `DateTime?` | Optional | `lock_until` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |
| `deletedAt` | `DateTime?` | Optional | `deleted_at` | `null` |

### Soft Delete
`deletedAt` — soft-delete. Checked by `JwtAuthGuard` (`jwt-auth.guard.ts:24`).

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `department` | M → 1 | `Department.users` | — |
| `userRole` | M → 1 | `Role.users` | — |
| `permissionsOverride` | O → 1 | `UserPermissionOverride.user` | onDelete: Cascade |
| `ticketsCreated` | O → M | `Ticket.createdBy` | — |
| `ticketsAssigned` | O → M | `Ticket.assignedTo` | — |
| `ticketsArchived` | O → M | `Ticket.archivedBy` | — |
| `notifications` | O → M | `Notification.user` | onDelete: Cascade |
| `pushSubs` | O → M | `PushSubscription.user` | onDelete: Cascade |
| `teamNotes` | O → M | `TeamNote.author` | — |
| `messages` | O → M | `TicketMessage.sender` | — |
| `statusHistory` | O → M | `TicketStatusHistory.changedBy` | — |
| `transfers` | O → M | `TicketTransfer.transferredBy` | — |
| `teamNoteComments` | O → M | `TeamNoteComment.author` | — |
| `teamNoteLikes` | O → M | `TeamNoteLike.user` | — |
| `knowledgeArticles` | O → M | `KnowledgeArticle.author` | — |
| `auditLogs` | O → M | `AuditLog.user` | — |
| `exports` | O → M | `ExportHistory.exportedBy` | — |

---

## 7. Role

**Model:** `Role` | **Table:** `roles` | **Source:** `schema.prisma:145-155`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `name` | `String` | Required, `@unique` | `name` | — |
| `description` | `String?` | Optional | `description` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `permissions` | O → M (many-to-many) | `Permission.roles` | — |
| `users` | O → M | `User.userRole` | — |

---

## 8. Permission

**Model:** `Permission` | **Table:** `permissions` | **Source:** `schema.prisma:157-165`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `name` | `String` | Required, `@unique` | `name` | — |
| `description` | `String?` | Optional | `description` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `roles` | O → M (many-to-many) | `Role.permissions` | — |

---

## 9. UserPermissionOverride

**Model:** `UserPermissionOverride` | **Table:** `user_permission_overrides` | **Source:** `schema.prisma:167-187`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `userId` | `Int` | Required, `@unique`; FK → `User.id` | `user_id` | — |
| `canReceiveTickets` | `Boolean?` | Optional | `can_receive_tickets` | — |
| `canSendTickets` | `Boolean?` | Optional | `can_send_tickets` | — |
| `canViewAllDeptTickets` | `Boolean?` | Optional | `can_view_all_dept_tickets` | — |
| `canAssignTickets` | `Boolean?` | Optional | `can_assign_tickets` | — |
| `canChangeStatus` | `Boolean?` | Optional | `can_change_status` | — |
| `canTransferTickets` | `Boolean?` | Optional | `can_transfer_tickets` | — |
| `canArchiveTickets` | `Boolean?` | Optional | `can_archive_tickets` | — |
| `canExportData` | `Boolean?` | Optional | `can_export_data` | — |
| `canViewAnalytics` | `Boolean?` | Optional | `can_view_analytics` | — |
| `canManageTeamNotes` | `Boolean?` | Optional | `can_manage_team_notes` | — |
| `canManageDeptUsers` | `Boolean?` | Optional | `can_manage_dept_users` | — |
| `canViewAuditLogs` | `Boolean?` | Optional | `can_view_audit_logs` | — |
| `canManageKnowledgeBase` | `Boolean?` | Optional | `can_manage_knowledge_base` | — |
| `allowedTransferDeptIds` | `String?` | Optional (JSON array string) | `allowed_transfer_dept_ids` | — |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `user` | M → 1 | `User.permissionsOverride` | onDelete: Cascade |

### Notes
- All boolean fields are nullable; `null` means "inherit from department defaults"
- Resolution order: `UserPermissionOverride` → `DeptPermissions` → hardcoded fallback (`tickets.service.ts:40-55`)
- Cached in `permissionCache` for performance

---

## 10. TicketType

**Model:** `TicketType` | **Table:** `ticket_types` | **Source:** `schema.prisma:189-203`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `nameAr` | `String` | Required | `name_ar` | — |
| `nameEn` | `String` | Required | `name_en` | — |
| `departmentId` | `Int?` | Optional; FK → `Department.id` | `department_id` | — |
| `color` | `String` | — | `color` | `"#6B7280"` |
| `slaHours` | `Int?` | Optional (overrides dept SLA if set) | `sla_hours` | — |
| `isActive` | `Boolean` | — | `is_active` | `true` |
| `displayOrder` | `Int` | — | `display_order` | `0` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `department` | M → 1 | `Department.ticketTypes` | — |
| `tickets` | O → M | `Ticket.ticketType` | — |

---

## 11. Ticket

**Model:** `Ticket` | **Table:** `tickets` | **Source:** `schema.prisma:205-273`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `ticketNumber` | `String` | Required, `@unique` (format: `TKT-YYMMDD-NNN`) | `ticket_number` | — |
| `subject` | `String?` | Optional | `subject` | — |
| `createdById` | `Int` | Required; FK → `User.id` | `created_by` | — |
| `creatorName` | `String` | Required (denormalized) | `creator_name` | — |
| `creatorPhone` | `String?` | Optional | `creator_phone` | — |
| `creatorExtension` | `String?` | Optional | `creator_extension` | — |
| `creatorDeptId` | `Int?` | Optional | `creator_dept_id` | — |
| `creatorDeptName` | `String?` | Optional | `creator_dept_name` | — |
| `buildingId` | `Int?` | Optional; FK → `Building.id` | `building_id` | — |
| `buildingName` | `String?` | Optional (denormalized) | `building_name` | — |
| `floorId` | `Int?` | Optional; FK → `Floor.id` | `floor_id` | — |
| `floorName` | `String?` | Optional (denormalized) | `floor_name` | — |
| `roomExtension` | `String?` | Optional | `room_extension` | — |
| `description` | `String` | Required | `description` | — |
| `departmentId` | `Int` | Required; FK → `Department.id` | `department_id` | — |
| `assignedToId` | `Int?` | Optional; FK → `User.id` | `assigned_to` | — |
| `ticketTypeId` | `Int?` | Optional; FK → `TicketType.id` | `ticket_type_id` | — |
| `status` | `String` | Required | `status` | `"pending"` |
| `priority` | `String` | Required | `priority` | `"normal"` |
| `holdingStatus` | `String` | Required | `holding_status` | `"internal"` |
| `slaDeadline` | `DateTime?` | Optional | `sla_deadline` | — |
| `slaWarningSent` | `Boolean` | — | `sla_warning_sent` | `false` |
| `slaBreachSent` | `Boolean` | — | `sla_breach_sent` | `false` |
| `dueDate` | `DateTime?` | Optional | `due_date` | — |
| `relatedTickets` | `String?` | Optional (JSON array string) | `related_tickets` | — |
| `currentQueueEntryAt` | `DateTime` | — | `current_queue_entry_at` | `now()` |
| `firstResponseAt` | `DateTime?` | Optional | `first_response_at` | — |
| `completedAt` | `DateTime?` | Optional | `completed_at` | — |
| `closedAt` | `DateTime?` | Optional | `closed_at` | — |
| `requiresExternalResource` | `Boolean` | — | `requires_external_resource` | `false` |
| `externalResourceCost` | `Float?` | Optional | `external_resource_cost` | — |
| `externalResourceNote` | `String?` | Optional | `external_resource_note` | — |
| `isArchived` | `Boolean` | — | `is_archived` | `false` |
| `archivedAt` | `DateTime?` | Optional | `archived_at` | — |
| `archivedById` | `Int?` | Optional; FK → `User.id` (`TicketArchiver`) | `archived_by` | — |
| `rating` | `Int?` | Optional | `rating` | — |
| `feedback` | `String?` | Optional | `feedback` | — |
| `assetId` | `Int?` | Optional; FK → `Asset.id` | `asset_id` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |
| `deletedAt` | `DateTime?` | Optional | `deleted_at` | `null` |

### Indexes (all from `schema.prisma:263-271`)

```
@@index([status, createdAt])                  // Fast status+date queries
@@index([departmentId, status])               // Inbox queries
@@index([assignedToId, status])               // Assigned ticket queries
@@index([isArchived])                         // Archive filtering
@@index([createdById])                        // User's own tickets
@@index([ticketTypeId])                       // Type filtering
@@index([slaDeadline])                        // SLA cron scans (every 5 min)
@@index([departmentId, createdAt])            // Date-filtered dept queries
@@index([departmentId, isArchived, status])   // Inbox compound filter
```

### Soft Delete / Archive
- `deletedAt` — soft delete (hardcoded, no admin endpoint for tickets uses it)
- `isArchived` + `archivedAt` + `archivedById` — ticket archive workflow

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `createdBy` | M → 1 | `User.ticketsCreated` | — |
| `department` | M → 1 | `Department.ticketsIn` | — |
| `assignedTo` | M → 1 | `User.ticketsAssigned` | — |
| `archivedBy` | M → 1 | `User.ticketsArchived` | — |
| `ticketType` | M → 1 | `TicketType.tickets` | — |
| `building` | M → 1 | `Building.tickets` | — |
| `floor` | M → 1 | `Floor.tickets` | — |
| `asset` | M → 1 | `Asset.tickets` | — |
| `attachments` | O → M | `TicketAttachment.ticket` | onDelete: Cascade |
| `messages` | O → M | `TicketMessage.ticket` | onDelete: Cascade |
| `statusHistory` | O → M | `TicketStatusHistory.ticket` | onDelete: Cascade |
| `transfers` | O → M | `TicketTransfer.ticket` | onDelete: Cascade |
| `notifications` | O → M | `Notification.ticket` | — |
| `auditLogs` | O → M | `AuditLog.ticket` | — |

---

## 12. TicketAttachment

**Model:** `TicketAttachment` | **Table:** `ticket_attachments` | **Source:** `schema.prisma:275-289`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `ticketId` | `Int` | Required; FK → `Ticket.id` | `ticket_id` | — |
| `uploadedById` | `Int` | Required | `uploaded_by` | — |
| `fileName` | `String` | Required | `file_name` | — |
| `fileUrl` | `String` | Required | `file_url` | — |
| `fileSize` | `BigInt?` | Optional | `file_size` | — |
| `mimeType` | `String?` | Optional | `mime_type` | — |
| `isVoiceNote` | `Boolean` | — | `is_voice_note` | `false` |
| `voiceDuration` | `Int?` | Optional | `voice_duration` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `ticket` | M → 1 | `Ticket.attachments` | onDelete: Cascade |

---

## 13. TicketMessage

**Model:** `TicketMessage` | **Table:** `ticket_messages` | **Source:** `schema.prisma:291-307`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `ticketId` | `Int` | Required; FK → `Ticket.id` | `ticket_id` | — |
| `senderId` | `Int` | Required; FK → `User.id` | `sender_id` | — |
| `messageType` | `String` | — | `message_type` | `"public"` |
| `body` | `String?` | Optional | `body` | — |
| `voiceUrl` | `String?` | Optional | `voice_url` | — |
| `voiceDuration` | `Int?` | Optional | `voice_duration` | — |
| `isRead` | `Boolean` | — | `is_read` | `false` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `deletedAt` | `DateTime?` | Optional | `deleted_at` | `null` |

### Soft Delete
`deletedAt` — soft-delete field.

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `ticket` | M → 1 | `Ticket.messages` | onDelete: Cascade |
| `sender` | M → 1 | `User.messages` | — |
| `attachments` | O → M | `MessageAttachment.message` | onDelete: Cascade |

---

## 14. MessageAttachment

**Model:** `MessageAttachment` | **Table:** `message_attachments` | **Source:** `schema.prisma:309-323`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `messageId` | `Int` | Required; FK → `TicketMessage.id` | `message_id` | — |
| `uploadedById` | `Int` | Required | `uploaded_by` | — |
| `fileName` | `String` | Required | `file_name` | — |
| `fileUrl` | `String` | Required | `file_url` | — |
| `fileSize` | `BigInt?` | Optional | `file_size` | — |
| `mimeType` | `String?` | Optional | `mime_type` | — |
| `isVoiceNote` | `Boolean` | — | `is_voice_note` | `false` |
| `voiceDuration` | `Int?` | Optional | `voice_duration` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `message` | M → 1 | `TicketMessage.attachments` | onDelete: Cascade |

---

## 15. TicketTransfer

**Model:** `TicketTransfer` | **Table:** `ticket_transfers` | **Source:** `schema.prisma:325-340`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `ticketId` | `Int` | Required; FK → `Ticket.id` | `ticket_id` | — |
| `transferredById` | `Int` | Required; FK → `User.id` | `transferred_by` | — |
| `fromDepartmentId` | `Int` | Required; FK → `Department.id` | `from_department_id` | — |
| `toDepartmentId` | `Int` | Required; FK → `Department.id` | `to_department_id` | — |
| `reason` | `String?` | Optional | `reason` | — |
| `transferredAt` | `DateTime` | — | `transferred_at` | `now()` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `ticket` | M → 1 | `Ticket.transfers` | onDelete: Cascade |
| `transferredBy` | M → 1 | `User.transfers` | — |
| `fromDepartment` | M → 1 | `Department.transfersFrom` | — |
| `toDepartment` | M → 1 | `Department.transfersTo` | — |

---

## 16. TicketStatusHistory

**Model:** `TicketStatusHistory` | **Table:** `ticket_status_history` | **Source:** `schema.prisma:342-354`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `ticketId` | `Int` | Required; FK → `Ticket.id` | `ticket_id` | — |
| `changedById` | `Int` | Required; FK → `User.id` | `changed_by` | — |
| `oldStatus` | `String?` | Optional | `old_status` | — |
| `newStatus` | `String` | Required | `new_status` | — |
| `note` | `String?` | Optional | `note` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `ticket` | M → 1 | `Ticket.statusHistory` | onDelete: Cascade |
| `changedBy` | M → 1 | `User.statusHistory` | — |

---

## 17. Notification

**Model:** `Notification` | **Table:** `notifications` | **Source:** `schema.prisma:356-374`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `userId` | `Int` | Required; FK → `User.id` | `user_id` | — |
| `ticketId` | `Int?` | Optional; FK → `Ticket.id` | `ticket_id` | — |
| `eventType` | `String` | Required | `event_type` | — |
| `titleAr` | `String?` | Optional | `title_ar` | — |
| `titleEn` | `String?` | Optional | `title_en` | — |
| `bodyAr` | `String?` | Optional | `body_ar` | — |
| `bodyEn` | `String?` | Optional | `body_en` | — |
| `isRead` | `Boolean` | — | `is_read` | `false` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Indexes (`schema.prisma:370-372`)

```
@@index([userId])
@@index([userId, isRead])             // Unread count query
@@index([ticketId])
```

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `user` | M → 1 | `User.notifications` | onDelete: Cascade |
| `ticket` | M → 1 (optional) | `Ticket.notifications` | — |

---

## 18. TeamNote

**Model:** `TeamNote` | **Table:** `team_notes` | **Source:** `schema.prisma:376-391`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `departmentId` | `Int?` | Optional; FK → `Department.id` | `department_id` | — |
| `authorId` | `Int` | Required; FK → `User.id` | `author_id` | — |
| `body` | `String` | Required | `body` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |
| `deletedAt` | `DateTime?` | Optional | `deleted_at` | `null` |

### Soft Delete
`deletedAt` — used by `team-notes.service.ts:139`.

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `author` | M → 1 | `User.teamNotes` | — |
| `department` | M → 1 (optional) | `Department.teamNotes` | — |
| `attachments` | O → M | `TeamNoteAttachment.note` | onDelete: Cascade |
| `comments` | O → M | `TeamNoteComment.note` | onDelete: Cascade |
| `likes` | O → M | `TeamNoteLike.note` | onDelete: Cascade |

---

## 19. TeamNoteComment

**Model:** `TeamNoteComment` | **Table:** `team_note_comments` | **Source:** `schema.prisma:393-404`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `noteId` | `Int` | Required; FK → `TeamNote.id` | `note_id` | — |
| `authorId` | `Int` | Required; FK → `User.id` | `author_id` | — |
| `body` | `String` | Required | `body` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `note` | M → 1 | `TeamNote.comments` | onDelete: Cascade |
| `author` | M → 1 | `User.teamNoteComments` | — |

---

## 20. TeamNoteLike

**Model:** `TeamNoteLike` | **Table:** `team_note_likes` | **Source:** `schema.prisma:406-416`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `noteId` | `Int` | Required; FK → `TeamNote.id`; `@@unique([noteId, userId])` | `note_id` | — |
| `userId` | `Int` | Required; FK → `User.id` | `user_id` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `note` | M → 1 | `TeamNote.likes` | onDelete: Cascade |
| `user` | M → 1 | `User.teamNoteLikes` | — |

---

## 21. TeamNoteAttachment

**Model:** `TeamNoteAttachment` | **Table:** `team_note_attachments` | **Source:** `schema.prisma:418-431`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `noteId` | `Int` | Required; FK → `TeamNote.id` | `note_id` | — |
| `fileName` | `String` | Required | `file_name` | — |
| `fileUrl` | `String` | Required | `file_url` | — |
| `fileSize` | `BigInt?` | Optional | `file_size` | — |
| `mimeType` | `String?` | Optional | `mime_type` | — |
| `isVoiceNote` | `Boolean` | — | `is_voice_note` | `false` |
| `voiceDuration` | `Int?` | Optional | `voice_duration` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `note` | M → 1 | `TeamNote.attachments` | onDelete: Cascade |

---

## 22. PushSubscription

**Model:** `PushSubscription` | **Table:** `push_subscriptions` | **Source:** `schema.prisma:433-444`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `userId` | `Int` | Required; FK → `User.id`; `@@unique([userId, endpoint])` | `user_id` | — |
| `endpoint` | `String` | Required | `endpoint` | — |
| `p256dh` | `String` | Required (VAPID public key) | `p256dh` | — |
| `auth` | `String` | Required (VAPID auth secret) | `auth` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `user` | M → 1 | `User.pushSubs` | onDelete: Cascade |

---

## 23. AuditLog

**Model:** `AuditLog` | **Table:** `audit_logs` | **Source:** `schema.prisma:446-468`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `userId` | `Int?` | Optional; FK → `User.id` | `user_id` | — |
| `action` | `String` | Required | `action` | — |
| `entityType` | `String?` | Optional | `entity_type` | — |
| `entityId` | `Int?` | Optional | `entity_id` | — |
| `departmentId` | `Int?` | Optional; FK → `Department.id` | `department_id` | — |
| `ticketId` | `Int?` | Optional; FK → `Ticket.id` | `ticket_id` | — |
| `oldData` | `Json?` | Optional | `old_data` | — |
| `newData` | `Json?` | Optional | `new_data` | — |
| `ipAddress` | `String?` | Optional | `ip_address` | — |
| `userAgent` | `String?` | Optional | `user_agent` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Indexes (`schema.prisma:463-466`)

```
@@index([userId])
@@index([ticketId, createdAt])         // Ticket audit trail
@@index([action, createdAt])           // Action-type queries
@@index([createdAt])                   // Time-range scans
```

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `user` | M → 1 (optional) | `User.auditLogs` | — |
| `department` | M → 1 (optional) | `Department.auditLogs` | — |
| `ticket` | M → 1 (optional) | `Ticket.auditLogs` | — |

---

## 24. SystemSetting

**Model:** `SystemSetting` | **Table:** `system_settings` | **Source:** `schema.prisma:470-478`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `key` | `String` | `@id` (string primary key) | `key` | — |
| `value` | `String?` | Optional | `value` | — |
| `description` | `String?` | Optional | `description` | — |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |
| `updatedById` | `Int?` | Optional | `updated_by` | — |

### Notes
- Key-value store for app configuration. No FK relations.

---

## 25. ExportHistory

**Model:** `ExportHistory` | **Table:** `export_history` | **Source:** `schema.prisma:480-497`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `exportedById` | `Int` | Required; FK → `User.id` | `exported_by` | — |
| `departmentId` | `Int?` | Optional; FK → `Department.id` | `department_id` | — |
| `dateFrom` | `DateTime` | Required | `date_from` | — |
| `dateTo` | `DateTime` | Required | `date_to` | — |
| `fileName` | `String` | Required | `file_name` | — |
| `fileUrl` | `String` | Required | `file_url` | — |
| `fileSize` | `BigInt?` | Optional | `file_size` | — |
| `ticketCount` | `Int` | — | `ticket_count` | `0` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `expiresAt` | `DateTime` | Required | `expires_at` | — |
| `deletedAt` | `DateTime?` | Optional | `deleted_at` | `null` |

### Soft Delete
`deletedAt` — soft delete for expired exports.

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `exportedBy` | M → 1 | `User.exports` | — |
| `department` | M → 1 (optional) | `Department.exports` | — |

---

## 26. Asset

**Model:** `Asset` | **Table:** `assets` | **Source:** `schema.prisma:499-516`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `name` | `String` | Required | `name` | — |
| `serialNumber` | `String?` | Optional, `@unique` | `serial_number` | — |
| `type` | `String` | Required (e.g., `"Medical Device"`, `"IT Hardware"`) | `type` | — |
| `location` | `String?` | Optional | `location` | — |
| `departmentId` | `Int?` | Optional; FK → `Department.id` | `department_id` | — |
| `status` | `String` | — | `status` | `"active"` |
| `purchaseDate` | `DateTime?` | Optional | `purchase_date` | — |
| `warrantyExpiry` | `DateTime?` | Optional | `warranty_expiry` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |
| `deletedAt` | `DateTime?` | Optional | `deleted_at` | `null` |

### Soft Delete
`deletedAt` — used by `assets.service.ts:114`. Status values: `active`, `maintenance`, `retired`.

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `department` | M → 1 (optional) | `Department.assets` | — |
| `tickets` | O → M | `Ticket.asset` | — |

---

## 27. KnowledgeCategory

**Model:** `KnowledgeCategory` | **Table:** `knowledge_categories` | **Source:** `schema.prisma:518-526`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `nameAr` | `String` | Required | `name_ar` | — |
| `nameEn` | `String` | Required | `name_en` | — |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `articles` | O → M | `KnowledgeArticle.category` | — |

---

## 28. KnowledgeArticle

**Model:** `KnowledgeArticle` | **Table:** `knowledge_articles` | **Source:** `schema.prisma:528-547`

### Columns

| Column | Type | Constraints | DB Name | Default |
|---|---|---|---|---|
| `id` | `Int` | `@id`, autoincrement | `id` | — |
| `titleAr` | `String` | Required | `title_ar` | — |
| `titleEn` | `String` | Required | `title_en` | — |
| `contentAr` | `String` | Required | `content_ar` | — |
| `contentEn` | `String` | Required | `content_en` | — |
| `categoryId` | `Int` | Required; FK → `KnowledgeCategory.id` | `category_id` | — |
| `authorId` | `Int` | Required; FK → `User.id` | `author_id` | — |
| `views` | `Int` | — | `views` | `0` |
| `isActive` | `Boolean` | — | `is_active` | `true` |
| `createdAt` | `DateTime` | — | `created_at` | `now()` |
| `updatedAt` | `DateTime` | `@updatedAt` | `updated_at` | — |

### Indexes (`schema.prisma:543-545`)

```
@@index([categoryId])   // Category filtering
@@index([isActive])     // Active-article queries
@@index([views])        // Popular articles (suggest endpoint)
```

### Relations
| Field | Type | Target | Cascade |
|---|---|---|---|
| `category` | M → 1 | `KnowledgeCategory.articles` | — |
| `author` | M → 1 | `User.knowledgeArticles` | — |

---

## Cascade Deletion Summary

| Parent Delete | Cascades To |
|---|---|
| `Building` | `Floor` (Cascade) |
| `User` | `UserPermissionOverride`, `Notification`, `PushSubscription` (Cascade) |
| `Ticket` | `TicketAttachment`, `TicketMessage`, `TicketStatusHistory`, `TicketTransfer` (Cascade) |
| `TicketMessage` | `MessageAttachment` (Cascade) |
| `TeamNote` | `TeamNoteAttachment`, `TeamNoteComment`, `TeamNoteLike` (Cascade) |
| `KnowledgeCategory` | No cascade — `KnowledgeArticle` requires active category |

## Soft-Delete Summary

| Table | Soft-Delete Field | Usage |
|---|---|---|
| `Department` | `deletedAt` | Admin deactivate |
| `User` | `deletedAt` | Admin deactivate |
| `Ticket` | `deletedAt`, `isArchived` + `archivedAt` | Hardcoded soft delete + archive workflow |
| `TicketMessage` | `deletedAt` | Soft-delete comments |
| `TeamNote` | `deletedAt` | Soft-delete notes |
| `ExportHistory` | `deletedAt` | Expired exports |
| `Asset` | `deletedAt` | Admin soft-delete |

## Unique Constraints Summary

| Table | Unique Constraint |
|---|---|
| `User` | `badgeNumber`, `username`, `email` |
| `Floor` | `@@unique([buildingId, nameAr])` |
| `DeptTransferAllowlist` | `@@unique([sourceDeptId, targetDeptId])` |
| `Role` | `name` |
| `Permission` | `name` |
| `UserPermissionOverride` | `userId` |
| `Ticket` | `ticketNumber` |
| `TeamNoteLike` | `@@unique([noteId, userId])` |
| `PushSubscription` | `@@unique([userId, endpoint])` |
| `SystemSetting` | `key` (primary key) |
| `Asset` | `serialNumber` |
| `KnowledgeArticle` | None |
| `KnowledgeCategory` | None |