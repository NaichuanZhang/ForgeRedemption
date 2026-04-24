import clsx from 'clsx'
import { FEATURE_DESCRIPTIONS, FEATURE_GROUPS, FEATURE_META, type Feature } from '../../lib/techMap'

const FLASH_MS = 1200

interface Props {
  lastTriggered: Partial<Record<Feature, number>>
  now: number
}

export function StackSidebar({ lastTriggered, now }: Props) {
  return (
    <aside className="rounded-xl border border-zinc-700/60 bg-zinc-950/70 backdrop-blur-sm overflow-hidden flex flex-col">
      <div className="px-4 py-2 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
        Stack
      </div>
      <div className="p-3 space-y-4 overflow-y-auto">
        {FEATURE_GROUPS.map(g => (
          <div key={g.group}>
            <div className={clsx(
              'text-[9px] font-mono uppercase tracking-wider mb-2',
              g.group === 'external' ? 'text-teal-400' : 'text-zinc-500',
            )}>
              {g.label}
            </div>
            <div className="space-y-1.5">
              {g.features.map(f => {
                const ts = lastTriggered[f] ?? 0
                const active = now - ts < FLASH_MS
                return (
                  <div
                    key={f}
                    className={clsx(
                      'rounded border px-2 py-1.5 text-[11px] transition-colors duration-300',
                      active
                        ? g.group === 'external'
                          ? 'border-teal-500 bg-teal-950/80 text-teal-100'
                          : 'border-emerald-500 bg-emerald-950/80 text-emerald-100'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-300',
                    )}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-wider">
                      {FEATURE_META[f].label}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                      {FEATURE_DESCRIPTIONS[f]}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
