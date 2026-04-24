import clsx from 'clsx'
import { FEATURE_META, type Feature } from '../../lib/techMap'

const COLOR: Record<Feature, string> = {
  'postgres-read':      'bg-sky-950/60 text-sky-300 border-sky-800/60',
  'postgres-write':     'bg-sky-950/60 text-sky-300 border-sky-800/60',
  'realtime-broadcast': 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
  'claude-chat':        'bg-amber-950/60 text-amber-300 border-amber-800/60',
  'embeddings':         'bg-violet-950/60 text-violet-300 border-violet-800/60',
  'pgvector-rpc':       'bg-violet-950/60 text-violet-300 border-violet-800/60',
  'image-gen':          'bg-pink-950/60 text-pink-300 border-pink-800/60',
  'storage':            'bg-zinc-800/60 text-zinc-300 border-zinc-700/60',
  'edge-function':      'bg-zinc-800/60 text-zinc-300 border-zinc-700/60',
  'tinyfish-search':    'bg-teal-950/60 text-teal-200 border-teal-700/60',
}

interface Props {
  feature: Feature
  size?: 'sm' | 'md'
}

export function FeatureBadge({ feature, size = 'sm' }: Props) {
  const meta = FEATURE_META[feature]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded border font-mono uppercase tracking-wider',
        COLOR[feature],
        size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1',
      )}
      title={meta.label}
    >
      {meta.short}
    </span>
  )
}
