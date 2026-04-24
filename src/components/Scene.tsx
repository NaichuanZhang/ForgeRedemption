import clsx from 'clsx'
import type { Agent, AssetMap, GameState } from '../types'
import { DROPBOX_X, LOCATION_X } from '../lib/layout'
import { useChromaSprite } from '../hooks/useChromaSprite'

interface Props {
  state: GameState
  inmate: Agent
  friend: Agent
  assets: AssetMap
}

function timeTint(time: GameState['time_of_day']): string {
  switch (time) {
    case 'morning': return 'sepia-0 saturate-100 brightness-105 hue-rotate-0'
    case 'noon':    return 'sepia-0 saturate-100 brightness-110'
    case 'evening': return 'saturate-150 brightness-95 hue-rotate-[-10deg]'
    case 'night':   return 'saturate-75 brightness-50 hue-rotate-[210deg]'
  }
}

export function Scene({ state, inmate, friend, assets }: Props) {
  const backdrop = assets['scene-backdrop']
  const inmateSprite = useChromaSprite(assets['sprite-inmate'])
  const friendSprite = useChromaSprite(assets['sprite-friend'])
  const hammer = useChromaSprite(assets['icon-hammer'])

  return (
    <div className="relative w-full aspect-[3/1] rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl bg-zinc-950">
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
            left: DROPBOX_X,
            bottom: '24%',
            width: '5%',
            filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.6))',
          }}
          draggable={false}
        />
      ) : null}

      <Sprite sprite={inmateSprite} location={inmate.location} tint="orange" label="Inmate" />
      <Sprite sprite={friendSprite} location={friend.location} tint="sky" label="Friend" />

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
            <div className="text-sm text-zinc-200">The inmate broke through the wall under cover of rain.</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Sprite({ sprite, location, tint, label }: { sprite?: string; location: keyof typeof LOCATION_X; tint: 'orange' | 'sky'; label: string }) {
  const x = LOCATION_X[location] ?? '10%'
  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        left: x,
        bottom: '14%',
        transition: 'left 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '9%',
      }}
    >
      {sprite ? (
        <img
          src={sprite}
          alt={label}
          className={clsx('pixel w-full', tint === 'orange' ? 'drop-shadow-[0_4px_8px_rgba(251,146,60,0.55)]' : 'drop-shadow-[0_4px_8px_rgba(56,189,248,0.55)]')}
          draggable={false}
        />
      ) : (
        <div className={clsx('w-full aspect-square rounded', tint === 'orange' ? 'bg-orange-500' : 'bg-sky-500')} />
      )}
    </div>
  )
}
