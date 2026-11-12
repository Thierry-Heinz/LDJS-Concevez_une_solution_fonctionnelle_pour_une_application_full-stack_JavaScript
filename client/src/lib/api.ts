export class ApiError extends Error {
  status: number;
  /** Code métier renvoyé par l'API : EMAIL_ALREADY_USED, CONVERSATION_CLOSED... */
  code?: string;
  body: unknown;

  constructor(status: number, body: unknown) {
    const b = body as { message?: string | string[]; code?: string } | null;
    const message = Array.isArray(b?.message)
      ? b.message.join(', ')
      : b?.message;
    super(message ?? `Erreur HTTP ${status}`);
    this.status = status;
    this.code = b?.code;
    this.body = body;
  }
}

let refreshPromise: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

const NO_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/guest',
  '/auth/logout',
];

async function request<T>(
  path: string,
  init: RequestInit = {},
  canRefresh = true,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: init.body
      ? { 'Content-Type': 'application/json', ...init.headers }
      : init.headers,
  });

  if (res.status === 401 && canRefresh && !NO_REFRESH.includes(path)) {
    const refresh = await refreshSession();
    if (refresh) {
      return request<T>(path, init, false);
    }
  }

  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
};
