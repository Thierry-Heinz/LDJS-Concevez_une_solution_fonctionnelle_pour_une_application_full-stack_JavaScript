import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Agency } from '@/types/api';

export const agenciesQuery = queryOptions({
  queryKey: ['agencies'],
  queryFn: () => api.get<Agency[]>('/agencies'),
  staleTime: 5 * 60_000, // la liste change rarement : pas de nouvelle requête pendant 5 min
});
