import clsx from 'clsx'
import type { Agent } from '../types'

interface Props {
  agent: Agent
  label: string
  accent: 'orange' | 'sky'
}

export function AgentHud({ agent, label, accent }: Props) {
  const lastThought = agent.memory?.thoughts?.[agent.memory.thoughts.length - 1]
  const inventory = agent.inventory?.items ?? []
  const accentClasses = accent === 'orange'
    ? 'border-orange-600/60 bg-orange-950/30'
    : 'border-sky-600/60 bg-sky-950/30'
  const chipClasses = accent === 'orange'
    ? 'bg-orange-900/50 text-orange-200'
    : 'bg-sky-900/50 text-sky-200'

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
