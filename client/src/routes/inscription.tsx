import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/inscription')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/inscription"!</div>
}
