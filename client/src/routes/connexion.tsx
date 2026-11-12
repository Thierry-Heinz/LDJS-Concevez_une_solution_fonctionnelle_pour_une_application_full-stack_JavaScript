import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/connexion')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/connexion"!</div>
}
