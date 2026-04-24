import clsx from 'clsx'
import { useEffect, useRef } from 'react'

export interface StreamEvent {
  id: number
  event: 'state_changed' | 'agent_changed' | 'action'
  summary: string
  at: number
}

const EVENT_COLOR: Record<StreamEvent['event'], string> = {
  state_changed: 'text-emerald-300',
  agent_changed: 'text-sky-300',
  action: 'text-amber-300',
}

interface Props {
  events: StreamEvent[]
}

export function EventStream({ events }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [events.length])

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/80 backdrop-blur-sm overflow-hidden flex flex-col">
      <div className="px-4 py-2 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
        Realtime · channel game:world
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[10px] space-y-0.5 min-h-[200px] max-h-[360px]">
        {events.length === 0 ? (
          <div className="text-zinc-600 italic">Listening for broadcasts…</div>
        ) : events.map(e => (
          <div key={e.id} className="flex items-start gap-2">
            <span className="text-zinc-600 tabular-nums">
              {new Date(e.at).toLocaleTimeString([], { hour12: false })}
            </span>
            <span className={clsx('uppercase tracking-wider', EVENT_COLOR[e.event])}>
              {e.event}
            </span>
            <span className="text-zinc-400 truncate flex-1">{e.summary}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
