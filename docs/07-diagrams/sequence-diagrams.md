# Sequence Diagrams

All diagrams based on actual code paths. File:line references noted per step.

---

## 1. Login Sequence

**Sources:** `frontend/src/pages/Login.tsx` (inferred, not read), `auth.controller.ts:15-35`, `auth.service.ts:12-93`, `frontend/src/App.tsx:104-141`

```mermaid
sequenceDiagram
    participant Browser
    participant Login as Login.tsx
    participant AuthCtrl as AuthController
    participant AuthService as AuthService
    participant DB as Prisma/Postgres
    participant App as App.tsx

    Browser->>Login: User enters identifier + password
    Login->>AuthCtrl: POST /api/auth/login { identifier, password }
    Note over AuthCtrl: auth.controller.ts:15
    AuthCtrl->>AuthService: login(identifier, password)
    Note over AuthService: auth.service.ts:12

    AuthService->>AuthService: Validate identifier format (regex)
    Note over AuthService: auth.service.ts:21

    AuthService->>DB: findFirst OR: badgeNumber, username
    Note over AuthService: auth.service.ts:25-31
    DB-->>AuthService: user or null

    alt User not found or inactive
        AuthService-->>AuthCtrl: UnauthorizedException (401)
    else Account locked
        AuthService-->>AuthCtrl: HttpException 423 + lockUntil
        Note over AuthService: auth.service.ts:39-43
    else Lock expired, reset attempts
        AuthService->>DB: Update failedLoginAttempts=0, lockUntil=null
        Note over AuthService: auth.service.ts:46-51
    end

    AuthService->>AuthService: bcrypt.compare(password, passwordHash)
    Note over AuthService: auth.service.ts:53

    alt Password invalid
        AuthService->>DB: Increment failedLoginAttempts, lock if >=5
        Note over AuthService: auth.service.ts:55-65
        AuthService-->>AuthCtrl: UnauthorizedException (401)
    end

    AuthService->>DB: Update failedLoginAttempts=0, lastLoginAt=now
    Note over AuthService: auth.service.ts:68-75
    AuthService->>AuthService: generateAccessToken(user)
    AuthService->>AuthService: generateRefreshToken(user)
    AuthService-->>AuthCtrl: { accessToken, refreshToken, user }

    AuthCtrl->>Browser: Set httpOnly cookie: refreshToken (7d)
    Note over AuthCtrl: auth.controller.ts:23-28
    AuthCtrl-->>Login: 200 { accessToken, refreshToken, user }

    Login->>App: setAuth(userData, accessToken)
    Note over App: App.tsx:120

    App->>DB: GET /api/users/me (with Bearer token)
    Note over App: App.tsx:110
    DB-->>App: Full user profile
    App->>App: setAuth(fullUser, accessToken)
    Note over App: App.tsx:120

    App->>Browser: Render dashboard with sidebar
```

---

## 2. Ticket Creation

**Sources:** `tickets.controller.ts:18-26`, `tickets.service.ts:106-181`, `workflow.constants.ts`, `sla.utils.ts:10-25`

```mermaid
sequenceDiagram
    participant User
    participant NTP as NewTicketPage
    participant Ctrl as TicketsController
    participant Svc as TicketsService
    participant DB as Prisma
    participant Gateway as TicketGateway

    User->>NTP: Fills ticket form
    NTP->>Ctrl: POST /api/tickets
    Note over Ctrl: tickets.controller.ts:18

    Ctrl->>Ctrl: createTicketSchema.safeParse(body)
    Note over Ctrl: tickets.controller.ts:21-23

    alt Validation fails
        Ctrl-->>NTP: 400 { errors }
    end

    Ctrl->>Svc: create(userId, parsed.data)
    Note over Svc: tickets.service.ts:106

    Svc->>DB: Find user with department
    Svc->>DB: Find target department
    Note over Svc: tickets.service.ts:109-114

    alt Supervisor/agent cross-dept
        Svc-->>Ctrl: Forbidden (CROSS_DEPT_FORBIDDEN)
        Note over Svc: tickets.service.ts:120-122
    end

    alt Building/floor mismatch
        Svc-->>Ctrl: BadRequest (FLOOR_BUILDING_MISMATCH)
        Note over Svc: tickets.service.ts:125-127
    end

    Svc->>DB: Find ticketType (for SLA hours)
    Note over Svc: tickets.service.ts:129-132

    Svc->>Svc: calculateSLADeadline(baseHours, priority)
    Note over Svc: sla.utils.ts:10 — applies priority modifier

    Svc->>DB: $transaction — generate ticket number
    Note over Svc: tickets.service.ts:137-177

    loop Retry up to 5 times (P2002 conflict)
        DB->>DB: findFirst ticketNumber starting with TKT-{date}
        Svc->>Svc: Increment sequence
        Note over Svc: tickets.service.ts:59-76
        DB->>DB: ticket.create (with auditLogs.create nested)
        Note over Svc: tickets.service.ts:164-167: TICKET_CREATED audit
    end

    DB-->>Svc: ticket

    Svc->>Gateway: emitToDept(deptId, 'new-ticket', ...)
    Note over Gateway: ticket.gateway.ts:90

    Svc-->>Ctrl: ticket
    Ctrl-->>NTP: 201 ticket
    NTP->>User: Display ticket created
```

---

## 3. Ticket Status Change

**Sources:** `tickets.controller.ts:64-67`, `tickets.service.ts:409-488`

```mermaid
sequenceDiagram
    participant User
    participant TDP as TicketDetailsPage
    participant Ctrl as TicketsController
    participant Svc as TicketsService
    participant DB as Prisma
    participant Gateway as TicketGateway

    User->>TDP: Selects new status + optional comment
    TDP->>Ctrl: PUT /api/tickets/:id/status
    Note over Ctrl: tickets.controller.ts:64

    Ctrl->>Svc: updateStatus(ticketId, userId, userRole, ...)
    Note over Svc: tickets.service.ts:409

    Svc->>DB: ticket.findUnique(id)
    Note over Svc: tickets.service.ts:412

    alt Closed/resolved + not super_admin
        Svc-->>Ctrl: Forbidden — ticket locked
        Note over Svc: tickets.service.ts:415-417
    end

    Svc->>Svc: checkTicketPermission(..., canChangeStatus)
    Note over Svc: tickets.service.ts:19 — with 30s cache

    alt No permission
        Svc-->>Ctrl: Forbidden
    end

    Svc->>Svc: ALLOWED_TRANSITIONS[oldStatus]
    Note over Svc: workflow.constants.ts:7-18

    alt Invalid transition
        Svc-->>Ctrl: BadRequest — with allowedTransitions list
        Note over Svc: tickets.service.ts:424-426
    end

    alt Closing requires creator confirm
        Note over Svc: resolved→closed NOT in ALLOWED_TRANSITIONS
        Note over Svc: workflow.constants.ts:15-16
    end

    Svc->>DB: $transaction

    DB->>DB: ticket.update(status, completedAt, closedAt, slaDeadline)
    Note over Svc: tickets.service.ts:451-461

    DB->>DB: auditLog.create(STATUS_CHANGED)
    Note over Svc: tickets.service.ts:464-473

    alt Has comment
        DB->>DB: ticketMessage.create(messageType: 'note')
        Note over Svc: tickets.service.ts:476-478
    end

    DB-->>Svc: updatedTicket

    Svc->>Gateway: emitToUser(creatorId, 'ticket-status-updated', ...)
    Svc->>Gateway: emitToDept(deptId, 'ticket-status-updated', ...)
    Svc->>Gateway: emitToTicket(ticketId, 'ticket-status-updated', ...)
    Note over Gateway: gateway rooms

    Svc-->>Ctrl: updatedTicket
    Ctrl-->>TDP: updated ticket
    TDP->>User: Display updated status
```

---

## 4. Ticket Transfer

**Sources:** `tickets.controller.ts:85-87`, `tickets.service.ts:542-599`

```mermaid
sequenceDiagram
    participant User
    participant TDP as TicketDetailsPage
    participant Ctrl as TicketsController
    participant Svc as TicketsService
    participant DB as Prisma
    participant Gateway as TicketGateway

    User->>TDP: Select target department
    TDP->>Ctrl: PUT /api/tickets/:id/transfer
    Note over Ctrl: tickets.controller.ts:85

    Ctrl->>Svc: transfer(ticketId, userId, userRole, ...)
    Note over Svc: tickets.service.ts:542

    Svc->>DB: ticket.findUnique(id)
    Svc->>DB: department.findUnique(targetDeptId)

    alt Closed/resolved + not super_admin
        Svc-->>Ctrl: Forbidden
    end

    Svc->>Svc: checkTicketPermission(..., canTransferTickets)

    alt No permission
        Svc-->>Ctrl: Forbidden
    end

    Svc->>DB: deptTransferAllowlist.findFirst(source→target)
    Note over Svc: tickets.service.ts:559-565

    alt Transfer not on allowlist
        Svc-->>Ctrl: Forbidden (TRANSFER_NOT_ALLOWED)
    end

    Svc->>DB: $transaction

    DB->>DB: ticketTransfer.create(from, to, reason)
    Note over Svc: tickets.service.ts:573-575

    Svc->>Svc: calculateSLADeadline(targetDept.slaHours, priority)
    Note over Svc: Recalculate SLA for new dept

    DB->>DB: ticket.update(deptId, assignedToId=null, status=pending, slaDeadline)
    Note over Svc: Reset status + assignee. tickets.service.ts:580-582

    DB->>DB: auditLog.create(TRANSFERRED)
    Note over Svc: tickets.service.ts:585-591

    DB-->>Svc: updatedTicket

    Svc->>Gateway: emitToDept(targetDeptId, 'new-ticket', ...)
    Note over Svc: Notify target dept. tickets.service.ts:597

    Svc->>Gateway: emitToDept(oldDeptId, 'ticket-transferred', ...)
    Note over Svc: Notify source dept. tickets.service.ts:598

    Svc-->>Ctrl: updatedTicket
    Ctrl-->>TDP: transferred ticket
```

---

## 5. SLA Check Cron

**Sources:** `cron.service.ts:36-111`, `cron.processor.ts:18`

```mermaid
sequenceDiagram
    participant MQ as BullMQ Queue
    participant Proc as CronProcessor
    participant CronSvc as CronService
    participant DB as Prisma
    participant Users as Dept Users

    MQ->>Proc: Job: sla-check
    Note over Proc: cron.processor.ts:18

    Proc->>CronSvc: slaCheck()
    Note over CronSvc: cron.service.ts:36

    CronSvc->>DB: ticket.findMany(status NOT in [resolved,closed], slaDeadline < now, slaBreachSent=false)
    Note over CronSvc: cron.service.ts:39-45

    loop For each breached ticket
        CronSvc->>DB: user.findMany(departmentId, isActive=true)
        Note over CronSvc: cron.service.ts:48-50

        alt Dept has users
            CronSvc->>DB: notification.createMany(SLA_BREACH, bilingual)
            Note over CronSvc: cron.service.ts:53-63
        end

        CronSvc->>DB: ticket.update(slaBreachSent=true)
        Note over CronSvc: cron.service.ts:66-69
    end

    CronSvc->>DB: ticket.findMany(status NOT in [resolved,closed], slaDeadline > now, slaWarningSent=false)
    Note over CronSvc: cron.service.ts:72-78

    loop For each pending ticket
        CronSvc->>CronSvc: Calculate elapsed %
        Note over CronSvc: cron.service.ts:82-84

        alt percentage >= 80
            CronSvc->>DB: user.findMany(departmentId, isActive=true)

            alt Dept has users
                CronSvc->>DB: notification.createMany(SLA_WARNING, with %)
                Note over CronSvc: cron.service.ts:91-100
            end

            CronSvc->>DB: ticket.update(slaWarningSent=true)
            Note over CronSvc: cron.service.ts:105-109
        end
    end
```

---

## 6. Analytics Export

**Sources:** `analytics.controller.ts:83-92`, `analytics.service.ts:279-353`

```mermaid
sequenceDiagram
    participant User
    participant AnalyticsCtrl as AnalyticsController
    participant AnalyticsSvc as AnalyticsService
    participant DB as Prisma
    participant FS as Filesystem

    User->>AnalyticsCtrl: GET /api/analytics/export?startDate=&endDate=
    Note over AnalyticsCtrl: analytics.controller.ts:83

    AnalyticsCtrl->>AnalyticsSvc: exportExcel(userId, role, deptId, ...)
    Note over AnalyticsSvc: analytics.service.ts:279

    AnalyticsSvc->>AnalyticsSvc: Check canExportData permission
    Note over AnalyticsSvc: analytics.service.ts:281-297

    alt No export permission
        AnalyticsSvc-->>Ctrl: Forbidden (EXPORT_FORBIDDEN)
    end

    AnalyticsSvc->>AnalyticsSvc: getBaseTicketFilter(role, userId, deptId)
    Note over AnalyticsSvc: analytics.service.ts:7-14

    AnalyticsSvc->>DB: ticket.findMany(baseWhere, date range)
    Note over AnalyticsSvc: analytics.service.ts:305-308

    DB-->>AnalyticsSvc: tickets[]

    AnalyticsSvc->>AnalyticsSvc: ExcelJS Workbook + Worksheet
    Note over AnalyticsSvc: analytics.service.ts:311-332
    AnalyticsSvc->>AnalyticsSvc: Build columns + rows

    AnalyticsSvc->>FS: writeFile to uploads/exports/tickets_report_{ts}.xlsx
    Note over AnalyticsSvc: analytics.service.ts:336-340

    AnalyticsSvc->>DB: exportHistory.create (expiresAt: now + 27h)
    Note over AnalyticsSvc: analytics.service.ts:342-350

    AnalyticsSvc-->>Ctrl: { filePath, fileName, fileUrl }

    AnalyticsCtrl->>User: Response with Content-Disposition: attachment
    Note over AnalyticsCtrl: analytics.controller.ts:87-90
    AnalyticsCtrl->>FS: createReadStream(filePath).pipe(res)
    Note over AnalyticsCtrl: File streaming to browser
```

---

## 7. User Authentication Flow (Login Deep Dive)

**Sources:** `auth.service.ts:12-93`

```mermaid
sequenceDiagram
    participant Req as Request
    participant AuthService as AuthService
    participant DB as Prisma

    Req->>AuthService: login(identifier, password)

    AuthService->>AuthService: Check identifier + password present
    Note over AuthService: auth.service.ts:13-14
    
    AuthService->>AuthService: Check password length <= 128
    Note over AuthService: auth.service.ts:17-18

    AuthService->>AuthService: Regex validate identifier
    Note over AuthService: /^[a-zA-Z0-9_.-]+$/ (line 21)

    AuthService->>DB: findFirst OR: badgeNumber, username + include department
    DB-->>AuthService: user or null

    alt Not found or inactive
        AuthService-->>Req: 401 Invalid credentials or inactive
    end

    AuthService->>AuthService: Check lockUntil > now
    Note over AuthService: auth.service.ts:39

    alt Account locked
        AuthService-->>Req: 423 + lockUntil timestamp
    end

    alt Lock expired
        AuthService->>DB: Update reset failedLoginAttempts, lockUntil=null
    end

    AuthService->>AuthService: bcrypt.compare(password, passwordHash)

    alt Hash mismatch
        AuthService->>AuthService: Increment failedLoginAttempts
        AuthService->>AuthService: If attempts >= 5 → lockUntil = now + 15min
        AuthService->>DB: Update attempts + lockUntil
        AuthService-->>Req: 401 Invalid credentials
    end

    AuthService->>DB: Update: reset attempts, set lastLoginAt
    AuthService->>AuthService: generateAccessToken(user)
    AuthService->>AuthService: generateRefreshToken(user)
    AuthService-->>Req: { accessToken, refreshToken, user }
```