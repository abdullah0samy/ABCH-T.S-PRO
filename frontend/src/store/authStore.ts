import { create } from 'zustand';
import { apiUrl, ensureCsrfToken, getCsrfToken } from '../core/api.ts';

// ---------------------------------------------------------------------------
// In-memory token store
//
// The access token lives ONLY in this module-level variable — never in
// localStorage, sessionStorage, or any other persistent browser storage.
// XSS cannot exfiltrate it; it disappears on tab close.
//
// The refresh token lives ONLY in the httpOnly, SameSite=Strict cookie that
// the backend sets. JS cannot read it. Silent renewal works by hitting
// /api/auth/refresh, which the browser sends the cookie on automatically.
//
// Migration note: we read the token from localStorage once to avoid logging
// out every existing user on upgrade, then immediately delete it so it is
// never written back.
// ---------------------------------------------------------------------------
let _accessToken: string | null = (() => {
  const legacy = localStorage.getItem('accessToken');
  if (legacy) {
    localStorage.removeItem('accessToken');   // delete legacy storage immediately
    return legacy;
  }
  return null;
})();

export function getAccessToken(): string | null {
  return _accessToken;
}

// ---------------------------------------------------------------------------
// Silent refresh — called by apiFetch when it receives a 401.
// Returns the new access token, or null if the refresh cookie has expired.
// ---------------------------------------------------------------------------
let _refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate: if multiple concurrent requests all 401 at once, only one
  // refresh call goes to the server.
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      // /api/auth/refresh is a POST and therefore CSRF-protected. On a cold
      // page load no CSRF cookie exists yet — in dev the SPA and API are on
      // different ports — so the token has to be primed first, or every
      // session restore is rejected before it reaches the auth logic.
      await ensureCsrfToken();

      const call = () =>
        fetch(apiUrl('/api/auth/refresh'), {
          method: 'POST',
          credentials: 'include',   // sends the httpOnly refresh cookie
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': getCsrfToken(),
          },
        });

      let res = await call();

      // Same stale-token problem as login: after the API restarts the cookie we
      // hold was signed with the old secret, so re-prime once before giving up.
      if (res.status === 403) {
        await ensureCsrfToken(true);
        res = await call();
      }
      if (!res.ok) {
        _accessToken = null;
        return null;
      }
      const data = await res.json();
      _accessToken = data.accessToken ?? null;
      // Sync the Zustand store so components re-render if needed
      useAuthStore.setState((s) => ({ ...s, accessToken: _accessToken }));
      return _accessToken;
    } catch {
      _accessToken = null;
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ---------------------------------------------------------------------------
// Zustand store — holds user profile and exposes the token reference.
// Components must NOT read the token from this store for auth headers;
// apiFetch reads it directly from getAccessToken() instead so it always
// has the latest value without a re-render cycle.
// ---------------------------------------------------------------------------
interface AuthState {
  user: any | null;
  /** Exposed for the NotificationProvider / App.tsx to react to login/logout. */
  accessToken: string | null;
  setAuth: (user: any, accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: _accessToken,

  setAuth: (user, accessToken) => {
    _accessToken = accessToken;   // update module-level var immediately
    set({ user, accessToken });   // trigger re-renders
  },

  logout: () => {
    _accessToken = null;
    set({ user: null, accessToken: null });
    // Fire-and-forget — clears the httpOnly refresh cookie server-side.
    fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
  },
}));
