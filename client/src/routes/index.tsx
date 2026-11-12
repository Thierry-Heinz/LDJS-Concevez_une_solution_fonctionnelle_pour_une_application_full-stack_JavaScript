import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { data, error } = useQuery({
    queryKey: ['agencies'],
    queryFn: async () => (await fetch('/api/agencies')).json() as Promise<{ id: string; name: string }[]>,
  })
  if (error) return <p className="text-red-600">Erreur : {String(error)}</p>
  return (
    <ul className="list-disc pl-6">
      {data?.map((a) => <li key={a.id}>{a.name}</li>)}
    </ul>
  )
}