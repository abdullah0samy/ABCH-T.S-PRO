# SLA (Service Level Agreement) Management

> Complete SLA system documentation with code evidence.

---

## 1. SLA Calculation Formula

**CONFIRMED** — `sla.utils.ts:10-25`, `tickets.service.ts:132-133`

```
slaDeadline = startTime + (baseHours × priorityModifier)

where:
  baseHours = ticketType.slaHours  (if set and ticket type assigned)
            || department.slaHours (default 24 hours)
            || 24                  (final fallback)

  priorityModifier:
    low      = 1.5   (extends deadline by 50%)
    normal   = 1.0   (no change)
    high     = 0.5   (halves deadline)
    critical = 0.25  (quarter of deadline)
```

### Code Evidence

**sla.utils.ts:10-25**
```ts
function calculateSLADeadline(baseHours, priority = 'normal', startTime = new Date()): Date {
  const modifier = PRIORITY_SLA_MODIFIERS[priority] || 1;
  const effectiveHours = baseHours * modifier;
  const deadline = new Date(startTime);
  deadline.setMilliseconds(deadline.getMilliseconds() + effectiveHours * 60 * 60 * 1000);
  return deadline;
}
```

**tickets.service.ts:132-133** (at creation):
```ts
const baseSlaHours = ticketType?.slaHours || targetDept.slaHours || 24;
const slaDeadline = calculateSLADeadline(baseSlaHours, priority || 'normal');
```

---

## 2. SLA Deadline: When Set/Recalculated

### 2.1 At Ticket Creation
**CONFIRMED** — `tickets.service.ts:132-133`, line 156: saved in `slaDeadline` field.

### 2.2 On Ticket Type Change
**CONFIRMED** — `tickets.service.ts:836-838`: When a ticket's type is updated (or changed during status update), the SLA deadline is recalculated with the new type's SLA hours.

```ts
const baseSlaHours = newType?.slaHours || 24;
const newSlaDeadline = calculateSLADeadline(baseSlaHours, ticket.priority as any);
```

### 2.3 On Transfer to Another Department
**CONFIRMED** — `tickets.service.ts:577-578`: SLA recalculated using the target department's SLA hours.

```ts
const slaHours = targetDept.slaHours || 24;
const newSlaDeadline = calculateSLADeadline(slaHours, ticket.priority as any);
```

### 2.4 Super Admin Override
**CONFIRMED** — `tickets.service.ts:945-958`: If priority, ticketTypeId, or departmentId is changed via super admin override, SLA is recalculated.

---

## 3. SLA Monitoring: Cron Job

**CONFIRMED** — `jobs.module.ts:21-23`, `cron.service.ts:36-111`

### Schedule
`*/5 * * * *` — runs every 5 minutes.

### Breach Detection (cron.service.ts:39-70)
```sql
SELECT * FROM Ticket
WHERE status NOT IN ('resolved', 'closed')
  AND slaDeadline < NOW()
  AND slaBreachSent = false
```

**Action per breached ticket:**
1. Create `SLA_BREACH` notification for every active user in the ticket's department
2. Set `slaBreachSent = true` (prevents duplicate notifications)

**Notification content:**
- titleEn: "SLA Breach Alert"
- titleAr: "تنبيه تجاوز اتفاقية مستوى الخدمة"
- bodyEn: "Ticket {number} has breached its SLA deadline."
- bodyAr: "تجاوزت التذكرة رقم {number} الموعد النهائي المحدد."

### Warning Detection (cron.service.ts:72-110)
```sql
SELECT * FROM Ticket
WHERE status NOT IN ('resolved', 'closed')
  AND slaDeadline > NOW()
  AND slaWarningSent = false
```

**Per ticket:** Calculates elapsed percentage:
```ts
const totalSlaTime = ticket.slaDeadline.getTime() - ticket.createdAt.getTime();
const timeElapsed = now.getTime() - ticket.createdAt.getTime();
const percentage = (timeElapsed / totalSlaTime) * 100;
```

**Action if `percentage >= 80`:**
1. Create `SLA_WARNING` notification for every active user in the ticket's department
2. Set `slaWarningSent = true` (prevents duplicate notifications)

**Notification content:**
- titleEn: "SLA Warning"
- titleAr: "تحذير اتفاقية مستوى الخدمة"
- bodyEn: "Ticket {number} has consumed {N}% of its SLA time."
- bodyAr: "استهلكت التذكرة رقم {number} حوالي {N}% من الوقت المحدد."

---

## 4. SLA Flags in Database

**CONFIRMED** — `schema.prisma:228-229`

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `slaDeadline` | DateTime? | null | Computed deadline timestamp |
| `slaWarningSent` | Boolean | `false` | Prevents duplicate warning notifications |
| `slaBreachSent` | Boolean | `false` | Prevents duplicate breach notifications |

---

## 5. SLA UI Visibility

### 5.1 Ticket Detail Page
**CONFIRMED** — `TicketDetailsPage.tsx:592-601`

SLA deadline displayed as a badge next to ticket number:
- **Normal (not breached):** `bg-[var(--bg-elevated)]` styling
- **Breached (deadline passed, ticket not resolved/closed):** `bg-danger-red` (red background)

```tsx
<span className={... `${
  new Date(ticket.slaDeadline) < new Date() && ticket.status !== 'resolved' && ticket.status !== 'closed'
    ? 'bg-danger-red text-white'
    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
}`}>
  SLA: {new Date(ticket.slaDeadline).toLocaleString()}
</span>
```

### 5.2 Dashboard Stats
**CONFIRMED** — `analytics.service.ts:47`

```ts
slaBreachCount = this.prisma.ticket.count({
  where: { ...baseWhereArchived, status: { notIn: ['resolved', 'closed'] }, slaDeadline: { lt: new Date() } }
});
```

Counted as "Overdue" in dashboard KPI cards. Also added with already-resolved-but-breached tickets for total `slaBreaches` (`analytics.service.ts:88`).

### 5.3 SLA Breach Events in WebSocket
**CONFIRMED** — `NotificationProvider.tsx:161-177`

WebSocket events `sla-warning` and `sla-breach` are handled (type: warning/error respectively), though the current cron implementation writes to DB notifications rather than emitting WebSocket events. The WS handlers exist for future integration or direct service emission.

---

## 6. SLA Override Hierarchy

**CONFIRMED** — `tickets.service.ts:132`, `schema.prisma:195,67`

Priority of SLA base hours:

1. **Ticket Type SLA (`ticketType.slaHours`)** — overrides department default if assigned and set
   - schema: `TicketType.slaHours Int?` (`schema.prisma:195`)

2. **Department SLA (`department.slaHours`)** — default is 24 hours
   - schema: `Department.slaHours Int @default(24)` (`schema.prisma:67`)

3. **Hardcoded fallback (24 hours)** — if both are null/missing

### Example Calculations
| Dept SLA | Type SLA | Priority | Effective Hours | Total from creation |
|----------|----------|----------|----------------|-------------------|
| 24 | (none) | normal | 24 × 1.0 = 24h | +24 hours |
| 24 | 8 | high | 8 × 0.5 = 4h | +4 hours |
| 48 | (none) | critical | 48 × 0.25 = 12h | +12 hours |
| 24 | (none) | low | 24 × 1.5 = 36h | +36 hours |

---

## 7. SLA in Agent Performance

**CONFIRMED** — `analytics.service.ts:98-100`

Per-agent SLA adherence rate:
```ts
const slaAdherent = resolvedTickets.filter(t => t.completedAt! <= t.slaDeadline!).length;
const slaAdherenceRate = resolvedCount > 0 ? Math.round((slaAdherent / resolvedCount) * 100) : null;
```

Displays percentage of resolved/closed tickets completed within SLA.

---

## 8. SLA Breach Counting in Analytics

**CONFIRMED** — `analytics.service.ts:87-88`

Total reported SLA breaches = currently-breach active tickets + historically-breached resolved tickets:
```ts
const breachedResolved = resolvedTicketsForAvg.filter(t => t.completedAt! > t.slaDeadline!);
const slaBreaches = slaBreachCount + breachedResolved.length;
```

This distinguishes between:
- **Current breaches**: active tickets past deadline (dashboard "Overdue" metric)
- **Historical breaches**: tickets that were resolved but exceeded their SLA before closure