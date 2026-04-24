import clsx from 'clsx'
import type { GameState } from '../types'

interface Props {
  state: GameState
  onAdvance: () => void | Promise<void>
  onReset: () => void | Promise<void>
  busy: boolean
  autoPlay: boolean
  onToggleAutoPlay: () => void
}

const WEATHER_ICON: Record<string, string> = { sun: '☀️', rain: '🌧️', fog: '🌫️' }
const TIME_ICON: Record<string, string> = { morning: '🌅', noon: '🌞', evening: '🌆', night: '🌙' }

export function WorldHud({ state, onAdvance, onReset, busy, autoPlay, onToggleAutoPlay }: Props) {
  const escape = state.world?.escape_progress ?? 0
  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 backdrop-blur-sm px-4 py-3">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-mono text-sm uppercase tracking-wider text-zinc-200">World</h3>
        <span className="text-xs text-zinc-400 font-mono">tick {state.tick}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 mb-3">
        <div>{TIME_ICON[state.time_of_day]} {state.time_of_day}</div>
        <div>{WEATHER_ICON[state.weather]} {state.weather}</div>
      </div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Escape</div>
      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-700"
          style={{ width: `${escape}%` }}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onAdvance}
          disabled={busy || autoPlay || state.status === 'escaped'}
          className={clsx(
            'flex-1 px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition',
            busy || autoPlay || state.status === 'escaped'
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : 'bg-amber-500 text-zinc-950 hover:bg-amber-400 active:bg-amber-600',
          )}
        >
          {busy ? 'Thinking…' : state.status === 'escaped' ? 'Escaped' : 'Next Turn ▶'}
        </button>
        <button
          onClick={onToggleAutoPlay}
          disabled={state.status === 'escaped'}
          className={clsx(
            'px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition',
            state.status === 'escaped'
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : autoPlay
                ? 'bg-red-500 text-white hover:bg-red-400 animate-pulse'
                : 'bg-emerald-600 text-white hover:bg-emerald-500',
          )}
        >
          {autoPlay ? 'Stop ■' : 'Auto ▶▶'}
        </button>
        <button
          onClick={onReset}
          disabled={busy}
          className="px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-wider bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
