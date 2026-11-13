import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Agency } from '@/types/api';

/** Liste des agences, considérée fraîche pendant 5 minutes car elle change rarement. */
export const agenciesQuery = queryOptions({
  queryKey: ['agencies'],
  queryFn: () => api.get<Agency[]>('/agencies'),
  staleTime: 5 * 60_000,
});
