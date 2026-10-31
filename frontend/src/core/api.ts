import { useAuthStore, getAccessToken, refreshAccessToken } from '../store/authStore.ts';
import { useSettingsStore } from '../store/settingsStore.ts';
import { queryClient } from '../main.tsx';

export function localizeErrorMessage(rawMessage?: string, code?: string): string {
  const lang = useSettingsStore.getState().language || 'ar';
  const msg = (rawMessage || '').trim();
  const c = (code || '').toUpperCase();

  if (lang === 'ar') {
    if (/invalid credentials/i.test(msg)) {
      return 'بيانات الدخول غير صحيحة أو الحساب غير نشط. تأكد من رقم البصمة/اسم المستخدم وكلمة المرور.';
    }
    if (/invalid identifier format/i.test(msg)) {
      return 'صيغة رقم البصمة أو اسم المستخدم غير صحيحة.';
    }
    if (/account locked/i.test(msg) || c === '423') {
      return 'تم قفل الحساب مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار 15 دقيقة.';
    }
    if (c === 'CSRF_INVALID' || /csrf/i.test(msg)) {
      return 'انتهت صلاحية رمز الأمان للصفحة. يرجى المحاولة مرة أخرى.';
    }
    if (c === 'SESSION_EXPIRED' || c === 'MISSING_TOKEN' || /session expired|authentication required|invalid or expired token/i.test(msg)) {
      return 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.';
    }
    if (c === 'ACCOUNT_INACTIVE' || /account is deactivated/i.test(msg)) {
      return 'هذا الحساب غير نشط حالياً. تواصل مع إدارة تقنية المعلومات.';
    }
    if (c === 'ASSIGNMENT_REQUIRED' || /must be assigned to an agent/i.test(msg)) {
      return 'يجب تعيين التذكرة لموظف أولاً قبل تحويلها إلى (تم الحل).';
    }
    if (c === 'ISSUE_TYPE_REQUIRED' || /issue type must be selected/i.test(msg)) {
      return 'يجب تحديد (نوع المشكلة) أولاً قبل حل أو إغلاق التذكرة.';
    }
    if (c === 'INVALID_TRANSITION' || /cannot transition ticket/i.test(msg)) {
      return 'لا يمكن تغيير حالة التذكرة إلى هذه الحالة مباشرة.';
    }
    if (c === 'REOPEN_FORBIDDEN' || /only a super admin may reopen/i.test(msg)) {
      return 'مدير النظام العام فقط يمكنه إعادة فتح التذاكر المغلقة نهائياً.';
    }
    if (c === 'TRANSFER_NOT_ALLOWED' || /transfers from your department to this department are not permitted|target department cannot receive/i.test(msg)) {
      return 'غير مسموح بتحويل التذاكر إلى هذا القسم حسب إعدادات الصلاحيات.';
    }
    if (c === 'CROSS_DEPT_FORBIDDEN' || /only create tickets for your own department/i.test(msg)) {
      return 'يمكنك إنشاء تذاكر لقسمك فقط.';
    }
    if (c === 'FLOOR_BUILDING_MISMATCH' || /selected floor does not belong/i.test(msg)) {
      return 'الطابق المختار لا يتبع المبنى المحدد.';
    }
    if (c === 'EXPORT_FORBIDDEN' || /permission to export/i.test(msg)) {
      return 'ليس لديك صلاحية تصدير البيانات والتقارير.';
    }
    if (c === 'ANALYTICS_FORBIDDEN' || /permission to view analytics/i.test(msg)) {
      return 'ليس لديك صلاحية عرض صفحة التحليلات.';
    }
    if (/unique constraint violation|already exists/i.test(msg)) {
      return 'هذه البيانات مسجلة بالفعل (قيمة مكررة).';
    }
    if (c === 'ENDPOINT_NOT_FOUND' || /^cannot (get|post|put|delete|patch)/i.test(msg) || /service endpoint was not found/i.test(msg)) {
      return 'تعذر الوصول إلى مسار الخدمة المطلوب على الخادم.';
    }
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return 'تعذر الاتصال بالخادم. تحقق من اتصال الشبكة وحاول مرة أخرى.';
    }
    if (c === 'FORBIDDEN' || /insufficient permissions|do not have permission|access denied/i.test(msg)) {
      return 'ليس لديك صلاحية لتنفيذ هذا الإجراء.';
    }
  } else {
    if (/invalid credentials/i.test(msg)) {
      return 'Invalid username/badge number or password.';
    }
    if (c === 'ENDPOINT_NOT_FOUND' || /^cannot (get|post|put|delete|patch)/i.test(msg)) {
      return 'The requested service endpoint was not found.';
    }
  }

  return msg || (lang === 'ar' ? 'حدث خطأ غير متوقع.' : 'An unexpected error occurred.');
}

const API_BASE = (import.meta.env.VITE_API_BASE as string) || '';

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

// List endpoints return either a bare array or a paginated envelope { data, total, page, limit }.
// asList() normalizes both to a plain array so components can .map()/.filter() safely.
export function asList<T = any>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && Array.isArray(res.data)) return res.data as T[];
  return [];
}

export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)x-csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Prime the CSRF cookie with a safe GET before the first state-changing request.
 * In dev the SPA and API are on different origins/ports, so no CSRF cookie
 * exists until we touch the API at least once.
 *
 * `force` re-primes even when a cookie is already present. That matters after
 * the API restarts: the browser still holds a token signed with the previous
 * secret, so every POST is rejected — and because this used to return early
 * whenever *any* token existed, the stale one was never replaced and the user
 * was stuck on "login failed" until they cleared cookies by hand.
 */
export async function ensureCsrfToken(force = false): Promise<void> {
  if (!force && getCsrfToken()) return;
  try {
    await fetch(apiUrl('/api/health'), { credentials: 'include', cache: 'no-store' });
  } catch {
    /* ignore — the caller surfaces a clearer error if the API is unreachable */
  }
}

/** True when a failed response is the CSRF guard rejecting a stale token. */
export function isCsrfRejection(status: number, message?: string): boolean {
  return status === 403 && /csrf/i.test(message || '');
}

// ---------------------------------------------------------------------------
// apiFetch — the single HTTP gateway for the entire frontend.
//
// 401 handling (session expired / token invalid):
//   1. Attempt a silent token refresh via the httpOnly refresh cookie.
//   2. If refresh succeeds, replay the original request once with the new token.
//   3. If refresh fails (cookie expired / server error), force-logout.
//
// 403 handling (permission denied):
//   The user IS authenticated; they just don't have access to this specific
//   resource. We surface the error and keep the session alive — we do NOT
//   log them out. This was the root cause of the "Archive click = full logout"
//   bug described in the engineering review (Finding #6).
// ---------------------------------------------------------------------------
export async function apiFetch(url: string, options: RequestInit = {}, _isRetry = false): Promise<any> {
  const { logout } = useAuthStore.getState();
  const accessToken = getAccessToken();   // always read from in-memory var, not store snapshot

  // Ensure a CSRF cookie exists before any state-changing request.
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    await ensureCsrfToken();
  }

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    'x-csrf-token': getCsrfToken(),
    ...(options.headers as Record<string, string>),
  };

  try {
    const fetchOptions: RequestInit = {
      credentials: 'include',
      ...options,
      headers,
    };
    const response = await fetch(apiUrl(url), fetchOptions);

    // --- 401: token expired -------------------------------------------------
    if (response.status === 401) {
      if (_isRetry) {
        // Already tried a refresh — the cookie is gone too. Force logout.
        logout();
        queryClient.clear();
        window.dispatchEvent(new CustomEvent('navigate', { detail: '/login' }));
        throw { status: 'error', code: 'SESSION_EXPIRED', message: localizeErrorMessage('Session expired. Please log in again.', 'SESSION_EXPIRED'), timestamp: new Date().toISOString() };
      }

      // Attempt a silent refresh before giving up.
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Replay the original request once with the fresh token.
        return apiFetch(url, options, true);
      }

      // Refresh failed — session is truly dead.
      logout();
      queryClient.clear();
      window.dispatchEvent(new CustomEvent('navigate', { detail: '/login' }));
      throw { status: 'error', code: 'SESSION_EXPIRED', message: localizeErrorMessage('Session expired. Please log in again.', 'SESSION_EXPIRED'), timestamp: new Date().toISOString() };
    }

    // --- 403: permission denied — keep the session alive --------------------
    if (response.status === 403) {
      const contentType = response.headers.get('content-type');
      let message = 'You do not have permission to perform this action.';
      let code = 'FORBIDDEN';
      if (contentType?.includes('application/json')) {
        const body = await response.json().catch(() => ({}));
        message = body.message || message;
        code = body.code || code;
      }
      throw { status: 'error', code, message: localizeErrorMessage(message, code), timestamp: new Date().toISOString() };
    }

    // --- Non-OK responses ---------------------------------------------------
    const contentType = response.headers.get('content-type');
    if (!response.ok) {
      if (contentType?.includes('application/json')) {
        const errorData = await response.json();
        const code = errorData.code || 'UNKNOWN_ERROR';
        throw {
          status: 'error',
          code,
          message: localizeErrorMessage(errorData.message || 'API request failed', code),
          timestamp: new Date().toISOString(),
        };
      } else {
        const errorText = await response.text();
        throw {
          status: 'error',
          code: 'UNKNOWN_ERROR',
          message: localizeErrorMessage(`API request failed with status ${response.status}: ${errorText.substring(0, 100)}`, 'UNKNOWN_ERROR'),
          timestamp: new Date().toISOString(),
        };
      }
    }

    // --- Blob / file-download responses -------------------------------------
    if (contentType && (
      contentType.includes('application/vnd.openxmlformats') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/pdf') ||
      contentType.includes('application/zip')
    )) {
      return await response.blob();
    }

    if (contentType?.includes('application/json')) {
      return await response.json();
    }

    return response;
  } catch (error) {
    // Re-throw structured errors as-is; wrap raw Errors.
    if (error && typeof error === 'object' && 'status' in error) throw error;
    console.error(`API Fetch Error (${url}):`, error);
    if (error instanceof Error) {
      throw { status: 'error', code: 'FETCH_ERROR', message: localizeErrorMessage(error.message, 'FETCH_ERROR'), timestamp: new Date().toISOString() };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// apiDownload — dedicated helper for file exports (bypasses blob detection
// in apiFetch to keep that path explicit).
// ---------------------------------------------------------------------------
export async function apiDownload(url: string, options: RequestInit = {}): Promise<Blob> {
  const accessToken = getAccessToken();

  const headers: Record<string, string> = {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(apiUrl(url), {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Download failed: ${response.status} ${errorText}`);
  }

  return await response.blob();
}
