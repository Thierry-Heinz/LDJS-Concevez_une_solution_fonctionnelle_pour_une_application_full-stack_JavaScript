import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { conversationsKey } from '@/lib/queries/conversations';
import { nullOn } from '@/lib/queries/utils';
import type {
  LoginInput,
  RegisterInput,
  SessionUser,
  UserProfile,
} from '@/types/api';

// ─── Requêtes ────────────────────────────────────────────────────

export const meQuery = queryOptions({
  queryKey: ['auth', 'me'],
  queryFn: () => nullOn([401], api.get<UserProfile>('/auth/me')),
  staleTime: Infinity, // ne change qu'à la connexion ou à la déconnexion, où on met le cache à jour à la main
  retry: false,
});

// ─── Mutations ───────────────────────────────────────────────────

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<SessionUser>('/auth/login', input),

    onSuccess: async () => {
      // Les cookies ont changé : le profil en cache est faux → on le recharge
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
      // Les conversations de l'invité ne concernent plus cet utilisateur → on les retire
      queryClient.removeQueries({ queryKey: conversationsKey });
      // TODO étape 7 : reconnectSocket()
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),

    onSuccess: () => {
      // On connaît la nouvelle valeur : plus personne n'est connecté
      queryClient.setQueryData(meQuery.queryKey, null);
      queryClient.removeQueries({ queryKey: conversationsKey });
      // TODO étape 7 : reconnectSocket()
    },
  });
}

/**
 * Inscription. Le back ne connecte pas l'utilisateur : le formulaire redirige vers /connexion.
 * Le 409 EMAIL_ALREADY_USED est géré par le formulaire, avec error.code.
 */
export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<void>('/auth/register', input),
  });
}
