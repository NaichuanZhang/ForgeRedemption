import clsx from 'clsx'
import type { UseVapiReturn } from '../hooks/useVapi'

type Props = Pick<UseVapiReturn, 'callStatus' | 'isSpeaking' | 'isMuted' | 'queueLength'> & {
  onConnect: () => void
  onDisconnect: () => void
  onToggleMute: () => void
}

export function NarratorControl({
  callStatus,
  isSpeaking,
  isMuted,
  queueLength,
  onConnect,
  onDisconnect,
  onToggleMute,
}: Props) {
  return (
    <div className="flex items-center gap-2 border border-zinc-700/60 rounded-lg bg-zinc-950/70 backdrop-blur-sm px-3 py-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Narrator</span>

      {callStatus === 'idle' && (
        <button
          onClick={onConnect}
          className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors"
        >
          Connect Voice
        </button>
      )}

      {callStatus === 'connecting' && (
        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 text-zinc-500 animate-pulse">
          Connecting…
        </span>
      )}

      {callStatus === 'active' && (
        <>
          <button
            onClick={onDisconnect}
            className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            Disconnect
          </button>
          <button
            onClick={onToggleMute}
            className={clsx(
              'text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded transition-colors',
              isMuted
                ? 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
            )}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          {isSpeaking && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-400">Speaking</span>
            </span>
          )}
        </>
      )}

      {callStatus === 'error' && (
        <button
          onClick={onConnect}
          className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-red-800 text-red-200 hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      )}

      {queueLength > 0 && (
        <span className="text-[10px] font-mono text-zinc-500">{queueLength} queued</span>
      )}
    </div>
  )
}
