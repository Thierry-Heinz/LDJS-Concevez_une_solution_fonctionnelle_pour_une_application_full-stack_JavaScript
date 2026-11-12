import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Agency } from '@/types/api';

export function AgencyCard({ agency }: { agency: Agency }) {
  return (
    <li>
      <Link
        to="/agences/$agenceId"
        params={{ agenceId: agency.id }}
        className="block rounded-xl"
      >
        <Card className="flex flex-col gap-2 p-5 shadow-sm transition-colors hover:border-primary">
          <span className="flex items-center justify-between text-lg font-extrabold">
            {agency.name}
            <ChevronRight className="size-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-primary underline">
            Voir l'agence
          </span>
        </Card>
      </Link>
    </li>
  );
}

export function AgencyCardSkeleton() {
  return (
    <li>
      <Card className="flex flex-col gap-3 p-5">
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
      </Card>
    </li>
  );
}
