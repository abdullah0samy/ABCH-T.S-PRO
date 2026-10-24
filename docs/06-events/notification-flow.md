# Notification Flow Documentation

## Overview

The notification system has three delivery channels:
1. **In-app notifications** (REST API + WebSocket push)
2. **WebSocket real-time events** (Socket.IO)
3. **Browser push notifications** (Web Push API + VAPID)

---

## 1. In-App Notifications

### Model

**File:** `backend/prisma/schema.prisma:356-374`

```
Notification {
  id        Int       @id
  userId    Int       // Target user
  ticketId  Int?      // Related ticket
  eventType String    // e.g., SLA_BREACH, SLA_WARNING
  titleAr   String?   // Arabic title
  titleEn   String?   // English title
  bodyAr    String?   // Arabic body
  bodyEn    String?   // English body
  isRead    Boolean   @default(false)
  createdAt DateTime  @default(now())
}
```

Indexes on `userId`, `userId + isRead`, and `ticketId` (`schema.prisma:370-372`).

### REST API Endpoints

**Controller:** `backend/src/modules/notifications/notifications.controller.ts`

| Method | Endpoint | Guard | Source |
|--------|----------|-------|--------|
| GET | `/api/notifications` | JWT | `notifications.controller.ts:14` |
| PUT | `/api/notifications/:id/read` | JWT | `notifications.controller.ts:20` |
| PUT | `/api/notifications/read-all` | JWT | `notifications.controller.ts:24` |
| POST | `/api/notifications/subscribe` | JWT | `notifications.controller.ts:30` |
| DELETE | `/api/notifications/subscribe` | JWT | `notifications.controller.ts:35` |

### Service Layer

**File:** `backend/src/modules/notifications/notifications.service.ts`

- `findAll()` (`notifications.service.ts:19-41`): Paginated query (default: page 1, limit 50, max 100). Returns `unreadCount` in separate query.
- `markRead()` (`notifications.service.ts:43-47`): Ownership check — requires matching `userId`.
- `markAllRead()` (`notifications.service.ts:49-51`): Bulk update on `isRead: false`.

---

## 2. WebSocket Events

### Backend Gateway

**File:** `backend/src/gateways/ticket.gateway.ts`

A NestJS `@WebSocketGateway` using Socket.IO with CORS configured for production (`process.env.FRONTEND_URL`) and dev hosts (`localhost:3000`, `localhost:5173`, etc.) (`ticket.gateway.ts:29-35`).

#### Connection Authentication (`ticket.gateway.ts:40-53`)

1. Extracts JWT from `client.handshake.auth?.token` or `client.handshake.query?.token` (`ticket.gateway.ts:41`)
2. Emits `error: 'Authentication required'` and disconnects if token missing (`ticket.gateway.ts:42-45`)
3. Verifies token via `verifyAccessToken()` (`ticket.gateway.ts:48`)
4. On failure, emits `error: 'Invalid or expired token'` and disconnects (`ticket.gateway.ts:51-52`)
5. Stores decoded payload on `(client).userData` (`ticket.gateway.ts:49`)

#### Rooms

| Room | Event | Join Condition | Source |
|------|-------|---------------|--------|
| `user-{userId}` | `join-user` | `userData.id === userId` | `ticket.gateway.ts:69-73` |
| `dept-{deptId}` | `join-department` | `super_admin` or `userData.departmentId === deptId` | `ticket.gateway.ts:61-66` |
| `ticket-{ticketId}` | `join-ticket` | Authenticated user (rate-limited: 5/sec) | `ticket.gateway.ts:76-83` |
| — | `leave-ticket` | Any authenticated user | `ticket.gateway.ts:85-88` |

**Rate Limiting** (`ticket.gateway.ts:11-27`): In-memory `Map<string, Map<string, RateLimitEntry>>` keyed by socketId. Window-based check with configurable `maxRequests` and `windowMs`. `join-ticket` is rate-limited to 5 requests per 1000ms.

**Cleanup** (`ticket.gateway.ts:56-58`): Rate limit entries deleted on disconnect.

#### Emit Methods (`ticket.gateway.ts:90-100`)

| Method | Targets Room | Source |
|--------|-------------|--------|
| `emitToDept(deptId, event, data)` | `dept-{deptId}` | `ticket.gateway.ts:90-92` |
| `emitToUser(userId, event, data)` | `user-{userId}` | `ticket.gateway.ts:94-96` |
| `emitToTicket(ticketId, event, data)` | `ticket-{ticketId}` | `ticket.gateway.ts:98-100` |

### WebSocket Events Emitted by TicketsService

| Event | Emitted To | Trigger | Source |
|-------|-----------|---------|--------|
| `new-ticket` | `dept-{deptId}` | Ticket creation | `tickets.service.ts:179` |
| `ticket-status-updated` | `user-{creatorId}`, `dept-{deptId}`, `ticket-{ticketId}` | Status change | `tickets.service.ts:483-485` |
| `ticket-assigned` | `user-{agentId}`, `ticket-{ticketId}` | Ticket assignment | `tickets.service.ts:534-536` |
| `new-comment` | `dept-{deptId}`, `user-{creatorId}`, `user-{assignedToId}` | Comment added | `tickets.service.ts:643-645` |
| `ticket-closed` | `dept-{deptId}` | Resolution confirmation | `tickets.service.ts:687` |
| `ticket-transferred` | `dept-{oldDeptId}` | Transfer + notify source | `tickets.service.ts:598` |
| `new-ticket` (to target) | `dept-{targetDeptId}` | Transfer + notify target | `tickets.service.ts:597` |
| `ticket-status-updated` | `ticket-{id}`, `user-{creatorId}` | Bulk status update | `tickets.service.ts:729-731` |
| `ticket-assigned` | `ticket-{id}`, `user-{creatorId}` | Bulk assign | `tickets.service.ts:779-780` |

### Frontend NotificationProvider

**File:** `backend/src/core/NotificationProvider.tsx`

A React context provider that manages:

#### Constants

| Constant | Value | Source |
|----------|-------|--------|
| `MAX_RECONNECT_ATTEMPTS` | `10` | `NotificationProvider.tsx:31` |
| `RECONNECT_DELAY` | `2000` ms | `NotificationProvider.tsx:32` |
| `TOAST_DURATION` | `6000` ms | `NotificationProvider.tsx:33` |
| `MAX_NOTIFICATIONS` | `100` | `NotificationProvider.tsx:34` |

#### WebSocket Connection (`NotificationProvider.tsx:83-180`)

1. Creates Socket.IO client with `io(window.location.origin)` (`NotificationProvider.tsx:93`)
2. Sends JWT via `auth: { token: currentToken }` (`NotificationProvider.tsx:94`)
3. Reconnection config: `reconnection: true`, `reconnectionAttempts: 10`, `reconnectionDelay: 2000`, `reconnectionDelayMax: 10000`, `timeout: 10000` (`NotificationProvider.tsx:95-99`)
4. Transports: `['websocket', 'polling']` (`NotificationProvider.tsx:100`)
5. On connect: emits `join-user(currentUser.id)` and `join-department(currentUser.departmentId)` (`NotificationProvider.tsx:105-108`)

#### Incoming Event Handlers

| Socket Event | Frontend Action | Source |
|-------------|----------------|--------|
| `new-ticket` | Toast + notification + dispatch `ws:ticket-created` | `NotificationProvider.tsx:118-126` |
| `ticket-status-updated` | Toast + notification (success/warning type) + dispatch `ws:ticket-status-updated` | `NotificationProvider.tsx:128-139` |
| `ticket-assigned` | Warning toast + notification + dispatch `ws:ticket-assigned` | `NotificationProvider.tsx:142-149` |
| `new-comment` | Info toast + notification + dispatch `ws:new-comment` | `NotificationProvider.tsx:151-159` |
| `sla-warning` | Warning toast + notification | `NotificationProvider.tsx:161-168` |
| `sla-breach` | Error toast + notification | `NotificationProvider.tsx:170-177` |

#### Browser Push (`NotificationProvider.tsx:78-80`)

Native browser `Notification` constructed when `Notification.permission === 'granted'`.

#### Context API

| Property / Method | Description |
|-------------------|-------------|
| `notifications[]` | Local notification list (max 100) |
| `unreadCount` | Filtered count of unread |
| `toasts[]` | Active toasts (auto-dismiss TOAST_DURATION) |
| `markAsRead(id)` | Sets `read: true` on single notification |
| `markAllAsRead()` | Sets all `read: true` |
| `clearNotifications()` | Clears all local notifications |
| `removeToast(id)` | Removes toast and clears timer |
| `addNotification(notif)` | Adds notification + toast + native push |

---

## 3. Browser Push Notifications

### Model

**File:** `backend/prisma/schema.prisma:433-444`

```
PushSubscription {
  id        Int       @id
  userId    Int
  endpoint  String    // Push service URL
  p256dh    String    // Public key
  auth      String    // Auth secret
  createdAt DateTime
}
```

Unique constraint on `[userId, endpoint]` (`schema.prisma:442`).

### VAPID Configuration

**File:** `backend/src/modules/notifications/notifications.service.ts:8-16`

VAPID keys loaded from environment variables:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_CONTACT` (default: `mailto:admin@abch.com`)

Uses `web-push` library (`webpush.setVapidDetails()`) (`notifications.service.ts:11`).

### Endpoints

| Method | Endpoint | Purpose | Source |
|--------|----------|---------|--------|
| POST | `/api/notifications/subscribe` | Register push subscription | `notifications.controller.ts:30` |
| DELETE | `/api/notifications/subscribe` | Remove push subscription | `notifications.controller.ts:35` |

Deduplication: Service checks for existing endpoint before creating (`notifications.service.ts:55-58`).

**NOTE:** The `webpush` library is imported but no `webpush.sendNotification()` call exists anywhere in the codebase. Push delivery is NOT CONFIRMED — subscription storage works but actual push sending is NOT CONFIRMED.

---

## 4. Notification Triggers — Server-Side (Database)

### SLA Check Cron

**File:** `backend/src/modules/jobs/cron.service.ts`

Runs via BullMQ `sla-check` job (`cron.processor.ts:18`).

**SLA Breach** (`cron.service.ts:39-70`):
1. Finds tickets: status NOT in [resolved, closed], `slaDeadline < now`, `slaBreachSent = false`
2. Creates notifications for ALL active users in the ticket's department with:
   - `eventType: 'SLA_BREACH'`
   - `titleAr: 'تنبيه تجاوز اتفاقية مستوى الخدمة'`
   - `titleEn: 'SLA Breach Alert'`
3. Sets `slaBreachSent: true` on the ticket

**SLA Warning** (`cron.service.ts:72-110`):
1. Finds tickets: status NOT in [resolved, closed], `slaDeadline > now`, `slaWarningSent = false`
2. Calculates elapsed percentage: `(now - createdAt) / (slaDeadline - createdAt) * 100`
3. If `percentage >= 80`, creates notifications for ALL active users in department with:
   - `eventType: 'SLA_WARNING'`
   - `titleAr: 'تحذير اتفاقية مستوى الخدمة'`
   - `titleEn: 'SLA Warning'`
   - Body includes rounded percentage
4. Sets `slaWarningSent: true` on the ticket

**NOT CONFIRMED:** The cron service creates database notifications but does NOT emit WebSocket events. The `sla-warning` and `sla-breach` events are handled by the frontend `NotificationProvider` but their backend emission source is NOT CONFIRMED.

---

## 5. Notification Flow Diagrams

### In-App Notification (REST)
```
User opens notification panel
  → GET /api/notifications
  → NotificationsService.findAll(userId)
  → Returns { data[], unreadCount, pagination }
  → Display in UI dropdown
```

### Real-Time Notification (WebSocket)
```
Agent changes ticket status
  → TicketsService.updateStatus()
  → ticketGateway.emitToUser(creatorId, 'ticket-status-updated', ...)
  → ticketGateway.emitToDept(deptId, 'ticket-status-updated', ...)
  → ticketGateway.emitToTicket(ticketId, 'ticket-status-updated', ...)
  → Frontend NotificationProvider receives event
  → addNotification() → toast + local state
  → Browser push (if permission granted)
```

### SLA Notification (Cron)
```
Cron queue → sla-check job (every 5 min)
  → CronService.slaCheck()
  → Find breached tickets → createMany notifications → set slaBreachSent
  → Find warning tickets (≥80%) → createMany notifications → set slaWarningSent
```

---

## Known Gaps

1. **Push delivery:** `web-push` is initialized but no `sendNotification()` call found in the codebase. Push notifications are stored but delivery is NOT CONFIRMED.
2. **WebSocket SLA events:** Frontend handles `sla-warning` and `sla-breach` events, but the backend cron service creates only database notifications, not WebSocket emits. Source of these WebSocket events is NOT CONFIRMED.
3. **Rate limiting scope:** Socket.IO rate limiting is in-memory per-process. In a multi-instance deployment, rate limits would not be shared.
4. **No WebSocket rate limit on join-user / join-department:** Only `join-ticket` is rate-limited (`ticket.gateway.ts:78`).