export const queryKeys = {
  // --- TICKETS ---
  tickets: {
    all: ['tickets'] as const,
    lists: () => [...queryKeys.tickets.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.tickets.lists(), { filters }] as const,
    details: () => [...queryKeys.tickets.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.tickets.details(), id] as const,
    related: (ticketIds: string[]) => [...queryKeys.tickets.all, 'related', { ticketIds }] as const,
  },

  // --- USERS / AGENTS ---
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.users.lists(), { filters }] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.users.details(), id] as const,
    agents: (departmentId?: number) => [...queryKeys.users.lists(), 'agents', { departmentId }] as const,
  },

  // --- REFERENCE DATA ---
  reference: {
    all: ['reference'] as const,
    departments: () => [...queryKeys.reference.all, 'departments'] as const,
    ticketTypes: () => [...queryKeys.reference.all, 'ticketTypes'] as const,
    buildings: () => [...queryKeys.reference.all, 'buildings'] as const,
    assets: () => [...queryKeys.reference.all, 'assets'] as const,
    formData: () => [...queryKeys.reference.all, 'formData'] as const,
  },

  // --- KNOWLEDGE BASE ---
  knowledge: {
    all: ['knowledge'] as const,
    lists: () => [...queryKeys.knowledge.all, 'list'] as const,
    search: (query: string) => [...queryKeys.knowledge.lists(), 'search', { query }] as const,
    details: () => [...queryKeys.knowledge.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.knowledge.details(), id] as const,
  },
  
  // --- ANALYTICS ---
  analytics: {
    all: ['analytics'] as const,
    dashboard: (filters: Record<string, any>) => [...queryKeys.analytics.all, 'dashboard', { filters }] as const,
  },
};
