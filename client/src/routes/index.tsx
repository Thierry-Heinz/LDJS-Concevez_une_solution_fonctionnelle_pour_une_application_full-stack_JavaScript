// Accueil. Exemple complet « Router + Query » : loader, squelette, useSuspenseQuery.

import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { AgencyCard, AgencyCardSkeleton } from '@/components/agency-cards.tsx';
import { agenciesQuery } from '@/lib/queries/agencies';

export const Route = createFileRoute('/')({
  // Le loader démarre le chargement AVANT le rendu (et au survol d'un lien, grâce à defaultPreload).
  // ensureQueryData : renvoie le cache s'il existe, sinon lance la requête.
  loader: ({ context }) => context.queryClient.ensureQueryData(agenciesQuery),
  // Affiché pendant que le loader attend.
  pendingComponent: () => (
    <HomeLayout>
      {[0, 1, 2].map((i) => (
        <AgencyCardSkeleton key={i} />
      ))}
    </HomeLayout>
  ),
  errorComponent: () => (
    <HomeLayout>
      <li role="alert" className="text-destructive">
        Les agences n'ont pas pu être chargées. Rechargez la page.
      </li>
    </HomeLayout>
  ),
  component: HomePage,
});

function HomePage() {
  // useSuspenseQuery : `data` n'est jamais undefined, le loader a déjà rempli le cache.
  const { data: agencies } = useSuspenseQuery(agenciesQuery);
  return (
    <HomeLayout>
      {agencies.map((agency) => (
        <AgencyCard key={agency.id} agency={agency} />
      ))}
    </HomeLayout>
  );
}

function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pt-8 pb-24 md:px-10 md:py-14">
      <h1 className="text-[28px] leading-[34px] font-extrabold tracking-tight md:text-4xl md:leading-[44px]">
        Louez votre voiture,
        <br />à votre façon.
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground md:text-lg md:leading-7">
        Une question avant de réserver ? Un conseiller vous répond en direct,
        dans votre agence ou au service client.
      </p>
      <h2 className="mt-12 mb-4 text-xl font-extrabold">Nos agences</h2>
      {/* Mobile d'abord : une colonne, puis trois à partir de md. */}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-5">
        {children}
      </ul>
    </div>
  );
}
