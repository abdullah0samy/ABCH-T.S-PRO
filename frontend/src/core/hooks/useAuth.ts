import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiUrl, ensureCsrfToken, getCsrfToken, isCsrfRejection } from '../api';
import { useAuthStore } from '../../store/authStore.ts';

export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: async ({ identifier, password }: any) => {
      const attempt = async () => {
        const response = await fetch(apiUrl('/api/auth/login'), {
          method: 'POST',
          credentials: 'include', // send the CSRF cookie + store the httpOnly refresh cookie
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': getCsrfToken(),
          },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await response.json().catch(() => ({}));
        return { response, data };
      };

      await ensureCsrfToken(); // prime the CSRF cookie before this state-changing request
      let { response, data } = await attempt();

      // A token signed with a previous server secret is rejected here. Re-prime
      // and try once more, otherwise a restarted API leaves the user staring at
      // a login failure that no password can fix.
      if (isCsrfRejection(response.status, data?.message)) {
        await ensureCsrfToken(true);
        ({ response, data } = await attempt());
      }

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      return data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
    },
  });
}

export function useLogout() {
  const logoutAction = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      logoutAction();
      // The API call is already handled by logoutAction, we just want to hook into the UI flow
    },
    onSuccess: () => {
      // Clear React Query cache entirely to prevent sensitive data from leaking to other users
      queryClient.clear();
    },
  });
}
