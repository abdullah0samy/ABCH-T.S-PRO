# Master Production Fix: Urgent CSRF Login Fix, Transparent Vector ABCH Logo, Legacy DB Migration Helper & Full UI/Logic Polish (`abdullah0samy/ABCH-T.S-PRO`)

You are an autonomous Principal Full-Stack Architect & Lead Product Designer (NestJS 11 + Prisma 6 + PostgreSQL + Redis/BullMQ + Socket.IO + React 19 + TypeScript + Tailwind CSS v4). Execute all phases below on `abdullah0samy/ABCH-T.S-PRO`, verify that both `backend` and `frontend` build with zero errors (`npm run build`), and push directly to `origin main`.

## Phase 0 (URGENT BLOCKER): Fix `403 Invalid or missing CSRF token` on Login & Remove Black Box Around Logo

### 0.1 Replace Broken `csrf-csrf` Dual-Cookie Middleware in `backend/src/main.ts`
- **File**: `backend/src/main.ts`
- **Root Cause of Production Login Failure**:
  1. `csrf-csrf` v3 stores `<token>|<hash>` in an `httpOnly` cookie named `csrf-internal` and expects the bare `<token>` in `x-csrf-token`.
  2. In `csrf-csrf@3.2.2`, `generateToken(req, res)` defaults to `overwrite = false, validateOnReuse = true`. Whenever a browser holds a stale `csrf-internal` cookie (from a previous container deploy, secret change, or IP change behind Cloudflare/Traefik), `GET /api/health` either fails to overwrite `csrf-internal` or leaves `csrf-internal` and `x-csrf-token` out of sync. As a result, `POST /api/auth/login` permanently fails with `403 Invalid or missing CSRF token. Reload the page and try again.` even after `/api/health` is called!
- **Required Fix in `backend/src/main.ts`**:
  1. Remove `import { doubleCsrf } from 'csrf-csrf';` from `backend/src/main.ts`.
  2. Set `app.getHttpAdapter().getInstance().set('trust proxy', 1);` right after `const app = await NestFactory.create(AppModule);`.
  3. Replace the entire `doubleCsrf` block in `backend/src/main.ts` with a deterministic, self-healing **Single-Cookie HMAC CSRF Middleware** using Node's built-in `crypto` module that:
     - Automatically clears any legacy `csrf-internal` cookie (`if (req.cookies?.['csrf-internal']) res.clearCookie('csrf-internal', { path: '/' });`).
     - Signs tokens with `crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex')` stored directly in the readable `x-csrf-token` cookie (`${nonce}.${ mac }`) so there is **only one cookie** and it can **never** get out of sync with an `httpOnly` shadow cookie!
     - Always issues a fresh `x-csrf-token` cookie on `GET /api/health` or whenever the existing `x-csrf-token` cookie is missing or has an invalid HMAC signature.
     - Exempts `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, and `/api/health` from CSRF rejection (since `/api/auth/login` is pre-session and already protected by strict CORS `FRONTEND_URL`, `Content-Type: application/json`, `@Throttle({ login: {} })`, and 5-attempt account lockout, and `/api/auth/refresh` uses an `httpOnly`, `sameSite: 'strict'` cookie).
     - Here is the exact code to put in `backend/src/main.ts`:
       ```ts
       const expressApp = app.getHttpAdapter().getInstance();
       expressApp.set('trust proxy', 1);

       const signCsrfToken = (nonce: string): string => {
         const mac = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
         return `${nonce}.${mac}`;
       };

       const verifyCsrfToken = (token: string | undefined): boolean => {
         if (!token || typeof token !== 'string') return false;
         const parts = token.split('.');
         if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
         const expected = crypto.createHmac('sha256', CSRF_SECRET).update(parts[0]).digest('hex');
         try {
           return crypto.timingSafeEqual(Buffer.from(parts[1], 'utf8'), Buffer.from(expected, 'utf8'));
         } catch {
           return false;
         }
       };

       const setFreshCsrfCookie = (res: express.Response): string => {
         const token = signCsrfToken(crypto.randomBytes(32).toString('hex'));
         res.cookie('x-csrf-token', token, {
           sameSite: 'lax',
           secure: process.env.NODE_ENV === 'production',
           path: '/',
           httpOnly: false,
         });
         return token;
       };

       const CSRF_EXEMPT_PATHS = new Set([
         '/api/health',
         '/api/auth/login',
         '/api/auth/refresh',
         '/api/auth/logout',
       ]);

       app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
         // Clean up legacy csrf-csrf shadow cookie if present in browser
         if (req.cookies?.['csrf-internal']) {
           res.clearCookie('csrf-internal', { path: '/' });
         }

         const cleanPath = (req.originalUrl || req.url || '').split('?')[0];
         const cookieToken = req.cookies?.['x-csrf-token'] as string | undefined;
         const isCookieValid = verifyCsrfToken(cookieToken);

         if (cleanPath === '/api/health' || !isCookieValid) {
           setFreshCsrfCookie(res);
         }

         const method = req.method.toUpperCase();
         if (['GET', 'HEAD', 'OPTIONS'].includes(method) || CSRF_EXEMPT_PATHS.has(cleanPath)) {
           return next();
         }

         const headerToken = req.headers['x-csrf-token'] as string | undefined;
         if (!headerToken || !isCookieValid || headerToken !== cookieToken) {
           setFreshCsrfCookie(res);
           return res.status(403).json({
             message: 'Invalid or missing CSRF token. Please try again.',
             code: 'CSRF_INVALID',
           });
         }

         return next();
       });
       ```

### 0.2 Remove the Black Box Around the Logo & Make the Transparent Vector `ABCH` Logo Crisp (`logo.svg`, `Login.tsx`, `App.tsx`, `index.css`)
- **Files**:
  - `frontend/public/logo.svg`
  - `frontend/src/pages/Login.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/index.css`
- **Problem**:
  1. Adding a dark square box (`.logo-badge` / `bg-[#0F172A]`) around the logo in `Login.tsx` and `App.tsx` looks like an ugly black square icon on the white login card (`image_711455.png`).
  2. The user wants the **transparent ABCH logo itself** (with **NO background box at all**) to sit cleanly and prominently on the card and sidebar.
  3. In `frontend/public/logo.svg`, `<svg width="859" height="488">` is missing `viewBox="0 0 859 488"`, and its silver paths (`fill="#C3C5C7"`) are too light on a white background.
- **Required Fix**:
  1. **In `frontend/src/index.css`**: Remove `.logo-badge` completely so no black background box is ever rendered around the logo.
  2. **In `frontend/public/logo.svg`**:
     - Add `viewBox="0 0 859 488"` to the root `<svg>` element:
       `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 859 488" width="100%" height="100%">`
     - Replace all occurrences of `fill="#C3C5C7"` in `frontend/public/logo.svg` (and root `ABC-Logo.svg`) with `fill="#334155"` (Executive Slate 700 — which gives high contrast for the `[H]` badge and `ABC HOSPITAL` text on white backgrounds AND remains clearly visible on dark backgrounds, while keeping the white `H` `fill="#FEFEFE"` crisp inside the `#334155` badge!).
     - Replace the pale gold fills (`#DDB080`, `#E0B583`, `#D8AA7B`, `#DDB180`, `#E2B886`) with richer warm metallic gold tones (`#C88A4B`, `#CFA065`, `#B87B3E`, `#C48849`, `#D49B5E`) so `A B C` looks vibrant and sharp on white.
  3. **In `frontend/src/pages/Login.tsx`**:
     - Remove `.logo-badge` / any dark background class around the logo.
     - Render `<img src="/logo.svg" alt="ABCH Logo" className="w-44 sm:w-52 h-auto object-contain mx-auto mb-6 select-none" />` directly with no background box!
     - On the error banner in `Login.tsx`, add `dir="auto"` to the message `<span dir="auto">{error}</span>` so English punctuation (like the period in `.try again`) never flips to the right side in RTL mode!
  4. **In `frontend/src/App.tsx` (Sidebar Header)**:
     - Remove `.logo-badge` / any dark background box around the sidebar logo.
     - Render `<img src="/logo.svg" alt="ABCH Logo" className="h-9 w-auto object-contain shrink-0 select-none" />` cleanly next to the title.

### 0.3 Add Legacy Database Upgrade Script (`backend/scripts/upgrade-legacy-db.ts`) for Smooth SQL Dump Migration
- **Files**:
  - `backend/scripts/upgrade-legacy-db.ts` (new file)
  - `backend/package.json`
- **Purpose**: The user is restoring a production PostgreSQL dump (`abc_2026-10-31_02-00.sql.gz`) into the Coolify PostgreSQL database. An older dump may have `VARCHAR`/`TEXT` columns where the current Prisma schema expects native PostgreSQL enums (`ticket_status`, `ticket_priority`, `user_role`, `dept_type_enum`, `holding_status_enum`) or `TEXT` for `related_tickets` / `allowed_transfer_dept_ids` instead of `JSONB`.
- **Required Fix**:
  1. Create `backend/scripts/upgrade-legacy-db.ts` using `@prisma/client` (`prisma.$executeRawUnsafe`) that safely and idempotently:
     - Creates the PostgreSQL enum types (`ticket_status`, `ticket_priority`, `user_role`, `dept_type_enum`, `holding_status_enum`, `SubscriptionStatus`, `BillingCycle`, `InvoiceStatus`) inside `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` blocks.
     - Normalizes any legacy role values in `users.role` (e.g., `'admin'` -> `'super_admin'`, `'dept_manager'` -> `'supervisor'`) before casting `users.role` to `user_role` enum if it is still `text`/`varchar`.
     - Safely converts `tickets.status`, `tickets.priority`, `tickets.holding_status`, and `departments.dept_type` from `text`/`varchar` to their enum types if they are not already enums.
     - Safely converts `tickets.related_tickets` and `user_permission_overrides.allowed_transfer_dept_ids` from `text` to `jsonb` (`USING CASE WHEN related_tickets IS NULL OR related_tickets = '' THEN '[]'::jsonb ELSE related_tickets::jsonb END`) if they are still `text`.
     - Ensures all `users` with `badge_number` / `username` are active and resets any expired `lock_until`.
  2. Add `"db:upgrade": "tsx scripts/upgrade-legacy-db.ts && npx prisma db push"` to `scripts` in `backend/package.json`.

## Phase 1: Ensure All P0 Runtime Crashes & Workflow Fixes Are Intact

1. **`UserManagementPage.tsx`**:
   - Ensure no reference to undefined `roles` exists.
   - Ensure all 13 permission flags from `DeptPermissions` are configurable in the Permissions Override tab.
   - Ensure `handleSubmit` sanitizes the payload (`badgeNumber`, `username`, `fullNameAr`, `fullNameEn`, `email`, `role`, `departmentId`, `isActive`, `permissionsOverride`) before sending to `POST`/`PUT /api/admin/users`.
2. **`backend/src/common/schemas/users.schema.ts`**:
   - Ensure `badgeNumber` and `username` accept alphanumeric identifiers (`/^[a-zA-Z0-9_.-]+$/`) rather than digits-only (`/^\d+$/`).
   - Preprocess empty string `""` on `email` and `fullNameEn` to `null`.
3. **`InboxPage.tsx` Bulk Actions**:
   - Ensure `handleBulkAssign` and `handleBulkArchive` use `apiFetch` (never raw `fetch`).
4. **`AnalyticsPage.tsx` Export**:
   - Ensure Excel export uses `apiDownload('/api/analytics/export')` (never `await response.blob()` on `apiFetch`).
5. **`AdminUsersController.findAll` (`GET /api/admin/users`)**:
   - Allow `@Roles('super_admin', 'supervisor', 'agent')`, scoping non-`super_admin` callers to active users in their own department (`departmentId: req.user.departmentId ?? -1`), and always strip `passwordHash`.
6. **`TicketDetailsPage.tsx` & `NewTicketPage.tsx`**:
   - Ensure `isAgent` checks `user?.role === 'super_admin' || ((user?.role === 'supervisor' || user?.role === 'agent') && Number(ticket.departmentId) === Number(userDeptId))`.
   - Ensure the **Confirm Resolution** (`تأكيد الحل`) and **Reopen Ticket** (`إعادة فتح التذكرة`) buttons appear for the ticket creator whenever `ticket.status === 'resolved' && Number(ticket.createdById) === Number(user?.id)`.
   - Redirect `end_user` after creating a ticket to `/tickets/${data.id}` (not `/inbox`).

## Phase 2: Complete Business Logic, Security & Hospital Features

1. **Transfer Allowlist (`DeptTransferAllowlist`) & Department Management**:
   - In `TicketsService.transfer()`, only enforce `deptTransferAllowlist` for a source department if at least 1 active allowlist rule is configured for that source department (`configuredRulesCount > 0`); otherwise allow transferring to any active `RECEIVER_ONLY` or `BOTH` department.
   - In `AdminDepartmentsController.findAll()`, filter `where: { deletedAt: null }`.
   - In `DepartmentsPage.tsx`, include `slaHours` input, allowed transfer targets selection, and a Deactivate/Delete button.
2. **Internal Note Privacy (`internal_note`)**:
   - In `TicketsService.findById()`, filter out `messageType === 'internal_note'` when the requester is not a department agent/supervisor or `super_admin`.
   - In `TicketsService.addComment()`, never emit `new-comment` WebSocket events for `internal_note` messages to `end_user` creators.
3. **Healthcheck HTTP 503**:
   - In `HealthController.check()`, throw `ServiceUnavailableException` (HTTP `503`) if `SELECT 1` fails.
4. **Self-Service Password Change (`UserProfilePage.tsx`)**:
   - Ensure `UserProfilePage.tsx` includes the Change Password card wired to `POST /api/profile/password` and `App.tsx` shows a banner when `user.forcePasswordChange` is `true`.
5. **Persistent Notifications & Print Work Order**:
   - Ensure `TicketsService` creates `prisma.notification` rows on assignment, status change, and public comments, and `NotificationProvider.tsx` loads `GET /api/notifications` and syncs read status.
   - Ensure `TicketDetailsPage.tsx` has a Print Work Order (`window.print()`) button styled with `@media print` in `index.css`.

## Phase 3: Multi-Screen Responsiveness & RTL Polish

1. **Mobile Sidebar State (`App.tsx` & `index.css`)**:
   - Ensure `handleResize` in `App.tsx` sets `if (window.innerWidth >= 1024) setSidebarOpen(false);` so resizing or rotating a tablet never pops open the mobile overlay.
   - Ensure `@media (max-width: 1023.98px)` is used in `index.css`.
2. **Touch-Device Action Buttons**:
   - Ensure Edit/Delete action buttons across admin and KB cards use `opacity-100 lg:opacity-0 lg:group-hover:opacity-100` so they are always accessible on phones and tablets.
3. **RTL Alignment & Logical Properties**:
   - Ensure all tables use `text-start` / `text-end`, search inputs use `start-3` / `ps-10`, sidebar uses `border-e`, and `translations.ts` has zero corrupted characters.

## Phase 4: Verification & Git Push

1. Run `cd backend && npx prisma generate && npm run build` and verify zero errors.
2. Run `cd frontend && npm run type-check && npm run build` and verify zero errors.
3. Stage all changes (`git add -A`), commit with:
   `fix: replace csrf-csrf with self-healing HMAC CSRF, render transparent vector ABCH logo, and add legacy DB upgrade script`
4. Push directly to `origin main`.
