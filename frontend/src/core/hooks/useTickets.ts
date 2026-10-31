import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { queryKeys } from '../queryKeys';

export function useTicketList(filters: Record<string, any>, endpoint: string = '/api/tickets/department') {
  return useQuery({
    queryKey: queryKeys.tickets.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString());
        }
      });
      return apiFetch(`${endpoint}?${params.toString()}`);
    },
    // Lists should stay fresh for a minute, reducing rapid reloading when filtering
    staleTime: 60 * 1000, 
  });
}

export function useTicketDetails(ticketId: number) {
  return useQuery({
    queryKey: queryKeys.tickets.detail(ticketId),
    queryFn: () => apiFetch(`/api/tickets/${ticketId}`),
    // Details can be cached for a minute as well
    staleTime: 60 * 1000,
    enabled: !!ticketId,
  });
}

export function useRelatedTickets(relatedTicketIds: number[]) {
  return useQuery({
    queryKey: queryKeys.tickets.related(relatedTicketIds.map(String)),
    queryFn: async () => {
      if (!relatedTicketIds || relatedTicketIds.length === 0) return [];
      
      const data = await apiFetch(`/api/tickets/department?status=all`);
      return data.tickets.filter((t: any) => relatedTicketIds.includes(t.id));
    },
    enabled: relatedTicketIds && relatedTicketIds.length > 0,
    staleTime: 60 * 1000,
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      status,
      comment,
      ticketTypeId,
      resolveType,
      requiresExternalResource,
      resolveExternal,
      externalResourceCost,
      resolveExternalCost,
      externalResourceNote,
      resolveExternalNote,
    }: any) => {
      const body: any = { status };
      if (comment !== undefined) body.comment = comment;
      if (status === 'resolved' || status === 'closed') {
        const effectiveType = ticketTypeId ?? resolveType;
        if (effectiveType !== undefined) body.ticketTypeId = effectiveType;
        const isExt = requiresExternalResource ?? resolveExternal ?? false;
        body.requiresExternalResource = Boolean(isExt);
        if (isExt) {
          const rawCost = externalResourceCost ?? resolveExternalCost;
          body.externalResourceCost = rawCost ? parseFloat(rawCost) : null;
          body.externalResourceNote = externalResourceNote ?? resolveExternalNote ?? null;
        }
      }
      return apiFetch(`/api/tickets/${ticketId}/status`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    onMutate: async (newStatusUpdate) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tickets.detail(newStatusUpdate.ticketId) });
      const previousTicket = queryClient.getQueryData(queryKeys.tickets.detail(newStatusUpdate.ticketId));

      queryClient.setQueryData(queryKeys.tickets.detail(newStatusUpdate.ticketId), (old: any) => {
        if (!old) return old;
        return { ...old, status: newStatusUpdate.status };
      });

      return { previousTicket };
    },
    onError: (err, newStatusUpdate, context: any) => {
      if (context?.previousTicket) {
        queryClient.setQueryData(queryKeys.tickets.detail(newStatusUpdate.ticketId), context.previousTicket);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.detail(variables.ticketId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.lists() });
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, agentId }: { ticketId: number; agentId: number | null }) => 
      apiFetch(`/api/tickets/${ticketId}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ agentId }),
      }),
    onSuccess: (data, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.detail(ticketId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.lists() });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, content, isInternal, attachments }: any) => 
      apiFetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, isInternal, attachments }),
      }),
    onSuccess: (newMessage, { ticketId }) => {
      // Instantly append the comment to the ticket details cache
      queryClient.setQueryData(queryKeys.tickets.detail(ticketId), (old: any) => {
        if (!old) return old;
        return { ...old, messages: [...old.messages, newMessage] };
      });
    },
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketData: any) => 
      apiFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(ticketData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
    },
  });
}
