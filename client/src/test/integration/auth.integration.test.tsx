import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@/types/api';
import {
  agency,
  agentSession,
  customerProfile,
  customerSession,
} from '@/test/fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render';
import { commonHandlers, setSessionHint } from './handlers';

/**
 * Parcours d'authentification sur l'application complète : routes, formulaires, cache et en-tête réels.
 * Seuls le réseau (MSW) et le socket (jamais ouvert ici) sont simulés.
 */
vi.mock('@/lib/socket', () =>
  import('@/test/fake-socket').then((m) => m.socketModuleMock),
);

beforeEach(() => {
  vi.clearAllMocks();
  server.use(...commonHandlers);
});

/** Le profil renvoyé par /auth/me suit l'état de la session simulée. */
function sessionHandlers(profile: UserProfile) {
  let loggedIn = false;
  return [
    http.post('/api/auth/login', async ({ request }) => {
      const { password } = (await request.json()) as { password: string };
      if (password !== 'bon-mot-de-passe')
        return HttpResponse.json(
          { message: 'Identifiants invalides' },
          { status: 401 },
        );
      loggedIn = true;
      setSessionHint();
      return HttpResponse.json(
        profile.role === 'AGENT' ? agentSession : customerSession,
      );
    }),
    http.get('/api/auth/me', () =>
      loggedIn
        ? HttpResponse.json(profile)
        : HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    ),
    http.post(
      '/api/auth/refresh',
      () => new HttpResponse(null, { status: 401 }),
    ),
    http.post('/api/auth/logout', () => {
      loggedIn = false;
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

async function fillLogin(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Mot de passe'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe("Accueil d'un visiteur", () => {
  it('liste les agences et propose connexion et inscription, sans appeler /auth/me', async () => {
    const onMe = vi.fn();
    server.use(http.get('/api/auth/me', onMe));

    renderApp('/');

    expect(
      await screen.findByRole('link', { name: new RegExp(agency.name) }),
    ).toHaveAttribute('href', `/agences/${agency.id}`);
    const account = screen.getByRole('navigation', { name: 'Compte' });
    expect(account).toHaveTextContent('Connexion');
    expect(account).toHaveTextContent('Inscription');
    expect(onMe).not.toHaveBeenCalled();
  });

  it('affiche une erreur si les agences ne peuvent pas être chargées', async () => {
    // Erreur attendue : le routeur la journalise avant d'afficher l'errorComponent.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get('/api/agencies', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Les agences n'ont pas pu être chargées",
    );
  });

  it('affiche la page introuvable pour une agence inconnue', async () => {
    renderApp('/agences/inconnue');
    expect(
      await screen.findByRole('heading', { name: 'Page introuvable' }),
    ).toBeInTheDocument();
  });
});

describe('Connexion', () => {
  it('valide le formulaire avant tout envoi', async () => {
    const onLogin = vi.fn();
    server.use(http.post('/api/auth/login', onLogin));
    renderApp('/connexion');

    await userEvent.type(await screen.findByLabelText('Email'), 'pas-un-email');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText(/Saisissez une adresse email valide/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Saisissez votre mot de passe.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('signale des identifiants invalides et replace le focus sur l’email', async () => {
    server.use(...sessionHandlers(customerProfile));
    const { router } = renderApp('/connexion');

    await fillLogin('alice@exemple.fr', 'mauvais');

    expect(
      await screen.findByText(/Identifiants invalides/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(router.state.location.pathname).toBe('/connexion');
  });

  it('signale une panne du serveur par un message générique', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    renderApp('/connexion');

    await fillLogin('alice@exemple.fr', 'bon-mot-de-passe');

    expect(
      await screen.findByText(/La connexion a échoué/),
    ).toBeInTheDocument();
  });

  it("connecte un client, le ramène à l'accueil et met l'en-tête à jour", async () => {
    server.use(...sessionHandlers(customerProfile));
    const { router } = renderApp('/connexion');

    await fillLogin('alice@exemple.fr', 'bon-mot-de-passe');

    expect(
      await screen.findByRole('button', { name: 'Déconnexion' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(
      screen.getByRole('button', { name: 'Ouvrir le chat' }),
    ).toBeInTheDocument();
  });

  it('respecte le paramètre ?redirect=', async () => {
    server.use(...sessionHandlers(customerProfile));
    const { router } = renderApp(`/connexion?redirect=/agences/${agency.id}`);

    await fillLogin('alice@exemple.fr', 'bon-mot-de-passe');

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/agences/${agency.id}`),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: agency.name }),
    ).toBeInTheDocument();
  });

  it('envoie un agent sur son tableau de bord, sans widget de chat client', async () => {
    server.use(
      ...sessionHandlers({
        ...customerProfile,
        role: 'AGENT',
        firstName: [],
        lastName: [],
      }),
      http.get('/api/conversations/open', () => HttpResponse.json([])),
    );
    const { router } = renderApp('/connexion');

    await fillLogin('central@ycyw.test', 'bon-mot-de-passe');

    expect(
      await screen.findByText('Aucune conversation ouverte'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/agent');
    expect(
      screen.queryByRole('button', { name: 'Ouvrir le chat' }),
    ).not.toBeInTheDocument();
  });
});

describe('Déconnexion', () => {
  it("revient à l'état visiteur", async () => {
    server.use(...sessionHandlers(customerProfile));
    renderApp('/connexion');
    await fillLogin('alice@exemple.fr', 'bon-mot-de-passe');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Déconnexion' }),
    );

    expect(
      await screen.findByRole('link', { name: 'Connexion' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Déconnexion' }),
    ).not.toBeInTheDocument();
  });
});

describe('Inscription', () => {
  async function fillRegister({
    password = 'motdepasse-solide',
    email = 'alice@exemple.fr',
  } = {}) {
    await userEvent.type(await screen.findByLabelText('Prénom'), 'Alice');
    await userEvent.type(screen.getByLabelText('Nom'), 'Martin');
    await userEvent.type(
      screen.getByLabelText('Date de naissance'),
      '1990-05-12',
    );
    await userEvent.type(
      screen.getByLabelText('Adresse'),
      '1 rue de la Paix, Paris',
    );
    await userEvent.type(screen.getByLabelText('Email'), email);
    await userEvent.type(screen.getByLabelText('Mot de passe'), password);
    await userEvent.click(
      screen.getByRole('button', { name: 'Créer mon compte' }),
    );
  }

  it('refuse un mot de passe trop court sans appeler l’API', async () => {
    const onRegister = vi.fn();
    server.use(http.post('/api/auth/register', onRegister));
    renderApp('/inscription');

    await fillRegister({ password: 'court' });

    expect(
      await screen.findByText(
        'Le mot de passe doit contenir au moins 12 caractères.',
      ),
    ).toBeInTheDocument();
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('crée le compte, confirme par un toast et redirige vers la connexion', async () => {
    let body: unknown;
    server.use(
      http.post('/api/auth/register', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 201 });
      }),
    );
    const { router } = renderApp('/inscription');

    await fillRegister();

    expect(
      await screen.findByText(
        'Votre compte est créé. Vous pouvez vous connecter.',
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/connexion'),
    );
    expect(body).toEqual({
      firstName: 'Alice',
      lastName: 'Martin',
      birthDate: '1990-05-12',
      address: '1 rue de la Paix, Paris',
      email: 'alice@exemple.fr',
      password: 'motdepasse-solide',
    });
  });

  it("affiche l'email déjà utilisé sous le champ concerné", async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          { message: 'Email déjà utilisé', code: 'EMAIL_ALREADY_USED' },
          { status: 409 },
        ),
      ),
    );
    renderApp('/inscription');

    await fillRegister();

    const email = screen.getByLabelText('Email');
    await waitFor(() =>
      expect(email).toHaveAccessibleDescription(
        'Un compte existe déjà avec cette adresse email.',
      ),
    );
    expect(email).toHaveFocus();
    expect(
      screen.queryByText(/L'inscription a échoué/),
    ).not.toBeInTheDocument();
  });

  it('affiche une alerte globale pour toute autre erreur', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    renderApp('/inscription');

    await fillRegister();

    expect(
      await screen.findByText(/L'inscription a échoué/),
    ).toBeInTheDocument();
  });
});
