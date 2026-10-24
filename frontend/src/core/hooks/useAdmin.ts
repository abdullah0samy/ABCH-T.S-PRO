import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, asList } from '../api';

export function useAdminList<T = any>(endpoint: string, queryKey: readonly unknown[]) {
  return useQuery<T[]>({
    queryKey,
    // Normalize paginated { data, total, ... } envelopes to a plain array.
    queryFn: async () => asList<T>(await apiFetch(endpoint)),
  });
}

export function useAdminMutation(endpointBase: string, queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number | string | null; data: any }) => {
      const url = id ? `${endpointBase}/${id}` : endpointBase;
      const method = id ? 'PUT' : 'POST';
      return apiFetch(url, {
        method,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
