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
import { reconnectSocket } from '../socket';

function hasSessionHint() {
  return document.cookie.split('; ').includes('has_session=1');
}

/** Profil de l'utilisateur connecté, ou `null` ; sans cookie indicateur `has_session`, aucune requête n'est envoyée. */
export const meQuery = queryOptions({
  queryKey: ['auth', 'me'],
  queryFn: () =>
    hasSessionHint()
      ? nullOn([401], api.get<UserProfile>('/auth/me'))
      : Promise.resolve(null),
  staleTime: Infinity,
  retry: false,
});

/** Connexion : recharge le profil, retire du cache les conversations de l'invité et reconnecte le socket avec les nouveaux cookies. */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<SessionUser>('/auth/login', input),

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
      queryClient.removeQueries({ queryKey: conversationsKey });

      reconnectSocket();
    },
  });
}

/**
 * Déconnexion : le profil passe directement à `null`, sans nouvelle requête, et les conversations sont retirées du cache.
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),

    onSuccess: () => {
      queryClient.setQueryData(meQuery.queryKey, null);
      queryClient.removeQueries({ queryKey: conversationsKey });

      reconnectSocket();
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
