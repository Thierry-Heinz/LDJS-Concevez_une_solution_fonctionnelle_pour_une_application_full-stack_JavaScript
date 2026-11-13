import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { ArrowLeft, Clock, MapPin, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { agenciesQuery } from '@/lib/queries/agencies';

/**
 * Détail d'une agence : le nom du fichier donne l'URL `/agences/$agenceId`.
 * Une agence inconnue lève `notFound()`, qui affiche le `notFoundComponent` de la route racine.
 * L'API ne fournit que le nom : adresse, horaires et téléphone sont du contenu fictif.
 */
export const Route = createFileRoute('/agences/$agenceId')({
  loader: async ({ context, params }) => {
    const agencies = await context.queryClient.ensureQueryData(agenciesQuery);
    const agency = agencies.find((a) => a.id === params.agenceId);
    if (!agency) throw notFound();
    return agency;
  },
  component: AgencyPage,
});

function AgencyPage() {
  const agency = Route.useLoaderData();

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pt-8 pb-24 md:px-10 md:py-14">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour aux agences
      </Link>
      <h1 className="mt-4 mb-6 text-[28px] leading-[34px] font-extrabold md:text-4xl md:leading-[44px]">
        {agency.name}
      </h1>

      <Card className="max-w-[560px] p-6 shadow-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-4">
          <dt>
            <MapPin className="mt-0.5 size-5 text-primary" aria-hidden="true" />
          </dt>
          <dd>
            <strong className="block text-sm">Adresse</strong>12 place de la
            Gare
            <br />
            Ville
          </dd>
          <dt>
            <Clock className="mt-0.5 size-5 text-primary" aria-hidden="true" />
          </dt>
          <dd>
            <strong className="block text-sm">Horaires</strong>Du lundi au
            samedi : 8 h – 19 h<br />
            Dimanche : 9 h – 13 h
          </dd>
          <dt>
            <Phone className="mt-0.5 size-5 text-primary" aria-hidden="true" />
          </dt>
          <dd>
            <strong className="block text-sm">Téléphone</strong>
            <a href="tel:+33688000000" className="text-primary underline">
              06 88 00 00 00
            </a>
          </dd>
        </dl>
      </Card>
    </div>
  );
}
