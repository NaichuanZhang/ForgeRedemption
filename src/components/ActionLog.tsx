import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import type { ActionLogEntry } from '../types'

interface Props {
  entries: ActionLogEntry[]
}

const AGENT_STYLE: Record<string, string> = {
  inmate: 'text-orange-300',
  friend: 'text-sky-300',
  world: 'text-zinc-400',
}

const RESULT_ICON: Record<string, string> = {
  success: '✓',
  failed: '✗',
  blocked: '—',
}

export function ActionLog({ entries }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/70 backdrop-blur-sm">
      <div className="px-4 py-2 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
        Action Log
      </div>
      <div ref={scrollRef} className="max-h-48 overflow-y-auto px-4 py-2 font-mono text-xs space-y-1">
        {entries.length === 0 ? (
          <div className="text-zinc-500 italic">Silence. Click Next Turn to begin.</div>
        ) : entries.map(e => (
          <div key={e.id} className="flex items-start gap-2">
            <span className="text-zinc-600 tabular-nums">t{String(e.tick).padStart(2, '0')}</span>
            <span className={clsx('font-semibold uppercase', AGENT_STYLE[e.agent_id] ?? 'text-zinc-400')}>
              {e.agent_id}
            </span>
            <span className={clsx(
              e.result === 'success' ? 'text-emerald-400' : e.result === 'blocked' ? 'text-amber-500' : 'text-red-400',
            )}>
              {RESULT_ICON[e.result]}
            </span>
            <span className="text-zinc-300 flex-1">{e.narration}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
