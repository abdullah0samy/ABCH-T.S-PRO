import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { queryKeys } from '../queryKeys';

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard({ type: 'summary' }),
    queryFn: () => apiFetch('/api/analytics/dashboard-summary'),
    // Dashboard data can be kept fresh for a short time
    staleTime: 60 * 1000, 
  });
}

export function useDashboardAht() {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard({ type: 'aht' }),
    queryFn: () => apiFetch('/api/analytics/aht'),
    staleTime: 60 * 1000,
  });
}

export function useExportHistory() {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard({ type: 'exports' }),
    queryFn: async () => {
      const res = await apiFetch('/api/analytics/exports');
      return Array.isArray(res) ? res : res.data;
    },
  });
}
