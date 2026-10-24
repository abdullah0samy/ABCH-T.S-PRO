# Troubleshooting Guide

## 1. Login Failures

### Account Locked After Failed Attempts

**Symptom**: User sees "Account locked. Too many failed attempts." with HTTP 423.

**Cause**: After 5 consecutive failed login attempts, the `lockUntil` field is set to 15 minutes from the time of the 5th failure (`backend/src/modules/auth/auth.service.ts:58-60`).

**Resolution**:

- **Wait**: Lockout expires automatically after 15 minutes
- **Admin unlock**:
  ```sql
  UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE username = '<username>';
  ```

### Invalid Identifier Format

**Symptom**: "Invalid identifier format" error.

**Cause**: Username/badge number contains disallowed characters. Only `a-zA-Z0-9_.-` are accepted (`backend/src/modules/auth/auth.service.ts:21`).

**Resolution**: Ensure the user enters their badge number or username without special characters, spaces, or email format.

### Inactive Account

**Symptom**: "Invalid credentials or inactive account" error.

**Cause**: `User.isActive = false` or user was soft-deleted (`deletedAt` is set).

**Resolution**:
```sql
-- Check account status
SELECT id, username, is_active, deleted_at FROM users WHERE username = '<username>';

-- Re-activate if needed
UPDATE users SET is_active = true WHERE id = <user_id>;
```

### Force Password Change Required

**Symptom**: Login succeeds but the UI prompts for password change.

**Cause**: `User.forcePasswordChange = true` (`schema.prisma:L117`).

**Resolution**: Complete the password change flow. Admins can reset this flag:
```sql
UPDATE users SET force_password_change = false WHERE id = <user_id>;
```

## 2. WebSocket Disconnection

**Symptom**: Real-time notifications stop; ticket updates don't appear live.

**Cause**: The WebSocket connection to the `TicketGateway` (`backend/src/gateways/ticket.gateway.ts`) dropped.

**Resolution**:

1. The `socket.io-client` on the frontend handles automatic reconnection with exponential backoff
2. On reconnect, the gateway re-authenticates using the JWT token from `client.handshake.auth.token` (L41-48)
3. After reconnection, the frontend must re-join rooms:
   - `join-department(deptId)` — joins `dept-{deptId}` room (L61-66)
   - `join-user(userId)` — joins `user-{userId}` room (L68-74)
   - `join-ticket(ticketId)` — joins `ticket-{ticketId}` room (L76-88)

**Prevention**:
- Ensure the CORS origins match between frontend and backend (L29-31)
- In production, set `FRONTEND_URL` environment variable
- WebSocket rate limiting on `join-ticket` is 5 requests per 1000ms — avoid rapid ticket switching

## 3. SLA Calculation Errors

**Symptom**: SLA deadlines seem incorrect or notifications fire at wrong times.

**Cause**: SLA deadline is calculated as `baseHours × priorityModifier` (`backend/src/modules/tickets/sla.utils.ts:10-25`).

**Expected values with 24h base SLA**:

| Priority  | Modifier | Expected Deadline |
|-----------|----------|-------------------|
| low       | 1.5x     | +36 hours         |
| normal    | 1.0x     | +24 hours         |
| high      | 0.5x     | +12 hours         |
| critical  | 0.25x    | +6 hours          |

**Debugging**:

```sql
-- Check SLA deadlines for recently created tickets
SELECT id, ticket_number, priority, created_at, sla_deadline,
       EXTRACT(EPOCH FROM (sla_deadline - created_at)) / 3600 AS sla_hours,
       sla_warning_sent, sla_breach_sent
FROM tickets
WHERE created_at > NOW() - INTERVAL '48 hours'
ORDER BY created_at DESC;
```

**Cron Timing**: The SLA check runs every 5 minutes. Warnings fire at 80% SLA consumption, breaches fire when `slaDeadline < now` (`backend/src/modules/jobs/cron.service.ts:36-110`).

**Note**: SLA calculation uses simple time addition. It does not account for weekends, holidays, or business hours.

## 4. File Upload Rejections

**Symptom**: "File content does not match declared MIME type" (HTTP 422).

**Cause**: Magic byte validation mismatch (`backend/src/modules/uploads/uploads.service.ts:6-17`). The system checks the first bytes of the file against known signatures.

**Supported MIME Types and Magic Bytes**:

| MIME Type                                                  | First Bytes (Hex)           |
|-----------------------------------------------------------|-----------------------------|
| image/jpeg                                                | `FF D8 FF`                  |
| image/png                                                 | `89 50 4E 47`               |
| application/pdf                                           | `25 50 44 46`               |
| application/msword (doc)                                  | `D0 CF 11 E0`               |
| application/vnd.openxmlformats-...document (docx)         | `50 4B 03 04`               |
| application/vnd.ms-excel (xls)                            | `D0 CF 11 E0`               |
| application/vnd.openxmlformats-...sheet (xlsx)            | `50 4B 03 04`               |
| audio/wav                                                 | `52 49 46 46`               |
| audio/mpeg (mp3)                                          | `49 44 3` or `FF E0-EF`     |
| audio/webm                                                | `1A 45 DF A3`               |

**Resolution**:
1. Verify the file is actually the declared type (not a renamed file)
2. Check the file isn't corrupted (re-save from the original application)
3. For image uploads via `updateAvatar`, only JPEG and PNG are supported (processed by Sharp)

**Debugging**:
```sql
-- Check recently failed upload attempts (no DB record created on failure)
-- Check server logs:
docker-compose logs backend | grep "File content does not match"
```

## 5. Export Failures

**Symptom**: Export generation hangs or returns error.

**Common Causes**:

1. **Permission denied**: User lacks `canExportData` permission
   - Check `UserPermissionOverride.canExportData` or department's `defaultPermissions.canExportData`
   - Default: `canExportData: false` (`schema.prisma:L21`)
   - Error code: `EXPORT_FORBIDDEN`

2. **Disk space**: `uploads/exports/` directory is full
   - Check: `docker-compose exec backend df -h`
   - Clean old exports: run `cleanup-exports` cron job manually

3. **ExcelJS memory**: Large datasets may exhaust memory
   - Filter by date range to reduce export size
   - Check: `docker-compose logs backend | grep "exceljs"`

4. **File path injection**: Export filenames are sanitized via `path.basename()`
   - Should not cause errors unless there's a programming issue

**Verify exports are being cleaned up**:
```sql
-- Should return empty if cleanup is working
SELECT id, file_name, expires_at FROM export_history WHERE expires_at < NOW();
```

## 6. Permission Denied Errors

**Symptom**: "You do not have permission to..." errors on various operations.

**Permission Resolution Order** (evaluated in this order):

1. **Super Admin**: `role = 'super_admin'` — always has access
2. **User Permission Override**: `UserPermissionOverride` — per-user override (highest priority for non-admins)
3. **Department Default Permissions**: `DeptPermissions` linked via `defaultPermissionsId`
4. **Role-based**: `Role` → `Permission` many-to-many

**Debugging**:

```sql
-- Check a user's effective permissions
SELECT
  u.username, u.role, u.department_id,
  upo.can_view_analytics, upo.can_export_data, upo.can_archive_tickets,
  dp.can_view_analytics AS dept_can_view_analytics,
  dp.can_export_data AS dept_can_export_data
FROM users u
LEFT JOIN user_permission_overrides upo ON u.id = upo.user_id
LEFT JOIN departments dept ON u.department_id = dept.id
LEFT JOIN dept_permissions dp ON dept.default_permissions_id = dp.id
WHERE u.id = <user_id>;
```

**Common Error Codes**:
| Error Code            | Meaning                                |
|-----------------------|----------------------------------------|
| `ANALYTICS_FORBIDDEN` | Missing `canViewAnalytics` permission  |
| `EXPORT_FORBIDDEN`    | Missing `canExportData` permission     |

**Resolution**: Grant the specific permission via User Override or Department Defaults in the Admin panel.

## 7. Missing Translations

**Symptom**: UI text appears in the wrong language or shows raw translation keys.

**Cause**: The frontend uses `i18next` with browser-language detection (`i18next-browser-languagedetector`, `frontend/package.json:L19-20`).

**Resolution**:

1. **Check user's language preference**:
   ```sql
   SELECT id, username, lang_pref FROM users WHERE id = <user_id>;
   ```

2. **Update user's preference**:
   - Via Profile Settings → Language preference
   - Or directly: `UPDATE users SET lang_pref = 'en' WHERE id = <user_id>;`

3. **Check translation files**: Verify the required translation keys exist in `backend/src/core/translations.ts` and frontend i18n resources.

4. **RTL/LTR rendering**: Arabic (`lang_pref = 'ar'`) activates RTL layout. English activates LTR.

## 8. RTL/LTR Layout Issues

**Symptom**: Text alignment, direction, or layout is broken.

**Cause**: The system supports bilingual content with RTL (Arabic) and LTR (English) layouts. Tailwind CSS is configured with RTL support.

**Debugging**:

1. Check the `dir` attribute on the HTML root element changes with language
2. Verify `lang_pref` matches the rendered language
3. Check CSS classes use Tailwind's RTL variants (`rtl:`)

**Resolution**:
- Ensure the frontend properly sets `dir="rtl"` when `lang_pref = 'ar'`
- Verify browser-language detection isn't overriding the user's saved preference
- Clear browser cache if layout changes don't take effect

## 9. CORS / Nginx Proxy Issues

**Symptom**: API calls fail with CORS errors or 404 on proxy routes.

**Development** (`backend/src/main.ts:54-56`):
```js
// Allowed origins in development:
'http://localhost:3000', 'http://localhost:5173',
'127.0.0.1:3000', '127.0.0.1:5173'
```

**Production** (L54-55):
```js
[process.env.FRONTEND_URL || 'https://yourdomain.com']
```

**Nginx Proxy** (`frontend/nginx.conf`):
- API routes: `/api/` → `http://backend:4000/api/`
- Uploads: `/uploads/` → `http://backend:4000/uploads/`
- WebSocket: `/socket.io/` → `http://backend:4000/socket.io/`

**Resolution**:
1. For production: set `FRONTEND_URL` environment variable to your domain
2. Verify Nginx config proxies all required paths
3. Check WebSocket upgrade headers are passed through Nginx

## 10. CSRF Token Errors

**Symptom**: POST/PUT/PATCH requests return 403 Forbidden.

**Cause**: Double-submit CSRF protection is enabled (`backend/src/main.ts:70-90`).

**Resolution**:
1. Ensure the frontend retrieves the CSRF token from the `x-csrf-token` cookie
2. Send the token in the `x-csrf-token` header on all mutating requests
3. CSRF cookies are `secure: true` in production — ensure connections use HTTPS
4. Cookie `sameSite: 'strict'` — must originate from the same site

## Quick Troubleshooting Flow

```
Problem → Check → Solution
─────────────────────────────────────────────
Login fails     → DB: lock_until, is_active     → Unlock / reactivate user
WebSocket down  → Docker: container running     → Restart backend
SLA wrong       → DB: sla_deadline calculation  → Check priority modifier
Upload fails    → File: magic bytes             → Verify file type
Permission err  → DB: user_permission_overrides  → Grant via admin panel
Export fails    → Disk: /uploads/exports/ space → Clean old exports
Missing text    → DB: lang_pref, translations   → Update language pref
CORS errors     → Env: FRONTEND_URL             → Set CORS origin
RTL broken      → HTML: dir="rtl" attribute     → Check i18next config
```