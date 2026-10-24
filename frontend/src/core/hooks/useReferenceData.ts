import { useQuery } from '@tanstack/react-query';
import { apiFetch, asList } from '../api';
import { queryKeys } from '../queryKeys';

// Fetch all form data (buildings, floors, departments, ticketTypes) in one call.
// This matches the existing backend endpoint `/api/tickets/form-data`.
export function useFormData() {
  return useQuery({
    queryKey: queryKeys.reference.formData(),
    queryFn: () => apiFetch('/api/tickets/form-data'),
    // Reference data is stable, keep it fresh for longer
    staleTime: 30 * 60 * 1000, 
  });
}

export function useAdminDepartments() {
  return useQuery({
    queryKey: queryKeys.reference.departments(),
    queryFn: async () => asList(await apiFetch('/api/admin/departments')),
    staleTime: 30 * 60 * 1000,
  });
}

export function useAdminTicketTypes() {
  return useQuery({
    queryKey: queryKeys.reference.ticketTypes(),
    queryFn: async () => asList(await apiFetch('/api/admin/ticket-types')),
    staleTime: 30 * 60 * 1000,
  });
}

export function useAssets(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.reference.assets(),
    // /api/assets returns a paginated { data, total, page, limit } envelope.
    queryFn: async () => asList(await apiFetch('/api/assets')),
    staleTime: 30 * 60 * 1000,
    enabled: options?.enabled,
  });
}
