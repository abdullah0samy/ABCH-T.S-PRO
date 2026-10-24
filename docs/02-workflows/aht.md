# AHT (Average Handle Time)

> Complete documentation of the Average Handle Time calculation system.

---

## 1. What AHT Measures

**CONFIRMED** — `analytics.service.ts:189-260`

AHT measures the **average active work time** per ticket — the total time tickets spend in the `in_progress` status, aggregated across all status history entries, then averaged per ticket.

This is **not** wall-clock time from creation to closure. Instead, it only counts periods where the ticket status was `in_progress`.

---

## 2. Calculation Algorithm

**CONFIRMED** — `analytics.service.ts:198-226`

### Step 1: Gather Resolved Tickets
```sql
SELECT id, priority, departmentId
FROM Ticket
WHERE completedAt IS NOT NULL
  AND status IN ('resolved', 'closed')
  -- (scoped by user role/department via getBaseTicketFilter)
```
(`analytics.service.ts:191`)

### Step 2: Fetch Status History for Those Tickets
```sql
SELECT * FROM TicketStatusHistory
WHERE ticketId IN (/* resolved ticket IDs */)
ORDER BY ticketId ASC, createdAt ASC
```
(`analytics.service.ts:198-200`)

**TicketStatusHistory schema** (`schema.prisma:342-354`):
| Field | Type | Purpose |
|-------|------|---------|
| ticketId | int | FK to Ticket |
| changedById | int | FK to User who changed status |
| oldStatus | string? | Previous status |
| newStatus | string | New status after transition |
| createdAt | DateTime | When the transition occurred |

### Step 3: Calculate in_progress Duration per Ticket
Iterates through history entries in chronological order per ticket:

```ts
for (const entry of historyEntries) {
  // Track when ticket enters in_progress
  if (entry.newStatus === 'in_progress' && entry.oldStatus !== 'in_progress') {
    inProgressStart.set(entry.ticketId, entry.createdAt);
  }
  // Track when ticket leaves in_progress (to any other status)
  else if (entry.oldStatus === 'in_progress' && entry.newStatus !== 'in_progress') {
    const start = inProgressStart.get(entry.ticketId);
    if (start) {
      const duration = entry.createdAt.getTime() - start.getTime();
      ticketDurations.set(entry.ticketId,
        (ticketDurations.get(entry.ticketId) || 0) + duration);
      inProgressStart.delete(entry.ticketId);
    }
  }
}
```
(`analytics.service.ts:207-219`)

**Key behaviors:**
- Multiple in_progress periods per ticket are **accumulated** (line 214: `+ duration`)
- If a ticket is still `in_progress` when queried, it calculates duration to `Date.now()` (lines 220-223)
- The algorithm tracks entry/exit pairs: when `newStatus === 'in_progress'` and `oldStatus !== 'in_progress'`, a timer starts. When `oldStatus === 'in_progress'` and `newStatus !== 'in_progress'`, the timer stops and accumulates.

### Step 4: Compute Overall AHT
```ts
const totalMs = Array.from(ticketDurations.values()).reduce((sum, d) => sum + d, 0);
const overallAhtHours = Math.round((totalMs / ticketDurations.size) / (1000 * 60 * 60) * 10) / 10;
```
(`analytics.service.ts:225-226)

Rounded to 1 decimal place.

---

## 3. Groupings

### 3.1 AHT by Priority
**CONFIRMED** — `analytics.service.ts:244-246`

```ts
interface AhtByPriority {
  priority: string;    // 'low' | 'normal' | 'high' | 'critical'
  avgHours: number;    // rounded to 1 decimal
  count: number;       // number of tickets in this priority
}
```

Aggregates `ticketDurations` grouped by ticket priority.

### 3.2 AHT by Department
**CONFIRMED** — `analytics.service.ts:248-257`

```ts
interface AhtByDepartment {
  departmentId: number;
  departmentName: string;
  avgHours: number;
  count: number;
}
```

**Access restriction:** Only available to `super_admin` (line 249). Supervisors and agents receive empty `ahtByDepartment: []`.

---

## 4. API Endpoint

### GET /api/analytics/aht
**CONFIRMED** — `analytics.controller.ts:68-73`

```ts
@Get('aht')
@UseGuards(RolesGuard)
@Roles('super_admin', 'supervisor', 'agent')
async getAHT(@Req() req: any) {
  return this.analyticsService.getAHT(...)
}
```

**Response structure:**
```json
{
  "overallAhtHours": 12.3,
  "totalResolved": 42,
  "ahtByPriority": [
    { "priority": "normal", "avgHours": 10.5, "count": 20 },
    { "priority": "high", "avgHours": 8.2, "count": 15 },
    { "priority": "critical", "avgHours": 3.1, "count": 5 },
    { "priority": "low", "avgHours": 18.0, "count": 2 }
  ],
  "ahtByDepartment": [
    { "departmentId": 1, "departmentName": "IT", "avgHours": 9.2, "count": 18 },
    { "departmentId": 2, "departmentName": "Medical Devices", "avgHours": 14.1, "count": 24 }
  ]
}
```

**Empty result:** When no resolved tickets exist, returns:
```json
{
  "overallAhtHours": 0,
  "totalResolved": 0,
  "ahtByPriority": [],
  "ahtByDepartment": []
}
```
(`analytics.service.ts:194-196`)

---

## 5. Data Requirements

### Required for Functionality

1. **TicketStatusHistory table** must contain status transition records with `oldStatus`, `newStatus`, and `createdAt`.
   - **CRITICAL:** AHT is computed entirely from `TicketStatusHistory`. If history records are missing or incomplete, AHT will be inaccurate or zero.
   - **UNKNOWN:** The service itself creates history entries. The code in `tickets.service.ts` creates `AuditLog` entries but the `TicketStatusHistory` records must be created by a different mechanism (possibly a Prisma lifecycle hook or middleware not present in the service methods observed).

2. **Tickets must have `completedAt` set** — only tickets with non-null `completedAt` are included in AHT calculation (`analytics.service.ts:191`: `completedAt: { not: null }`).

3. **Tickets must be in `resolved` or `closed` status** — same filter, line 191.

### RBAC Scoping

The AHT calculation respects role-based data scoping via `getBaseTicketFilter` (`analytics.service.ts:7-14`):

| Role | Scope |
|------|-------|
| super_admin | All tickets (no filter) |
| agent, supervisor | Tickets in user's department |
| end_user | (No access — `@Roles` guard excludes end_user) |

---

## 6. Frontend Display

**CONFIRMED** — `DashboardPage.tsx:515-558`

AHT displayed on the dashboard as:

### Overall AHT
Shown in a highlighted card with primary-blue background (`DashboardPage.tsx:521-527`):
```tsx
<span>{t.overallAht}</span>
<span className="text-lg font-bold text-primary-blue">{ahtData.overallAhtHours}h</span>
```

### AHT by Priority
Bar chart per priority level with color coding (`DashboardPage.tsx:529-558`):
- high/critical → `bg-danger-red`
- medium → `bg-warning-amber`
- other → `bg-success-green`
- Each bar shows: priority label, avgHours and count, relative-width proportional bar

### No Data State
When `ahtByPriority` is empty or no data available, displays: `notEnoughData` (`DashboardPage.tsx:555-558`)

---

## 7. Limitations and Observations

### Limitation: History Dependency
AHT computation relies entirely on `TicketStatusHistory` records. The status change service (`tickets.service.ts:408-488`) creates `AuditLog` entries but does **NOT** create `TicketStatusHistory` entries in the observed code.

**UNKNOWN** — Whether `TicketStatusHistory` records are created via:
- Prisma middleware/extension
- Separate database trigger
- An endpoint not in the main service files
- Database-level cascading

Without `TicketStatusHistory` records being populated, the AHT calculation would return zero or incomplete data.

### Not Business-Hours Aware
**CONFIRMED** — `sla.utils.ts:22`: "NOTE: Simple addition. Future versions could handle business hours." SLA and AHT use calendar time, not business hours.

### Wall Clock vs. Active Work
AHT only counts `in_progress` time periods, meaning:
- Time in `pending` or `open` status is **not** counted
- Multiple reopens accumulate additional in_progress time
- Transfer resets status to `pending`, which is not counted in AHT