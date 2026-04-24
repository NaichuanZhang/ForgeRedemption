import clsx from 'clsx'
import { useEffect, useMemo, useRef } from 'react'
import type { ActionLogEntry } from '../../types'
import { traceAction } from '../../lib/techMap'
import { FeatureBadge } from './FeatureBadge'

const AGENT_COLOR: Record<string, string> = {
  inmate: 'text-orange-300 border-orange-900/60',
  inmate2: 'text-emerald-300 border-emerald-900/60',
  friend: 'text-sky-300 border-sky-900/60',
  guard: 'text-red-300 border-red-900/60',
  world: 'text-zinc-400 border-zinc-800',
}

const RESULT_ICON: Record<string, string> = {
  success: '✓',
  failed: '✗',
  blocked: '—',
}

interface TickGroup {
  tick: number
  entries: ActionLogEntry[]
}

function groupByTick(entries: ActionLogEntry[]): TickGroup[] {
  const map = new Map<number, ActionLogEntry[]>()
  for (const e of entries) {
    const arr = map.get(e.tick) ?? []
    arr.push(e)
    map.set(e.tick, arr)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tick, entries]) => ({ tick, entries }))
}

interface Props {
  log: ActionLogEntry[]
}

export function TurnTimeline({ log }: Props) {
  const groups = useMemo(() => groupByTick(log), [log])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [log.length])

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/70 backdrop-blur-sm flex flex-col min-h-0 flex-1">
      <div className="px-4 py-2 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
        Turn Timeline — feature trace per action
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {groups.length === 0 ? (
          <div className="text-zinc-500 italic text-xs font-mono">
            Waiting for a turn. Open the game page and click Next Turn.
          </div>
        ) : groups.map(group => (
          <div key={group.tick} className="space-y-1.5">
            <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
              ── tick {String(group.tick).padStart(2, '0')} ──
            </div>
            {group.entries.map(entry => {
              const trace = traceAction(entry)
              return (
                <div
                  key={entry.id}
                  className={clsx(
                    'rounded border bg-zinc-900/50 px-3 py-2 text-xs space-y-1.5',
                    AGENT_COLOR[entry.agent_id] ?? 'border-zinc-800 text-zinc-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider">
                      {entry.agent_id}
                    </span>
                    <span className="text-zinc-500 font-mono text-[10px]">
                      → {trace.edgeFunction}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      · {entry.action}
                    </span>
                    <span className={clsx(
                      'ml-auto font-mono',
                      entry.result === 'success' ? 'text-emerald-400' : entry.result === 'blocked' ? 'text-amber-400' : 'text-red-400',
                    )}>
                      {RESULT_ICON[entry.result]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {trace.features.map(f => <FeatureBadge key={f} feature={f} />)}
                  </div>
                  <div className="text-zinc-300 text-[11px] leading-snug">
                    {entry.narration}
                  </div>
                  {trace.notes && (
                    <div className="text-[10px] text-zinc-500 font-mono">
                      ↳ {trace.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
