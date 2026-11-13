import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { nullOn } from '@/lib/queries/utils';

describe('nullOn', () => {
  it('renvoie la donnée quand la promesse réussit', async () => {
    await expect(nullOn([404], Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('renvoie null pour un statut HTTP listé', async () => {
    const promise = Promise.reject(new ApiError(404, { message: 'Not Found' }));
    await expect(nullOn([401, 404], promise)).resolves.toBeNull();
  });

  it('relaie une erreur HTTP non listée', async () => {
    const error = new ApiError(500, undefined);
    await expect(nullOn([404], Promise.reject(error))).rejects.toBe(error);
  });

  it('relaie une erreur qui ne vient pas de l’API', async () => {
    const error = new TypeError('Failed to fetch');
    await expect(nullOn([404], Promise.reject(error))).rejects.toBe(error);
  });
});
