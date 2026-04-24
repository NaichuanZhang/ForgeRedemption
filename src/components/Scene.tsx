import clsx from 'clsx'
import type { Agent, AssetMap, GameState } from '../types'
import { DROPBOX_POS, LOCATION_POS, offsetPos, type Point } from '../lib/layout'
import { useChromaSprite } from '../hooks/useChromaSprite'

interface Props {
  state: GameState
  inmate: Agent
  inmate2: Agent
  friend: Agent
  guard: Agent
  assets: AssetMap
}

type Tint = 'orange' | 'sky' | 'red' | 'green'

function timeTint(time: GameState['time_of_day']): string {
  switch (time) {
    case 'morning': return 'sepia-0 saturate-100 brightness-105 hue-rotate-0'
    case 'noon':    return 'sepia-0 saturate-100 brightness-110'
    case 'evening': return 'saturate-150 brightness-95 hue-rotate-[-10deg]'
    case 'night':   return 'saturate-75 brightness-50 hue-rotate-[210deg]'
  }
}

function agentPositions(agents: Array<{ location: string; key: string }>): Map<string, Point> {
  const counts = new Map<string, number>()
  const result = new Map<string, Point>()
  for (const a of agents) {
    const loc = a.location as keyof typeof LOCATION_POS
    const base = LOCATION_POS[loc] ?? LOCATION_POS.yard
    const idx = counts.get(a.location) ?? 0
    counts.set(a.location, idx + 1)
    result.set(a.key, idx === 0 ? base : offsetPos(base, idx))
  }
  return result
}

export function Scene({ state, inmate, inmate2, friend, guard, assets }: Props) {
  const backdrop = assets['scene-backdrop']
  const inmateSprite = useChromaSprite(assets['sprite-inmate'])
  const inmate2Sprite = useChromaSprite(assets['sprite-inmate2'] ?? assets['sprite-inmate'])
  const friendSprite = useChromaSprite(assets['sprite-friend'])
  const guardSprite = useChromaSprite(assets['sprite-guard'])
  const hammer = useChromaSprite(assets['icon-hammer'])

  const positions = agentPositions([
    { location: inmate.location, key: 'inmate' },
    { location: inmate2.location, key: 'inmate2' },
    { location: friend.location, key: 'friend' },
    { location: guard.location, key: 'guard' },
  ])

  return (
    <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl bg-zinc-950">
      {backdrop ? (
        <img
          src={backdrop}
          alt=""
          className={clsx('pixel absolute inset-0 w-full h-full object-cover transition-[filter] duration-700', timeTint(state.time_of_day))}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 to-amber-900" />
      )}

      {state.world?.dropbox?.item === 'hammer' && hammer ? (
        <img
          src={hammer}
          alt="hammer"
          className="pixel absolute"
          style={{
            left: DROPBOX_POS.x,
            top: DROPBOX_POS.y,
            transform: 'translate(-50%, -50%)',
            width: '3%',
            filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.6))',
          }}
          draggable={false}
        />
      ) : null}

      <Sprite sprite={inmateSprite} pos={positions.get('inmate')!} tint="orange" label="Inmate" thought={inmate.memory?.thoughts?.at(-1)} />
      <Sprite sprite={inmate2Sprite} pos={positions.get('inmate2')!} tint="green" label="Inmate #2" thought={inmate2.memory?.thoughts?.at(-1)} />
      <Sprite sprite={friendSprite} pos={positions.get('friend')!} tint="sky" label="Friend" thought={friend.memory?.thoughts?.at(-1)} />
      <Sprite sprite={guardSprite} pos={positions.get('guard')!} tint="red" label="Guard" thought={guard.memory?.thoughts?.at(-1)} />

      <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs font-mono text-zinc-100 pointer-events-none">
        <div className="px-2 py-1 rounded bg-black/60 backdrop-blur">Tick {state.tick} · {state.time_of_day} · {state.weather}</div>
        <div className="px-2 py-1 rounded bg-black/60 backdrop-blur">
          Escape {state.world?.escape_progress ?? 0}%
        </div>
      </div>
      {state.status === 'escaped' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
          <div className="text-center">
            <div className="text-5xl font-bold text-amber-300 drop-shadow-lg mb-2">ESCAPED</div>
            <div className="text-sm text-zinc-200">The inmates broke through the wall under cover of rain.</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const TINT_SHADOW: Record<Tint, string> = {
  orange: 'drop-shadow-[0_4px_8px_rgba(251,146,60,0.55)]',
  sky:    'drop-shadow-[0_4px_8px_rgba(56,189,248,0.55)]',
  red:    'drop-shadow-[0_4px_8px_rgba(239,68,68,0.55)]',
  green:  'drop-shadow-[0_4px_8px_rgba(74,222,128,0.55)]',
}

const TINT_FALLBACK: Record<Tint, string> = {
  orange: 'bg-orange-500',
  sky:    'bg-sky-500',
  red:    'bg-red-500',
  green:  'bg-green-500',
}

const TINT_BUBBLE: Record<Tint, string> = {
  orange: 'bg-orange-950/90 border-orange-500/70 text-orange-100',
  sky:    'bg-sky-950/90 border-sky-500/70 text-sky-100',
  red:    'bg-red-950/90 border-red-500/70 text-red-100',
  green:  'bg-green-950/90 border-green-500/70 text-green-100',
}

const TINT_TAIL: Record<Tint, string> = {
  orange: 'border-t-orange-500/70',
  sky:    'border-t-sky-500/70',
  red:    'border-t-red-500/70',
  green:  'border-t-green-500/70',
}

function Sprite({ sprite, pos, tint, label, thought }: { sprite?: string; pos: Point; tint: Tint; label: string; thought?: string }) {
  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -50%)',
        transition: 'left 1.5s cubic-bezier(0.4, 0, 0.2, 1), top 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '12%',
      }}
    >
      {thought ? (
        <div
          key={thought}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-[clamp(100px,10vw,180px)]"
          style={{ animation: 'bubble-pop 0.3s ease-out' }}
        >
          <div className={clsx(
            'relative rounded-lg border-2 px-2 py-1.5',
            'font-pixel text-[8px] leading-snug text-center',
            TINT_BUBBLE[tint],
          )}>
            <p className="line-clamp-3">{thought}</p>
            <div className={clsx(
              'absolute top-full left-1/2 -translate-x-1/2',
              'w-0 h-0',
              'border-l-[6px] border-l-transparent',
              'border-r-[6px] border-r-transparent',
              'border-t-[6px]',
              TINT_TAIL[tint],
            )} />
          </div>
        </div>
      ) : null}
      {sprite ? (
        <img
          src={sprite}
          alt={label}
          className={clsx('pixel w-full', TINT_SHADOW[tint])}
          draggable={false}
        />
      ) : (
        <div className={clsx('w-full aspect-square rounded', TINT_FALLBACK[tint])} />
      )}
    </div>
  )
}
