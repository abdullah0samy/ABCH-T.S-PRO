# Definitive Production Upgrade: Fix `Cannot POST /auth/login` (Traefik Prefix Normalization), Self-Healing CSRF, Bilingual Error System, Transparent Vector ABCH Logo & Full Logic/UI Polish (`abdullah0samy/ABCH-T.S-PRO`)

You are an autonomous Principal Full-Stack Architect & Lead Product Designer (NestJS 11 + Prisma 6 + PostgreSQL + Redis/BullMQ + Socket.IO + React 19 + TypeScript + Tailwind CSS v4). Execute all phases below on `abdullah0samy/ABCH-T.S-PRO`, verify that both `backend` and `frontend` compile cleanly (`npm run build`), and push directly to `origin main`.

## Phase 0 (CRITICAL PRODUCTION BLOCKERS): Fix `Cannot POST /auth/login`, Fix `403 CSRF`, Auto-Ensure Admin Credentials (`00001` / `admin`), & Transparent Vector Logo

### 0.1 Fix `Cannot POST /auth/login` via Reverse-Proxy Path Normalization in `backend/src/main.ts`
- **File**: `backend/src/main.ts`
- **Root Cause**:
  On Coolify v4, when the Backend service is mapped to path-based domains (`https://ticket-crm.abchospitaleg.com/api` and `https://ticket-crm.abchospitaleg.com/uploads`), Coolify's Traefik proxy applies a `StripPrefix` middleware by default. When the browser sends `POST /api/auth/login` or `GET /api/health`, Traefik strips `/api` and forwards `POST /auth/login` or `GET /health` to the NestJS container. Because NestJS controllers are decorated with `@Controller('api/...')`, NestJS rejects the stripped path with `404 Cannot POST /auth/login`! Similarly, when Traefik strips `/uploads` from `GET /uploads/avatars/x.png`, the backend receives `GET /avatars/x.png`.
- **Required Fix in `backend/src/main.ts`**:
  1. Mount `express.static` for both prefixed and stripped upload paths:
     ```ts
     app.use('/uploads', express.static(UPLOADS_DIR));
     app.use('/avatars', express.static(AVATARS_DIR));
     app.use('/exports', express.static(EXPORTS_DIR));
     ```
  2. Immediately after `app.use(cookieParser());` (and **before** CSRF middleware and NestJS controllers), add this **Reverse-Proxy Path Normalization Middleware** so the backend seamlessly accepts requests whether Traefik strips `/api` or keeps `/api`:
     ```ts
     const API_SUBPATHS = [
       '/health',
       '/auth',
       '/tickets',
       '/users',
       '/admin',
       '/analytics',
       '/assets',
       '/audit',
       '/knowledge',
       '/notifications',
       '/profile',
       '/team-notes',
       '/uploads',
       '/docs',
     ];

     app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
       const urlPath = (req.url || '').split('?')[0];
       if (!urlPath.startsWith('/api/') && urlPath !== '/api') {
         const matchesApiSubpath = API_SUBPATHS.some(
           (prefix) => urlPath === prefix || urlPath.startsWith(`${prefix}/`),
         );
         if (matchesApiSubpath) {
           // Static file GETs under /uploads/... are already served above; only rewrite /uploads if it's POST or /uploads/download/...
           const isStaticUploadGet =
             urlPath.startsWith('/uploads/') &&
             req.method === 'GET' &&
             !urlPath.startsWith('/uploads/download/');
           if (!isStaticUploadGet) {
             req.url = `/api${req.url}`;
             if ((req as any).originalUrl && !(req as any).originalUrl.startsWith('/api')) {
               (req as any).originalUrl = `/api${(req as any).originalUrl}`;
             }
           }
         }
       }
       next();
     });
     ```

### 0.2 Replace Fragile `csrf-csrf` Dual-Cookie Middleware with Self-Healing Single-Cookie HMAC CSRF (`backend/src/main.ts`)
- **File**: `backend/src/main.ts`
- **Root Cause**: `csrf-csrf@3.2.2` uses an `httpOnly` `csrf-internal` cookie (`<token>|<hash>`) plus a readable `x-csrf-token` cookie, and `generateToken(req, res)` defaults to `overwrite = false`, which refuses to overwrite stale cookies after a redeploy or IP change.
- **Required Fix in `backend/src/main.ts`**:
  Replace `doubleCsrf` completely with this self-healing HMAC CSRF middleware right after the Path Normalization Middleware:
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
    if (req.cookies?.['csrf-internal']) {
      res.clearCookie('csrf-internal', { path: '/' });
    }

    const cleanPath = (req.url || '').split('?')[0];
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

### 0.3 Auto-Ensure Default Super Admin (`00001` / `admin`, Password `Admin@123`) & Update `seed-local.ts`
- **Files**:
  - `backend/prisma/seed-local.ts`
  - `backend/prisma/seed.ts`
  - `backend/src/modules/auth/auth.service.ts`
- **Problem**:
  The login screen placeholder says `00000` / `00001`, so the user enters `00001` or `admin` with password `Admin@123`. In `seed-local.ts`, the Super Admin has `badgeNumber: 'admin', username: 'admin'`, so typing `00001` fails with `Invalid credentials`, or if the production DB is empty before migration, no user exists yet!
- **Required Fix**:
  1. In `backend/prisma/seed-local.ts` and `backend/prisma/seed.ts`, set the Super Admin's `badgeNumber: '00001'` and `username: 'admin'` (and Supervisor `badgeNumber: '00002'`, `username: 'supervisor'`; Agent `badgeNumber: '00003'`, `username: 'agent'`; End User `badgeNumber: '00004'`, `username: 'user'`) so logging in with **either** `00001` **or** `admin` and password `Admin@123` works!
  2. In `AuthService` (`backend/src/modules/auth/auth.service.ts`), implement `OnModuleInit`: on startup, check `const userCount = await this.prisma.user.count();`. If `userCount === 0` (fresh unseeded database), automatically create the default `DeptPermissions`, default `Information Technology` department, and the initial Super Admin account (`badgeNumber: '00001'`, `username: 'admin'`, password `'Admin@123'`, `role: 'super_admin'`, `isActive: true`) so a fresh Coolify deployment can ALWAYS log in immediately with `00001` or `admin` and `Admin@123`!

### 0.4 Remove the Black Box Around the Logo & Render the Transparent Vector `ABCH` Logo (`logo.svg`, `Login.tsx`, `App.tsx`, `index.css`)
- **Files**:
  - `frontend/public/logo.svg`
  - `ABC-Logo.svg`
  - `frontend/src/pages/Login.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/index.css`
- **Problem**: Putting a dark black square (`.logo-badge` / `bg-[#0F172A]`) behind `logo.png` in `Login.tsx` looks bad on the white card. The logo must be **100% transparent** (no box behind it!) with crisp vector colors.
- **Required Fix**:
  1. Remove `.logo-badge` from `frontend/src/index.css`, `Login.tsx`, and `App.tsx`.
  2. In `frontend/public/logo.svg` (and `ABC-Logo.svg`):
     - Add `viewBox="0 0 859 488"` to `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 859 488" width="859" height="488">`.
     - Replace all `fill="#C3C5C7"` with `fill="#334155"` (Deep Slate 700, so the `[H]` badge and `ABC HOSPITAL` text have strong contrast on white cards and remain visible on dark cards, while the white `H` `fill="#FEFEFE"` pops inside the `#334155` badge).
     - Replace the pale gold fills (`#DDB080`, `#E0B583`, `#D8AA7B`, `#DDB180`, `#E2B886`) with rich metallic gold (`#C88A4B`, `#CFA065`, `#B87B3E`, `#C48849`, `#D49B5E`).
  3. In `frontend/src/pages/Login.tsx`:
     - Render `<img src="/logo.svg" alt="ABCH Logo" className="w-44 sm:w-52 h-auto object-contain mx-auto mb-6 select-none" />` directly on the transparent card with **zero background box**!
  4. In `frontend/src/App.tsx`:
     - Render `<img src="/logo.svg" alt="ABCH Logo" className="h-9 w-auto object-contain shrink-0 select-none" />` in the sidebar header with **zero background box**!

## Phase 1: Comprehensive Error Message Localization & Validation Polish Across the Entire System

### 1.1 Human-Readable Validation & Exception Messages in Backend (`zod-validation.pipe.ts` & `global-exception.filter.ts`)
- **Files**:
  - `backend/src/common/pipes/zod-validation.pipe.ts`
  - `backend/src/common/filters/global-exception.filter.ts`
- **Problem**:
  1. `ZodValidationPipe` throws `{ message: 'Validation failed', errors: [...] }`. Because the frontend displays `error.message`, users only see generic `"Validation failed"` instead of the actual field error (e.g., `"Password must be at least 12 characters"`).
  2. `GlobalExceptionFilter` passes raw Express `Cannot POST /...` or `Cannot GET /...` strings through to the UI.
- **Required Fix**:
  1. In `backend/src/common/pipes/zod-validation.pipe.ts`:
     ```ts
     const issues = result.error.issues.map((err) => ({
       path: err.path.join('.'),
       message: err.message,
     }));
     const summaryMessage = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(' • ');
     throw new BadRequestException({
       code: 'VALIDATION_ERROR',
       message: summaryMessage || 'Validation failed',
       errors: issues,
     });
     ```
  2. In `backend/src/common/filters/global-exception.filter.ts`:
     - When `status === HttpStatus.NOT_FOUND && /^Cannot (GET|POST|PUT|DELETE|PATCH)/i.test(message)`, set `code = 'ENDPOINT_NOT_FOUND'` and `message = 'The requested service endpoint was not found.'`.

### 1.2 Bilingual Error Translator (`localizeErrorMessage`) in `frontend/src/core/api.ts` & `useAuth.ts`
- **Files**:
  - `frontend/src/core/api.ts`
  - `frontend/src/core/hooks/useAuth.ts`
  - `frontend/src/components/ErrorBanner.tsx`
  - `frontend/src/pages/Login.tsx`
- **Problem**: All backend error messages (`Invalid credentials`, `Account locked`, `You do not have permission...`, `A ticket must be assigned to an agent...`, `Invalid or missing CSRF token...`) are displayed in raw English even when the user's interface is in Arabic (`language === 'ar'`), and English punctuation at the end of RTL lines flips to the right (`.try again`).
- **Required Fix**:
  1. Create an exported helper `localizeErrorMessage(rawMessage?: string, code?: string): string` in `frontend/src/core/api.ts` that reads `useSettingsStore.getState().language` (`'ar'` or `'en'`) and translates known error codes and patterns into clear, professional Arabic (when `ar`) and English (when `en`):
     - `Invalid credentials` / `Invalid credentials or inactive account` -> AR: `'بيانات الدخول غير صحيحة أو الحساب غير نشط. تأكد من رقم البصمة/اسم المستخدم وكلمة المرور.'` / EN: `'Invalid username/badge number or password.'`
     - `Invalid identifier format` -> AR: `'صيغة رقم البصمة أو اسم المستخدم غير صحيحة.'`
     - `Account locked` / `423` -> AR: `'تم قفل الحساب مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار 15 دقيقة.'`
     - `CSRF_INVALID` / `csrf` -> AR: `'انتهت صلاحية رمز الأمان للصفحة. يرجى المحاولة مرة أخرى.'`
     - `SESSION_EXPIRED` / `MISSING_TOKEN` -> AR: `'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.'`
     - `ACCOUNT_INACTIVE` -> AR: `'هذا الحساب غير نشط حالياً. تواصل مع إدارة تقنية المعلومات.'`
     - `FORBIDDEN` / `Insufficient permissions` -> AR: `'ليس لديك صلاحية لتنفيذ هذا الإجراء.'`
     - `ASSIGNMENT_REQUIRED` / `must be assigned to an agent` -> AR: `'يجب تعيين التذكرة لموظف أولاً قبل تحويلها إلى (تم الحل).'`
     - `ISSUE_TYPE_REQUIRED` / `Issue Type must be selected` -> AR: `'يجب تحديد (نوع المشكلة) أولاً قبل حل أو إغلاق التذكرة.'`
     - `INVALID_TRANSITION` -> AR: `'لا يمكن تغيير حالة التذكرة إلى هذه الحالة مباشرة.'`
     - `REOPEN_FORBIDDEN` -> AR: `'مدير النظام العام فقط يمكنه إعادة فتح التذاكر المغلقة نهائياً.'`
     - `TRANSFER_NOT_ALLOWED` -> AR: `'غير مسموح بتحويل التذاكر إلى هذا القسم حسب إعدادات الصلاحيات.'`
     - `CROSS_DEPT_FORBIDDEN` -> AR: `'يمكنك إنشاء تذاكر لقسمك فقط.'`
     - `FLOOR_BUILDING_MISMATCH` -> AR: `'الطابق المختار لا يتبع المبنى المحدد.'`
     - `EXPORT_FORBIDDEN` -> AR: `'ليس لديك صلاحية تصدير البيانات والتقارير.'`
     - `ANALYTICS_FORBIDDEN` -> AR: `'ليس لديك صلاحية عرض صفحة التحليلات.'`
     - `Unique constraint violation` / `already exists` -> AR: `'هذه البيانات مسجلة بالفعل (قيمة مكررة).'`
     - `Cannot POST` / `Cannot GET` / `ENDPOINT_NOT_FOUND` -> AR: `'تعذر الوصول إلى مسار الخدمة المطلوب على الخادم.'`
     - `Failed to fetch` / `NetworkError` -> AR: `'تعذر الاتصال بالخادم. تحقق من اتصال الشبكة وحاول مرة أخرى.'`
  2. Apply `localizeErrorMessage(data?.message, data?.code)` inside `apiFetch` (in `frontend/src/core/api.ts`) and inside `useLogin` (in `frontend/src/core/hooks/useAuth.ts`) before throwing errors!
  3. In `ErrorBanner.tsx` and `Login.tsx`, add `dir="auto"` to the `<span>` rendering the error text so punctuation never flips to the wrong side.

## Phase 2: Complete All Business Logic, RBAC, Migration & UI/Responsiveness Requirements

1. **Legacy Database Upgrade Script (`backend/scripts/upgrade-legacy-db.ts` & `backend/package.json`)**:
   - Ensure `backend/scripts/upgrade-legacy-db.ts` exists and `"db:upgrade": "tsx scripts/upgrade-legacy-db.ts && npx prisma db push"` is in `backend/package.json` so restoring `abc_2026-10-31_02-00.sql.gz` upgrades enums/JSONB cleanly.
2. **User Management & Validation (`UserManagementPage.tsx` & `users.schema.ts`)**:
   - No reference to undefined `roles` in `UserManagementPage.tsx`.
   - Payload sanitized in `handleSubmit`.
   - `users.schema.ts` allows alphanumeric `badgeNumber` and `username` (`/^[a-zA-Z0-9_.-]+$/`) and preprocesses empty `email` / `fullNameEn` strings to `null`.
3. **Inbox Bulk Actions & Analytics Export**:
   - `InboxPage.tsx` uses `apiFetch` for both `handleBulkAssign` and `handleBulkArchive`.
   - `AnalyticsPage.tsx` uses `apiDownload('/api/analytics/export')`.
4. **Agent Assignment Dropdown & Ticket Lifecycle (`AdminUsersController`, `TicketDetailsPage`, `NewTicketPage`, `TicketsService`)**:
   - `AdminUsersController.findAll` allows `@Roles('super_admin', 'supervisor', 'agent')`, scoped to department for non-`super_admin`, stripping `passwordHash`.
   - `TicketDetailsPage.tsx` computes `isAgent` accurately (excluding `end_user`), shows **Confirm Resolution** (`تأكيد الحل`) and **Reopen Ticket** (`إعادة فتح التذكرة`) to the ticket creator whenever `ticket.status === 'resolved'`, supports unassigning (`agentId: null`), and includes a **Print Work Order (`طباعة`)** button.
   - `TicketsService.transfer()` allows transfers to any active `RECEIVER_ONLY` / `BOTH` department when no `deptTransferAllowlist` rules are configured for the source department, and enforces the allowlist when rules are configured.
   - `TicketsService.findById()` and `addComment()` keep `internal_note` messages strictly private from `end_user`.
5. **Profile Password Change, Persistent Notifications, & Multi-Screen RTL Responsiveness**:
   - `UserProfilePage.tsx` includes the Change Password card (`POST /api/profile/password`).
   - `NotificationProvider.tsx` loads persistent notifications from `GET /api/notifications`, marks them read in DB, and plays a subtle Web Audio chime on live events.
   - Mobile sidebar state in `App.tsx` resets cleanly (`if (window.innerWidth >= 1024) setSidebarOpen(false)`), action buttons are visible on touch devices (`opacity-100 lg:opacity-0 lg:group-hover:opacity-100`), and tables/inputs use RTL-safe logical properties (`text-start`, `ps-10`, `border-e`).

## Phase 3: Verification & Git Push

1. Run `cd backend && npx prisma generate && npm run build` and verify zero errors.
2. Run `cd frontend && npm run type-check && npm run build` and verify zero errors.
3. Commit all changes (`git add -A && git commit -m "fix: normalize reverse-proxy /api paths, self-healing CSRF, bilingual error messages, transparent vector logo, and default admin bootstrap"`) and push to `origin main`.
