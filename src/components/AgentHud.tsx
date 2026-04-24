import clsx from 'clsx'
import type { Agent } from '../types'

type Accent = 'orange' | 'sky' | 'green' | 'red'

interface Props {
  agent: Agent
  label: string
  accent: Accent
}

const ACCENT_BORDER: Record<Accent, string> = {
  orange: 'border-orange-600/60 bg-orange-950/30',
  sky:    'border-sky-600/60 bg-sky-950/30',
  green:  'border-green-600/60 bg-green-950/30',
  red:    'border-red-600/60 bg-red-950/30',
}

const ACCENT_CHIP: Record<Accent, string> = {
  orange: 'bg-orange-900/50 text-orange-200',
  sky:    'bg-sky-900/50 text-sky-200',
  green:  'bg-green-900/50 text-green-200',
  red:    'bg-red-900/50 text-red-200',
}

export function AgentHud({ agent, label, accent }: Props) {
  const lastThought = agent.memory?.thoughts?.[agent.memory.thoughts.length - 1]
  const inventory = agent.inventory?.items ?? []
  const accentClasses = ACCENT_BORDER[accent]
  const chipClasses = ACCENT_CHIP[accent]

  return (
    <div className={clsx('rounded-xl border px-4 py-3 backdrop-blur-sm', accentClasses)}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-mono text-sm uppercase tracking-wider text-zinc-200">{label}</h3>
        <span className="text-xs text-zinc-400">@{agent.location}</span>
      </div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Skills</div>
      <div className="flex flex-wrap gap-1 mb-3">
        {agent.skills.map(s => (
          <span key={s} className={clsx('text-xs px-2 py-0.5 rounded-full', chipClasses)}>{s}</span>
        ))}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Inventory</div>
      <div className="flex flex-wrap gap-1 mb-3 min-h-[20px]">
        {inventory.length === 0 ? <span className="text-xs text-zinc-500">(empty)</span> : inventory.map(i => (
          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200">{i}</span>
        ))}
      </div>
      {lastThought ? (
        <div className="mt-2 text-xs italic text-zinc-300 border-l-2 border-zinc-600 pl-2">💭 {lastThought}</div>
      ) : null}
    </div>
  )
}
