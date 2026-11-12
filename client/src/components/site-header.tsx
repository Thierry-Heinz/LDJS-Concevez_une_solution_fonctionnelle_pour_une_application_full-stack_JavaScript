import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { meQuery, useLogout } from '@/lib/queries/auth';
import { useQuery } from '@tanstack/react-query';

export function SiteHeader() {
  const { data: me } = useQuery(meQuery);
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-2.5 md:px-10 md:py-3.5">
      <Link
        to="/"
        aria-label="Your Car Your Way, accueil"
        className="flex min-h-11 items-center gap-2.5"
      >
        {/* alt vide : le lien porte déjà le libellé */}
        <img src="/YCYW_logo.svg" alt="" width={60} height={36} />
        <span className="hidden text-[13px] leading-[14px] font-extrabold uppercase sm:block">
          Your Car
          <br />
          Your Way
        </span>
      </Link>

      <nav aria-label="Compte" className="flex items-center gap-2">
        {me ? (
          <>
            {me.firstName && (
              <span className="text-sm font-semibold">{me.firstName}</span>
            )}
            <Button
              variant="outline"
              className="h-11"
              disabled={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, {
                  onSuccess: () => void navigate({ to: '/' }),
                })
              }
            >
              <LogOut aria-hidden="true" />
              Déconnexion
            </Button>
          </>
        ) : (
          <>
            {/* asChild : le style du bouton est appliqué au <a> du Link, sans <button> autour. */}
            <Button asChild variant="ghost" className="h-11">
              <Link to="/connexion">Connexion</Link>
            </Button>
            <Button asChild className="h-11">
              <Link to="/inscription">Inscription</Link>
            </Button>
          </>
        )}
      </nav>
    </header>
  );
}
