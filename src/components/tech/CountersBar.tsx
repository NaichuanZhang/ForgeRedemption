import clsx from 'clsx'
import type { Counters } from '../../lib/techMap'

interface Props {
  counters: Counters
}

interface Cell {
  label: string
  value: number
  accent?: 'external'
}

export function CountersBar({ counters }: Props) {
  const cells: Cell[] = [
    { label: 'Edge fn calls',    value: counters.edgeFn },
    { label: 'Postgres writes',  value: counters.postgresWrites },
    { label: 'Realtime events',  value: counters.realtimeBroadcasts },
    { label: 'Claude calls',     value: counters.claudeCalls },
    { label: 'Embeddings',       value: counters.embeddingCalls },
    { label: 'pgvector RPCs',    value: counters.pgvectorSearches },
    { label: 'TinyFish searches', value: counters.tinyfishSearches, accent: 'external' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {cells.map(c => (
        <div
          key={c.label}
          className={clsx(
            'rounded-lg border bg-zinc-950/70 backdrop-blur-sm px-3 py-2',
            c.accent === 'external' ? 'border-teal-800/60' : 'border-zinc-700/60',
          )}
        >
          <div className={clsx(
            'text-[9px] font-mono uppercase tracking-wider',
            c.accent === 'external' ? 'text-teal-400' : 'text-zinc-500',
          )}>
            {c.label}
          </div>
          <div className={clsx(
            'font-mono text-xl tabular-nums mt-0.5',
            c.accent === 'external' ? 'text-teal-200' : 'text-zinc-100',
          )}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  )
}
