import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export const stateKey = ['state'] as const

/** The desk state, refetched whenever the server reports a change from any tab. */
export function useDeskState() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: stateKey, queryFn: api.state, refetchOnWindowFocus: true, retry: false, refetchInterval: (q) => (q.state.status === 'error' ? 3000 : false) })

  useEffect(() => {
    const events = new EventSource('/api/events')
    const refresh = () => client.invalidateQueries({ queryKey: stateKey })
    events.addEventListener('change', refresh)
    // Reconnecting after the server restarts may have missed changes.
    events.addEventListener('ready', refresh)
    return () => events.close()
  }, [client])

  return query
}

/** The current time, ticking so durations on screen stay fresh. */
export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
