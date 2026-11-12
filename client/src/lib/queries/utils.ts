import { ApiError } from '@/lib/api';

/** Transforme certaines erreurs HTTP en « pas de donnée » (null) plutôt qu'en erreur. */
export async function nullOn<T>(
  statuses: number[],
  promise: Promise<T>,
): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && statuses.includes(error.status))
      return null;
    throw error;
  }
}
