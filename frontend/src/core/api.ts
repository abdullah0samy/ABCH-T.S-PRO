import { useAuthStore, getAccessToken, refreshAccessToken } from '../store/authStore.ts';
import { queryClient } from '../main.tsx';

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
        throw { status: 'error', code: 'SESSION_EXPIRED', message: 'Session expired. Please log in again.', timestamp: new Date().toISOString() };
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
      throw { status: 'error', code: 'SESSION_EXPIRED', message: 'Session expired. Please log in again.', timestamp: new Date().toISOString() };
    }

    // --- 403: permission denied — keep the session alive --------------------
    if (response.status === 403) {
      const contentType = response.headers.get('content-type');
      let message = 'You do not have permission to perform this action.';
      if (contentType?.includes('application/json')) {
        const body = await response.json().catch(() => ({}));
        message = body.message || message;
      }
      throw { status: 'error', code: 'FORBIDDEN', message, timestamp: new Date().toISOString() };
    }

    // --- Non-OK responses ---------------------------------------------------
    const contentType = response.headers.get('content-type');
    if (!response.ok) {
      if (contentType?.includes('application/json')) {
        const errorData = await response.json();
        throw {
          status: 'error',
          code: errorData.code || 'UNKNOWN_ERROR',
          message: errorData.message || 'API request failed',
          timestamp: new Date().toISOString(),
        };
      } else {
        const errorText = await response.text();
        throw {
          status: 'error',
          code: 'UNKNOWN_ERROR',
          message: `API request failed with status ${response.status}: ${errorText.substring(0, 100)}`,
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
      throw { status: 'error', code: 'FETCH_ERROR', message: error.message, timestamp: new Date().toISOString() };
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
