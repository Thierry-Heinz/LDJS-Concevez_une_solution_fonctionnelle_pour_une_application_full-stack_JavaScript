import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { SiteHeader } from '@/components/site-header'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* RGAA : lien d'évitement, premier élément focusable, visible seulement au focus */}
      <a
        href="#contenu"
        className="sr-only rounded-lg bg-foreground px-3.5 py-2.5 text-sm font-semibold text-background focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Aller au contenu
      </a>
      <SiteHeader />
      {/* tabIndex={-1} : le lien d'évitement peut y déplacer le focus */}
      <main id="contenu" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <Outlet />
      </main>
      {/* À venir : <ChatWidget /> (étape 8) */}
      <Toaster position="bottom-center" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-14">
      <h1 className="text-3xl font-extrabold">Page introuvable</h1>
      <Button asChild>
        <Link to="/">Retour à l'accueil</Link>
      </Button>
    </div>
  )
}