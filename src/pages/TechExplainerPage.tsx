import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameState } from '../hooks/useGameState'
import { insforge } from '../lib/insforge'
import { countFromLog, traceAction, type Feature } from '../lib/techMap'
import { StackSidebar } from '../components/tech/StackSidebar'
import { TurnTimeline } from '../components/tech/TurnTimeline'
import { EventStream, type StreamEvent } from '../components/tech/EventStream'
import { CountersBar } from '../components/tech/CountersBar'

const STREAM_LIMIT = 80

export function TechExplainerPage() {
  const { log, loading, error } = useGameState()

  const [events, setEvents] = useState<StreamEvent[]>([])
  const [realtimeCount, setRealtimeCount] = useState(0)
  const [lastTriggered, setLastTriggered] = useState<Partial<Record<Feature, number>>>({})
  const [now, setNow] = useState(Date.now())
  const eventIdRef = useRef(0)
  const subscribedRef = useRef(false)

  // Tick clock so StackSidebar flashes decay without event-driven re-renders.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 300)
    return () => clearInterval(id)
  }, [])

  // Extra realtime listeners — counter + event stream. DB subscription is handled by useGameState.
  useEffect(() => {
    if (subscribedRef.current) return
    subscribedRef.current = true
    let cancelled = false

    const push = (event: StreamEvent['event'], summary: string) => {
      if (cancelled) return
      const id = ++eventIdRef.current
      setEvents(prev => {
        const next = [...prev, { id, event, summary, at: Date.now() }]
        return next.length > STREAM_LIMIT ? next.slice(next.length - STREAM_LIMIT) : next
      })
      setRealtimeCount(c => c + 1)
    }

    ;(async () => {
      try {
        await insforge.realtime.connect()
        const sub = await insforge.realtime.subscribe('game:world')
        if (!sub.ok || cancelled) return

        insforge.realtime.on('state_changed', (payload: any) => {
          const tick = payload?.tick ?? '?'
          push('state_changed', `tick=${tick} weather=${payload?.weather ?? '?'} time=${payload?.time_of_day ?? '?'}`)
        })
        insforge.realtime.on('agent_changed', (payload: any) => {
          push('agent_changed', `${payload?.id ?? '?'} @ ${payload?.location ?? '?'} skills=${(payload?.skills ?? []).length}`)
        })
        insforge.realtime.on('action', (payload: any) => {
          const entry = payload as { agent_id?: string; action?: string; args?: Record<string, unknown> }
          push('action', `${entry.agent_id ?? '?'}.${entry.action ?? '?'}`)
          const trace = traceAction(payload as any)
          const stamp = Date.now()
          setLastTriggered(prev => {
            const next = { ...prev }
            for (const f of trace.features) next[f] = stamp
            return next
          })
        })
      } catch {
        // best-effort — timeline will still populate via DB refresh
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const counters = useMemo(() => {
    const base = countFromLog(log)
    return { ...base, realtimeBroadcasts: realtimeCount }
  }, [log, realtimeCount])

  if (loading) {
    return <div className="flex h-full items-center justify-center text-zinc-400">Connecting to Insforge…</div>
  }
  if (error) {
    return <div className="flex h-full items-center justify-center text-red-400">{error}</div>
  }

  return (
    <div className="min-h-full bg-zinc-900 text-zinc-100">
      <div className="max-w-[1600px] mx-auto p-4 flex flex-col gap-4">
        <header className="flex flex-wrap items-baseline gap-4">
          <div>
            <h1 className="font-pixel text-lg tracking-wider text-emerald-300">Tech Explainer</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Live breakdown of the InsForge features (and TinyFish search) exercised by each turn.
            </p>
          </div>
          <Link
            to="/"
            className="ml-auto text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-emerald-300 border border-zinc-700/60 rounded-md px-3 py-1.5 bg-zinc-950/70 transition-colors"
          >
            ← Back to game
          </Link>
        </header>

        <CountersBar counters={counters} />

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] gap-4 min-h-[70vh]">
          <StackSidebar lastTriggered={lastTriggered} now={now} />
          <TurnTimeline log={log} />
          <EventStream events={events} />
        </div>

        <footer className="text-[10px] font-mono text-zinc-600">
          InsForge docs: <a href="https://docs.insforge.dev/introduction" className="underline hover:text-zinc-400" target="_blank" rel="noopener noreferrer">docs.insforge.dev/introduction</a>
          {' · '}
          TinyFish: <a href="https://api.search.tinyfish.ai" className="underline hover:text-zinc-400" target="_blank" rel="noopener noreferrer">api.search.tinyfish.ai</a>
        </footer>
      </div>
    </div>
  )
}
