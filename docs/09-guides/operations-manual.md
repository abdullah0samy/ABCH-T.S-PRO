# Operations Manual

## Service Health Checks

### Automated Health Checks

Docker health checks run continuously in production:

- **PostgreSQL**: `pg_isready -U johndoe -d abch_db` every 10s, timeout 5s, 5 retries (`docker-compose.yml:14-18`)
- **Redis**: `redis-cli ping` every 10s, timeout 5s, 5 retries (`docker-compose.yml:28-32`)

### Manual Health Verification

```sh
# Check all containers are healthy
docker-compose ps

# Verify PostgreSQL connectivity
docker-compose exec postgres pg_isready

# Verify Redis connectivity
docker-compose exec redis redis-cli ping

# Check backend HTTP health
curl http://localhost:3007/api/tickets/form-data
```

### WebSocket Connectivity

The WebSocket gateway at `backend/src/gateways/ticket.gateway.ts:33-35` accepts connections from configured CORS origins. Verify:

```sh
# Check socket.io is listening on backend port
curl -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -i http://localhost:3007/socket.io/?EIO=4&transport=polling
```

## Log Monitoring

### Backend Logs (Morgan)

HTTP request logging via Morgan runs in dev mode by default (`backend/src/main.ts:66`). Each log line includes: method, path, status code, response time.

```sh
docker-compose logs -f backend | grep "POST /api/tickets"
docker-compose logs -f backend | grep "401"  # Unauthorized requests
docker-compose logs -f backend | grep "500"  # Server errors
```

### Audit Log Monitoring

The `AuditLog` table (schema L446-468) records all significant actions. Query recent activity:

```sql
SELECT al.*, u.username, u.full_name_en
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 50;
```

Monitor for unusual patterns:
- Bulk user creation/deletion (action: `CREATE_USER`, `DELETE_USER`)
- Permission changes (action: `UPDATE_PERMISSIONS`)
- Role modifications (action: `UPDATE_ROLE`)
- Export operations (action: `EXPORT_DATA`)

### Nginx Frontend Logs

```sh
# Nginx access log
docker-compose logs -f frontend | grep "GET"

# Look for 404 SPA fallback patterns (expected for React Router)
docker-compose logs frontend | grep "404"
```

## Database Backup

### Manual Backup

```sh
# Full database dump
docker-compose exec postgres pg_dump -U johndoe -d abch_db > backup_$(date +%F_%H%M).sql

# Restore from backup
psql -h localhost -p 5445 -U johndoe -d abch_db < backup_2024-01-15_1200.sql
```

### Automated Backup Script

Recommended cron schedule (daily at 2 AM):

```sh
0 2 * * * pg_dump -h localhost -p 5445 -U johndoe -d abch_db | gzip > /backups/abch_$(date +\%F).sql.gz
```

### Backup Retention

Keep backups for at least 30 days. The `ExportHistory` model tracks file exports with an `expiresAt` field set to 24 hours after creation.

## Scheduled Jobs (Cron)

Three cron jobs run via BullMQ processors (`backend/src/modules/jobs/cron.processor.ts:13-23`):

### 1. SLA Monitoring (Every 5 Minutes)

- **Job name**: `sla-check`
- **Service**: `CronService.slaCheck()` (`backend/src/modules/jobs/cron.service.ts:36-110`)
- **Function**:
  - Scans tickets with `slaDeadline < now` and `slaBreachSent = false` → creates `SLA_BREACH` notifications for all active users in the ticket's department
  - Scans tickets approaching SLA deadline (>80% consumed) with `slaWarningSent = false` → creates `SLA_WARNING` notifications
- **Monitors**: `Ticket.slaDeadline` index (`schema.prisma:L268`)

### 2. Export Cleanup (Daily at 3 AM)

- **Job name**: `cleanup-exports`
- **Service**: `CronService.cleanupExports()` (`backend/src/modules/jobs/cron.service.ts:11-33`)
- **Function**: Deletes expired export files from disk and removes `ExportHistory` records where `expiresAt <= now`
- **Storage**: Files stored at `uploads/exports/` (created by Dockerfile, L22)
- **Export retention**: 24 hours (analytics service sets `expiresAt: new Date(new Date().setHours(27, 0, 0, 0))` at `backend/src/modules/analytics/analytics.service.ts:348`)

### 3. Auto-Archive (Daily at 4 AM)

- **Job name**: `auto-archive`
- **Service**: `CronService.autoArchive()` (`backend/src/modules/jobs/cron.service.ts:113-145`)
- **Function**: Sets `isArchived = true` on tickets with `status IN ('resolved', 'closed')` and `completedAt < 30 days ago`
- **Audit trail**: Records `AUTO_ARCHIVED` action in `AuditLog` with reason text

### Verifying Cron Jobs

```sql
-- Check recent SLA notifications
SELECT * FROM notifications
WHERE event_type IN ('SLA_BREACH', 'SLA_WARNING')
ORDER BY created_at DESC LIMIT 20;

-- Check auto-archived tickets
SELECT ticket_number, status, completed_at, archived_at
FROM tickets
WHERE is_archived = true AND archived_at IS NOT NULL
ORDER BY archived_at DESC LIMIT 10;

-- Check expired exports cleaned up
SELECT * FROM export_history
WHERE expires_at < NOW()
LIMIT 10;
-- This should be empty if cleanup is working
```

## Redis Monitoring

### Connection Health

```sh
docker-compose exec redis redis-cli INFO clients
docker-compose exec redis redis-cli INFO memory
docker-compose exec redis redis-cli DBSIZE
```

### BullMQ Queue Inspection

```sh
docker-compose exec redis redis-cli KEYS "bull:cron-jobs:*"
docker-compose exec redis redis-cli INFO keyspace
```

### Redis Persistence

The `dump.rdb` file is saved every 60 seconds if at least 1 key changed. Mounted at `./dump.rdb` on host (`docker-compose.yml:25`).

## WebSocket Reconnection

The frontend uses `socket.io-client` (`frontend/package.json:L30`) with the `TicketGateway` at `backend/src/gateways/ticket.gateway.ts`:

### Reconnection Behavior

Socket.IO client handles automatic reconnection with exponential backoff. The gateway re-authenticates on reconnect by verifying the JWT token at `handleConnection` (L40-54).

### Rate Limiting

WebSocket events are rate-limited per socket (L7-27):
- `join-ticket`: max 5 requests per 1000ms window

### Reconnection Monitoring

```sh
# Check current WebSocket connections
docker-compose logs backend | grep "Connection from"
docker-compose logs backend | grep "disconnect"
```

If the backend restarts, all clients will reconnect automatically. Department, user, and ticket rooms must be re-joined by the frontend.

## User Account Management

### Account Lockout

After 5 failed login attempts, an account is locked for 15 minutes (`backend/src/modules/auth/auth.service.ts:58-60`):

```sh
# Find locked accounts in database
SELECT badge_number, username, failed_login_attempts, lock_until
FROM users
WHERE lock_until > NOW();

# Manually unlock an account
UPDATE users SET failed_login_attempts = 0, lock_until = NULL
WHERE username = 'user@example.com';
```

### Force Password Change

```sql
-- Force a user to change password on next login
UPDATE users SET force_password_change = true WHERE id = <user_id>;
```

### Disable User Account

```sql
-- Soft-disable a user (they won't be able to log in)
UPDATE users SET is_active = false WHERE id = <user_id>;
```

## Emergency Procedures

### 1. Backend Not Starting

**Symptom**: Container restarts repeatedly or exits immediately.

```sh
# Check logs for JWT secret validation failure
docker-compose logs backend | grep "CRITICAL"

# Most common cause: missing JWT_ACCESS_SECRET or JWT_REFRESH_SECRET
# Fix: Update docker-compose.yml environment variables and restart
docker-compose up -d --build backend
```

### 2. Database Connection Failed

```sh
# Verify PostgreSQL is running and accepting connections
docker-compose exec postgres pg_isready

# Check connection string in backend environment
docker-compose exec backend sh -c 'echo $DATABASE_URL'

# Verify from backend:
docker-compose exec backend npx prisma db push
```

### 3. Redis Connection Lost

```sh
# Ping Redis
docker-compose exec redis redis-cli ping

# If Redis is down:
docker-compose restart redis

# Verify BullMQ queues are accessible
docker-compose exec redis redis-cli PING
```

### 4. High Ticket Volume / System Overload

1. Monitor PostgreSQL connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'abch_db';
   -- Connection pool is limited to 20 per schema.prisma:L9
   ```

2. Check SLA breach accumulation:
   ```sql
   SELECT count(*) FROM tickets
   WHERE status NOT IN ('resolved', 'closed')
   AND sla_deadline < NOW()
   AND sla_breach_sent = false;
   ```

3. If audit log is growing too large, archive old records:
   ```sql
   -- Archive audit logs older than 90 days
   SELECT count(*) FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
   ```

### 5. File Upload Storage Full

```sh
# Check upload directories
docker-compose exec backend ls -la uploads/
docker-compose exec backend du -sh uploads/avatars uploads/exports

# Manually clean old exports
docker-compose exec backend rm uploads/exports/*.xlsx

# Or run the cleanup job manually
# (via BullMQ job queue — requires sending 'cleanup-exports' job)
```

## Incident Response Checklist

| Scenario           | Immediate Action                          | Follow-up                              |
|--------------------|-------------------------------------------|----------------------------------------|
| Downtime           | `docker-compose ps` to identify failed service | Restore from latest healthy container |
| Data corruption    | Stop writes, restore from pg_dump backup  | Audit `audit_logs` for unauthorized changes |
| SLA notifications failing | Check BullMQ queue and cron job logs  | Restart backend if queue is stuck      |
| Authentication failures | Check `failed_login_attempts` in DB  | Review `last_login_ip` for suspicious activity |
| Export failures    | Verify `uploads/exports/` disk space      | Run `cleanup-exports` manually        |