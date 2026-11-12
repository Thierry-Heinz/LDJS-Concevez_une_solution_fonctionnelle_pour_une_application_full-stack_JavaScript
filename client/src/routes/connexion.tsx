// Connexion. Exemple complet de formulaire : react-hook-form + zod + composants shadcn + mutation.

import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { useLogin } from '@/lib/queries/auth';
import { TextField } from '../components/text-field';

const schema = z.object({
  email: z.email(
    'Saisissez une adresse email valide, par exemple nom@exemple.fr.',
  ),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
});
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute('/connexion')({
  // Paramètres d'URL validés et typés : /connexion?redirect=/agent
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const login = useLogin();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;

  function onSubmit(values: FormValues) {
    login.mutate(values, {
      onSuccess: (user) => {
        // Un conseiller va sur son tableau, un client revient d'où il venait.
        if (user.role === 'AGENT') void navigate({ to: '/agent' });
        else void navigate({ to: redirect ?? '/' });
      },
      // Après une erreur, le focus revient sur le premier champ.
      onError: () => form.setFocus('email'),
    });
  }

  const invalidCredentials =
    login.error instanceof ApiError && login.error.status === 401;

  return (
    <div className="flex flex-1 items-start justify-center md:bg-muted md:px-4 md:py-14">
      <Card className="w-full max-w-[440px] rounded-none border-0 p-4 pt-6 shadow-none md:rounded-xl md:border md:p-8 md:shadow-sm">
        {/* noValidate : on remplace les bulles du navigateur par nos messages, reliés aux champs. */}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <h1 className="text-2xl font-extrabold">Connexion</h1>

          {login.isError && (
            // role="alert" (déjà posé par le composant shadcn) : l'erreur est annoncée dès qu'elle apparaît.
            <Alert
              variant="destructive"
              className="border-destructive bg-destructive/10 font-semibold text-destructive"
            >
              <CircleAlert aria-hidden="true" />
              <AlertDescription>
                {invalidCredentials
                  ? 'Identifiants invalides. Vérifiez votre email et votre mot de passe.'
                  : 'La connexion a échoué. Réessayez dans un instant.'}
              </AlertDescription>
            </Alert>
          )}

          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...form.register('email')}
          />
          <TextField
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...form.register('password')}
          />

          {/* aria-disabled plutôt que disabled : le bouton garde le focus pendant le chargement. */}
          <Button
            type="submit"
            aria-disabled={login.isPending}
            onClick={(event) => login.isPending && event.preventDefault()}
            className="h-11 w-full"
          >
            {login.isPending && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            {login.isPending ? 'Connexion en cours…' : 'Se connecter'}
          </Button>

          <p className="text-[13px] text-muted-foreground">
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="text-primary underline">
              Créer un compte
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
