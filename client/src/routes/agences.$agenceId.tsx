import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/agences/$agenceId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/agences/$agenceId"!</div>
}
