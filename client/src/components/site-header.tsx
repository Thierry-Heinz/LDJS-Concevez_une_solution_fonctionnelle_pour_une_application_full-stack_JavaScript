import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-2.5 md:px-10 md:py-3.5">
      <Link to="/" aria-label="Your Car Your Way, accueil" className="flex min-h-11 items-center gap-2.5">
        {/* alt vide : le lien porte déjà le libellé */}
        <img src="/YCYW_logo.svg" alt="" width={60} height={36} />
        <span className="hidden text-[13px] leading-[14px] font-extrabold uppercase sm:block">
          Your Car
          <br />
          Your Way
        </span>
      </Link>

      <nav aria-label="Compte" className="flex items-center gap-2">
        {/* À l'étape 4 : prénom + Déconnexion si connecté */}
        <Button asChild variant="ghost" className="h-11">
          <Link to="/connexion">Connexion</Link>
        </Button>
        <Button asChild className="h-11">
          <Link to="/inscription">Inscription</Link>
        </Button>
      </nav>
    </header>
  )
}