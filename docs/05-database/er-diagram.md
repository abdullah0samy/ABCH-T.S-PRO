# Entity-Relationship Diagram — ABCH Hospital Ticketing CRM

**Source:** [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)

```mermaid
erDiagram
    %% ═══════════════════════════════════════════════
    %% ADMINISTRATION: Buildings, Floors, Departments
    %% ═══════════════════════════════════════════════

    Building ||--o{ Floor : "1:N (Cascade)"
    Building ||--o{ Ticket : "1:N"
    Floor }o--|| Building : "belongs to (Cascade)"
    Floor }o--o{ Ticket : "1:N"

    DeptPermissions ||--o{ Department : "1:N"
    Department ||--o{ DeptTransferAllowlist : "source 1:N"
    Department ||--o{ DeptTransferAllowlist : "target 1:N"

    %% ═══════════════════════════════════════════════
    %% USERS & AUTH
    %% ═══════════════════════════════════════════════

    Department }o--o{ User : "1:N"
    Role }o--o{ User : "1:N"
    Role }o--o{ Permission : "M:N"
    User ||--o| UserPermissionOverride : "1:1 (Cascade)"

    %% ═══════════════════════════════════════════════
    %% TICKETS (core entity)
    %% ═══════════════════════════════════════════════

    TicketType }o--o{ Ticket : "1:N"
    TicketType }o--|| Department : "belongs to"
    Department }o--o{ Ticket : "1:N"
    User "1" ||--o{ Ticket : "creates"
    User "2" }o--o{ Ticket : "assigned to"
    User "3" }o--o{ Ticket : "archives"
    Asset }o--o{ Ticket : "1:N"

    Ticket ||--o{ TicketAttachment : "1:N (Cascade)"
    Ticket ||--o{ TicketMessage : "1:N (Cascade)"
    Ticket ||--o{ TicketStatusHistory : "1:N (Cascade)"
    Ticket ||--o{ TicketTransfer : "1:N (Cascade)"
    Ticket }o--o{ Notification : "1:N"
    Ticket }o--o{ AuditLog : "1:N"

    TicketMessage ||--o{ MessageAttachment : "1:N (Cascade)"
    User "4" }o--o{ TicketMessage : "sends"

    TicketTransfer }o--|| Department : "from dept"
    TicketTransfer }o--|| Department : "to dept"
    User "5" }o--o{ TicketTransfer : "transfers"

    TicketStatusHistory }o--|| User : "changed by"

    %% ═══════════════════════════════════════════════
    %% NOTIFICATIONS & AUDIT
    %% ═══════════════════════════════════════════════

    User ||--o{ Notification : "1:N (Cascade)"
    User ||--o{ PushSubscription : "1:N (Cascade)"
    User ||--o{ AuditLog : "1:N"
    Department }o--o{ AuditLog : "1:N"

    %% ═══════════════════════════════════════════════
    %% TEAM NOTES
    %% ═══════════════════════════════════════════════

    Department }o--o{ TeamNote : "1:N"
    User ||--o{ TeamNote : "authors"
    TeamNote ||--o{ TeamNoteAttachment : "1:N (Cascade)"
    TeamNote ||--o{ TeamNoteComment : "1:N (Cascade)"
    TeamNote ||--o{ TeamNoteLike : "1:N (Cascade)"
    User }o--o{ TeamNoteComment : "comments"
    User }o--o{ TeamNoteLike : "likes"

    %% ═══════════════════════════════════════════════
    %% ASSETS
    %% ═══════════════════════════════════════════════

    Department }o--o{ Asset : "1:N"

    %% ═══════════════════════════════════════════════
    %% EXPORTS
    %% ═══════════════════════════════════════════════

    Department }o--o{ ExportHistory : "1:N"
    User ||--o{ ExportHistory : "exports"

    %% ═══════════════════════════════════════════════
    %% KNOWLEDGE BASE
    %% ═══════════════════════════════════════════════

    KnowledgeCategory ||--o{ KnowledgeArticle : "1:N"
    User ||--o{ KnowledgeArticle : "authors"

    %% ═══════════════════════════════════════════════
    %% SYSTEM SETTINGS (standalone)
    %% ═══════════════════════════════════════════════

    SystemSetting {
        String key PK
        String value
        String description
        DateTime updatedAt
        Int updatedById
    }

    %% ── Entity attributes ──

    Building {
        Int id PK
        String nameAr
        String nameEn
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }

    Floor {
        Int id PK
        String nameAr
        String nameEn
        Int buildingId FK
        Boolean isActive
        DateTime createdAt
    }

    DeptPermissions {
        Int id PK
        Boolean canReceiveTickets
        Boolean canSendTickets
        Boolean canViewAllDeptTickets
        Boolean canAssignTickets
        Boolean canChangeStatus
        Boolean canTransferTickets
        Boolean canArchiveTickets
        Boolean canExportData
        Boolean canViewAnalytics
        Boolean canManageTeamNotes
        Boolean canManageDeptUsers
        Boolean canViewAuditLogs
        Boolean canManageKnowledgeBase
    }

    Department {
        Int id PK
        String nameAr
        String nameEn
        String descriptionAr
        String descriptionEn
        String deptType
        Int defaultPermissionsId FK
        Int slaHours
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    DeptTransferAllowlist {
        Int id PK
        Int sourceDeptId FK
        Int targetDeptId FK
        Boolean isActive
        DateTime createdAt
    }

    User {
        Int id PK
        String badgeNumber UK
        String username UK
        String email UK
        String passwordHash
        String fullNameAr
        String fullNameEn
        String role
        Int roleId FK
        Int departmentId FK
        String avatarUrl
        String about
        String langPref
        Boolean isActive
        Boolean forcePasswordChange
        DateTime lastLoginAt
        String lastLoginIp
        Int failedLoginAttempts
        DateTime lockUntil
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    Role {
        Int id PK
        String name UK
        String description
        DateTime createdAt
        DateTime updatedAt
    }

    Permission {
        Int id PK
        String name UK
        String description
        DateTime createdAt
    }

    UserPermissionOverride {
        Int id PK
        Int userId FK UK
        Boolean canReceiveTickets
        Boolean canSendTickets
        Boolean canViewAllDeptTickets
        Boolean canAssignTickets
        Boolean canChangeStatus
        Boolean canTransferTickets
        Boolean canArchiveTickets
        Boolean canExportData
        Boolean canViewAnalytics
        Boolean canManageTeamNotes
        Boolean canManageDeptUsers
        Boolean canViewAuditLogs
        Boolean canManageKnowledgeBase
        String allowedTransferDeptIds
    }

    TicketType {
        Int id PK
        String nameAr
        String nameEn
        Int departmentId FK
        String color
        Int slaHours
        Boolean isActive
        Int displayOrder
        DateTime createdAt
    }

    Ticket {
        Int id PK
        String ticketNumber UK
        String subject
        Int createdById FK
        String creatorName
        String creatorPhone
        String creatorExtension
        Int creatorDeptId
        String creatorDeptName
        Int buildingId FK
        String buildingName
        Int floorId FK
        String floorName
        String roomExtension
        String description
        Int departmentId FK
        Int assignedToId FK
        Int ticketTypeId FK
        String status
        String priority
        String holdingStatus
        DateTime slaDeadline
        Boolean slaWarningSent
        Boolean slaBreachSent
        DateTime dueDate
        String relatedTickets
        DateTime currentQueueEntryAt
        DateTime firstResponseAt
        DateTime completedAt
        DateTime closedAt
        Boolean requiresExternalResource
        Float externalResourceCost
        String externalResourceNote
        Boolean isArchived
        DateTime archivedAt
        Int archivedById FK
        Int rating
        String feedback
        Int assetId FK
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    TicketAttachment {
        Int id PK
        Int ticketId FK
        Int uploadedById
        String fileName
        String fileUrl
        BigInt fileSize
        String mimeType
        Boolean isVoiceNote
        Int voiceDuration
        DateTime createdAt
    }

    TicketMessage {
        Int id PK
        Int ticketId FK
        Int senderId FK
        String messageType
        String body
        String voiceUrl
        Int voiceDuration
        Boolean isRead
        DateTime createdAt
        DateTime deletedAt
    }

    MessageAttachment {
        Int id PK
        Int messageId FK
        Int uploadedById
        String fileName
        String fileUrl
        BigInt fileSize
        String mimeType
        Boolean isVoiceNote
        Int voiceDuration
        DateTime createdAt
    }

    TicketTransfer {
        Int id PK
        Int ticketId FK
        Int transferredById FK
        Int fromDepartmentId FK
        Int toDepartmentId FK
        String reason
        DateTime transferredAt
        DateTime createdAt
    }

    TicketStatusHistory {
        Int id PK
        Int ticketId FK
        Int changedById FK
        String oldStatus
        String newStatus
        String note
        DateTime createdAt
    }

    Notification {
        Int id PK
        Int userId FK
        Int ticketId FK
        String eventType
        String titleAr
        String titleEn
        String bodyAr
        String bodyEn
        Boolean isRead
        DateTime createdAt
    }

    TeamNote {
        Int id PK
        Int departmentId FK
        Int authorId FK
        String body
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    TeamNoteComment {
        Int id PK
        Int noteId FK
        Int authorId FK
        String body
        DateTime createdAt
        DateTime updatedAt
    }

    TeamNoteLike {
        Int id PK
        Int noteId FK
        Int userId FK
        DateTime createdAt
    }

    TeamNoteAttachment {
        Int id PK
        Int noteId FK
        String fileName
        String fileUrl
        BigInt fileSize
        String mimeType
        Boolean isVoiceNote
        Int voiceDuration
        DateTime createdAt
    }

    PushSubscription {
        Int id PK
        Int userId FK
        String endpoint
        String p256dh
        String auth
        DateTime createdAt
    }

    AuditLog {
        Int id PK
        Int userId FK
        String action
        String entityType
        Int entityId
        Int departmentId FK
        Int ticketId FK
        Json oldData
        Json newData
        String ipAddress
        String userAgent
        DateTime createdAt
    }

    SystemSetting {
        String key PK
        String value
        String description
        DateTime updatedAt
        Int updatedById
    }

    ExportHistory {
        Int id PK
        Int exportedById FK
        Int departmentId FK
        DateTime dateFrom
        DateTime dateTo
        String fileName
        String fileUrl
        BigInt fileSize
        Int ticketCount
        DateTime createdAt
        DateTime expiresAt
        DateTime deletedAt
    }

    Asset {
        Int id PK
        String name
        String serialNumber UK
        String type
        String location
        Int departmentId FK
        String status
        DateTime purchaseDate
        DateTime warrantyExpiry
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    KnowledgeCategory {
        Int id PK
        String nameAr
        String nameEn
        DateTime createdAt
    }

    KnowledgeArticle {
        Int id PK
        String titleAr
        String titleEn
        String contentAr
        String contentEn
        Int categoryId FK
        Int authorId FK
        Int views
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }
```

---

## Relationship Cardinality Reference

### One-to-One (1:1)
| Parent (1) | Child (1) | Notes |
|---|---|---|
| `User` | `UserPermissionOverride` | Optional override per user; onDelete Cascade |

### One-to-Many (1:N)

#### Buildings / Floors
| Parent (1) | Child (N) | Cascade |
|---|---|---|
| `Building` | `Floor` | onDelete Cascade |
| `Building` | `Ticket` | None |
| `Floor` | `Ticket` | None |

#### Departments
| Parent (1) | Child (N) | Cascade |
|---|---|---|
| `DeptPermissions` | `Department` | None |
| `Department` | `User` | None |
| `Department` | `Ticket` (via `ticketsIn`) | None |
| `Department` | `TicketType` | None |
| `Department` | `TeamNote` | None |
| `Department` | `Asset` | None |
| `Department` | `AuditLog` | None |
| `Department` | `ExportHistory` | None |

#### Dept Transfer Allowlist (self-referencing Department D:M)
| Source (1) | Join (N) | Target (1) |
|---|---|---|
| `Department.sourceDept` | `DeptTransferAllowlist` | `Department.targetDept` |

#### Users
| Parent (1) | Child (N) | Cascade |
|---|---|---|
| `User` | `Ticket` (created) | None |
| `User` | `Ticket` (assigned) | None |
| `User` | `Ticket` (archived by) | None |
| `User` | `Notification` | onDelete Cascade |
| `User` | `PushSubscription` | onDelete Cascade |
| `User` | `TicketMessage` (sender) | None |
| `User` | `TicketStatusHistory` (changed by) | None |
| `User` | `TicketTransfer` (transferred by) | None |
| `User` | `TeamNote` (author) | None |
| `User` | `TeamNoteComment` (author) | None |
| `User` | `TeamNoteLike` | None |
| `User` | `KnowledgeArticle` (author) | None |
| `User` | `AuditLog` | None |
| `User` | `ExportHistory` (exported by) | None |

#### Roles / Permissions
| Parent | Child | Type |
|---|---|---|
| `Role` | `Permission` | Many-to-Many |
| `Role` | `User` | 1:N |

#### Tickets (core cascades)
| Parent (1) | Child (N) | Cascade |
|---|---|---|
| `Ticket` | `TicketAttachment` | onDelete Cascade |
| `Ticket` | `TicketMessage` | onDelete Cascade |
| `Ticket` | `TicketStatusHistory` | onDelete Cascade |
| `Ticket` | `TicketTransfer` | onDelete Cascade |
| `Ticket` | `Notification` | None |
| `Ticket` | `AuditLog` | None |
| `TicketType` | `Ticket` | None |
| `Asset` | `Ticket` | None |

#### Messages
| Parent (1) | Child (N) | Cascade |
|---|---|---|
| `TicketMessage` | `MessageAttachment` | onDelete Cascade |

#### Transfers
| Parent (1) | Child (N) | Cascade |
|---|---|---|
| `Ticket` | `TicketTransfer` | onDelete Cascade |
| `Department` (source) | `TicketTransfer` | None |
| `Department` (target) | `TicketTransfer` | None |

#### Team Notes
| Parent (1) | Child (N) | Cascade |
|---|---|---|
| `TeamNote` | `TeamNoteAttachment` | onDelete Cascade |
| `TeamNote` | `TeamNoteComment` | onDelete Cascade |
| `TeamNote` | `TeamNoteLike` | onDelete Cascade |

#### Knowledge Base
| Parent (1) | Child (N) | Cascade |
|---|---|---|
| `KnowledgeCategory` | `KnowledgeArticle` | None (articles prevent deletion if exist) |

### Many-to-Many (M:N)
| Entity A | Entity B | Join |
|---|---|---|
| `Role` | `Permission` | Implicit Prisma M:N table |

### Standalone Tables
- `SystemSetting` — key-value store, no foreign keys

---

## Diagram Legend

- `||--o{` : One-to-Many (required parent → optional zero-or-more children)
- `||--o|` : One-to-One (required parent → optional child)
- `}o--||` : Many-to-One (optional child → required parent)
- `}o--o{` : Many side of M:N or bidirectional 1:N
- **Cascade** annotations indicate `onDelete: Cascade` in Prisma schema
- **UK** = unique constraint
- **FK** = foreign key
- **PK** = primary key