import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { api, ApiError, refreshSession } from '@/lib/api';
import { server } from '@/test/msw-server';

describe('ApiError', () => {
  it('reprend le message, le code métier et le corps de la réponse', () => {
    const body = { message: 'Email déjà utilisé', code: 'EMAIL_ALREADY_USED' };
    const error = new ApiError(409, body);

    expect(error.status).toBe(409);
    expect(error.message).toBe('Email déjà utilisé');
    expect(error.code).toBe('EMAIL_ALREADY_USED');
    expect(error.body).toBe(body);
  });

  it('joint les messages de validation renvoyés sous forme de tableau', () => {
    const error = new ApiError(400, {
      message: ['email invalide', 'mot de passe trop court'],
    });
    expect(error.message).toBe('email invalide, mot de passe trop court');
  });

  it('utilise un message générique sans corps exploitable', () => {
    expect(new ApiError(500, undefined).message).toBe('Erreur HTTP 500');
  });
});

describe('api', () => {
  it('renvoie le JSON de la réponse', async () => {
    server.use(
      http.get('/api/agencies', () =>
        HttpResponse.json([{ id: 'a', name: 'Lyon' }]),
      ),
    );

    await expect(api.get('/agencies')).resolves.toEqual([
      { id: 'a', name: 'Lyon' },
    ]);
  });

  it('envoie le corps en JSON avec le bon en-tête', async () => {
    let received: { contentType: string | null; body: unknown } | undefined;
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        received = {
          contentType: request.headers.get('Content-Type'),
          body: await request.json(),
        };
        return HttpResponse.json({ id: 'u1' });
      }),
    );

    await api.post('/auth/login', { email: 'a@b.fr', password: 'x' });

    expect(received).toEqual({
      contentType: 'application/json',
      body: { email: 'a@b.fr', password: 'x' },
    });
  });

  it('accepte une réponse vide (204)', async () => {
    server.use(
      http.post(
        '/api/auth/logout',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(api.post('/auth/logout')).resolves.toBeUndefined();
  });

  it('lève une ApiError sur une réponse en erreur', async () => {
    server.use(
      http.get('/api/conversations/current', () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    );

    const error = await api
      .get('/conversations/current')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'Not Found' });
  });

  it('rafraîchit la session sur un 401 puis rejoue la requête une seule fois', async () => {
    let meCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get('/api/auth/me', () => {
        meCalls += 1;
        return meCalls === 1
          ? HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
          : HttpResponse.json({ id: 'u1' });
      }),
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(api.get('/auth/me')).resolves.toEqual({ id: 'u1' });
    expect(meCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it("lève l'erreur 401 si le rafraîchissement échoue", async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
      http.post(
        '/api/auth/refresh',
        () => new HttpResponse(null, { status: 401 }),
      ),
    );

    await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 401 });
  });

  it('ne tente pas de rafraîchissement sur les routes de connexion', async () => {
    let refreshCalls = 0;
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { message: 'Identifiants invalides' },
          { status: 401 },
        ),
      ),
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshCalls).toBe(0);
  });
});

describe('refreshSession', () => {
  it('mutualise les appels simultanés en une seule requête', async () => {
    let refreshCalls = 0;
    server.use(
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const results = await Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
    ]);

    expect(results).toEqual([true, true, true]);
    expect(refreshCalls).toBe(1);
  });

  it('renvoie false si le réseau est indisponible', async () => {
    server.use(http.post('/api/auth/refresh', () => HttpResponse.error()));
    await expect(refreshSession()).resolves.toBe(false);
  });
});
