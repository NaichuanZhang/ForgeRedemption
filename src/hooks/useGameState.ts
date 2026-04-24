import { useCallback, useEffect, useRef, useState } from 'react'
import { insforge } from '../lib/insforge'
import type { ActionLogEntry, Agent, AssetMap, GameState } from '../types'

const LOG_LIMIT = 40

interface State {
  state: GameState | null
  inmate: Agent | null
  friend: Agent | null
  log: ActionLogEntry[]
  assets: AssetMap
  loading: boolean
  error: string | null
  turnInFlight: boolean
}

type Fn = ReturnType<typeof createFn>

function createFn() {
  return {
    advanceTurn: async () => {},
    resetWorld: async () => {},
  }
}

export function useGameState(): State & Fn {
  const [state, setState] = useState<GameState | null>(null)
  const [inmate, setInmate] = useState<Agent | null>(null)
  const [friend, setFriend] = useState<Agent | null>(null)
  const [log, setLog] = useState<ActionLogEntry[]>([])
  const [assets, setAssets] = useState<AssetMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [turnInFlight, setTurnInFlight] = useState(false)
  const subscribedRef = useRef(false)
  const busyRef = useRef(false)

  const loadInitial = useCallback(async () => {
    try {
      const [s, a, l, as] = await Promise.all([
        insforge.database.from('game_state').select('*').eq('id', 1).single(),
        insforge.database.from('agents').select('*'),
        insforge.database.from('action_log').select('*').order('created_at', { ascending: false }).limit(LOG_LIMIT),
        insforge.database.from('assets').select('*'),
      ])
      if (s.error) throw new Error(s.error.message)
      if (a.error) throw new Error(a.error.message)
      if (l.error) throw new Error(l.error.message)
      if (as.error) throw new Error(as.error.message)

      setState(s.data as GameState)
      const agents = (a.data ?? []) as Agent[]
      setInmate(agents.find(x => x.id === 'inmate') ?? null)
      setFriend(agents.find(x => x.id === 'friend') ?? null)
      setLog(((l.data ?? []) as ActionLogEntry[]).slice().reverse())

      const map: AssetMap = {}
      for (const row of (as.data ?? []) as Array<{ key: string; url: string }>) {
        ;(map as any)[row.key] = row.url
      }
      setAssets(map)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  useEffect(() => {
    if (subscribedRef.current) return
    subscribedRef.current = true
    let mounted = true
    ;(async () => {
      try {
        await insforge.realtime.connect()
        const sub = await insforge.realtime.subscribe('game:world')
        if (!sub.ok) return
        if (!mounted) return

        insforge.realtime.on('state_changed', (payload: any) => {
          setState(prev => ({ ...(prev ?? {} as any), ...payload } as GameState))
        })
        insforge.realtime.on('agent_changed', (payload: any) => {
          if (payload?.id === 'inmate') setInmate(prev => ({ ...(prev ?? {} as any), ...payload } as Agent))
          else if (payload?.id === 'friend') setFriend(prev => ({ ...(prev ?? {} as any), ...payload } as Agent))
        })
        insforge.realtime.on('action', (payload: any) => {
          setLog(prev => {
            const next = [...prev, payload as ActionLogEntry]
            return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next
          })
        })
      } catch {
        // realtime is best-effort; DB refresh after each turn is the source of truth
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const refreshFromDb = useCallback(async () => {
    const [s, a, l] = await Promise.all([
      insforge.database.from('game_state').select('*').eq('id', 1).single(),
      insforge.database.from('agents').select('*'),
      insforge.database.from('action_log').select('*').order('created_at', { ascending: false }).limit(LOG_LIMIT),
    ])
    if (s.data) setState(s.data as GameState)
    if (a.data) {
      const agents = a.data as Agent[]
      setInmate(agents.find(x => x.id === 'inmate') ?? null)
      setFriend(agents.find(x => x.id === 'friend') ?? null)
    }
    if (l.data) setLog(((l.data) as ActionLogEntry[]).slice().reverse())
  }, [])

  const advanceTurn = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setTurnInFlight(true)
    try {
      await insforge.functions.invoke('advance-world', { body: {} })
      await refreshFromDb()
      await insforge.functions.invoke('inmate-tick', { body: {} })
      await refreshFromDb()
      await insforge.functions.invoke('friend-tick', { body: {} })
      await refreshFromDb()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      busyRef.current = false
      setTurnInFlight(false)
    }
  }, [refreshFromDb])

  const resetWorld = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setTurnInFlight(true)
    try {
      await insforge.functions.invoke('reset-world', { body: {} })
      await loadInitial()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      busyRef.current = false
      setTurnInFlight(false)
    }
  }, [loadInitial])

  return { state, inmate, friend, log, assets, loading, error, turnInFlight, advanceTurn, resetWorld } as State & Fn
}
