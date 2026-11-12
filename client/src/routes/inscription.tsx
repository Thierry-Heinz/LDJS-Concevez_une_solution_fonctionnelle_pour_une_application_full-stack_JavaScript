import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/text-field';
import { ApiError } from '@/lib/api';
import { useRegister } from '@/lib/queries/auth';

// Mêmes règles que le RegisterDto du back : l'utilisateur est prévenu avant l'envoi
const schema = z.object({
  firstName: z.string().trim().min(1, 'Saisissez votre prénom.'),
  lastName: z.string().trim().min(1, 'Saisissez votre nom.'),
  birthDate: z.iso.date('Saisissez votre date de naissance.'),
  address: z.string().trim().min(1, 'Saisissez votre adresse.'),
  email: z.email(
    'Saisissez une adresse email valide, par exemple nom@exemple.fr.',
  ),
  password: z
    .string()
    .min(12, 'Le mot de passe doit contenir au moins 12 caractères.'),
});
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute('/inscription')({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useRegister();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      birthDate: '',
      address: '',
      email: '',
      password: '',
    },
  });
  const { errors } = form.formState;

  function onSubmit(values: FormValues) {
    registerUser.mutate(values, {
      onSuccess: () => {
        toast.success('Votre compte est créé. Vous pouvez vous connecter.');
        void navigate({ to: '/connexion' });
      },
      onError: (error) => {
        // Erreur métier précise : on l'affiche sous le champ concerné
        if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_USED') {
          form.setError(
            'email',
            { message: 'Un compte existe déjà avec cette adresse email.' },
            { shouldFocus: true },
          );
        }
      },
    });
  }

  // Erreur globale : tout sauf l'email déjà utilisé, déjà affiché sous son champ
  const globalError =
    registerUser.isError &&
    !(
      registerUser.error instanceof ApiError &&
      registerUser.error.code === 'EMAIL_ALREADY_USED'
    );

  return (
    <div className="flex flex-1 items-start justify-center md:bg-muted md:px-4 md:py-14">
      <Card className="w-full max-w-[480px] rounded-none border-0 p-4 pt-6 shadow-none md:rounded-xl md:border md:p-8 md:shadow-sm">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <h1 className="text-2xl font-extrabold">Créer un compte</h1>

          {globalError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>
                L'inscription a échoué. Réessayez dans un instant.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Prénom"
              autoComplete="given-name"
              error={errors.firstName?.message}
              {...form.register('firstName')}
            />
            <TextField
              label="Nom"
              autoComplete="family-name"
              error={errors.lastName?.message}
              {...form.register('lastName')}
            />
          </div>
          <TextField
            label="Date de naissance"
            type="date"
            autoComplete="bday"
            error={errors.birthDate?.message}
            {...form.register('birthDate')}
          />
          <TextField
            label="Adresse"
            autoComplete="street-address"
            error={errors.address?.message}
            {...form.register('address')}
          />
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
            autoComplete="new-password"
            hint="12 caractères minimum."
            error={errors.password?.message}
            {...form.register('password')}
          />

          <p className="text-[13px] text-muted-foreground">
            Vos données servent uniquement à gérer votre compte et vos demandes.{' '}
            <Link to="/donnees-personnelles" className="text-primary underline">
              En savoir plus
            </Link>
          </p>

          <Button
            type="submit"
            disabled={registerUser.isPending}
            className="h-11 w-full"
          >
            {registerUser.isPending && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            {registerUser.isPending ? 'Création en cours…' : 'Créer mon compte'}
          </Button>

          <p className="text-[13px] text-muted-foreground">
            Déjà un compte ?{' '}
            <Link to="/connexion" className="text-primary underline">
              Se connecter
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
