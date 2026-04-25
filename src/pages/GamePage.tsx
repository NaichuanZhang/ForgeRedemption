import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Scene } from '../components/Scene'
import { WeatherOverlay } from '../components/WeatherOverlay'
import { AgentHud } from '../components/AgentHud'
import { WorldHud } from '../components/WorldHud'
import { ActionLog } from '../components/ActionLog'
import { NarratorControl } from '../components/NarratorControl'
import { useGameState } from '../hooks/useGameState'
import { useVapi } from '../hooks/useVapi'

export function GamePage() {
  const { state, inmate, inmate2, friend, guard, log, assets, loading, error, advanceTurn, resetWorld, turnInFlight, autoPlay, setAutoPlay } = useGameState()
  const [narratorEnabled, setNarratorEnabled] = useState(false)
  const narrator = useVapi({ mode: 'game', log, enabled: narratorEnabled })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        Connecting to Insforge…
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        {error}
      </div>
    )
  }
  if (!state || !inmate || !inmate2 || !friend || !guard) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        Waiting for initial state…
      </div>
    )
  }

  return (
    <div className="relative min-h-full flex flex-col">
      <WeatherOverlay weather={state.weather} />
      <div className="relative z-10 flex flex-col gap-4 p-4 max-w-[1600px] mx-auto w-full">
        <div className="flex justify-end items-center gap-3">
          <NarratorControl
            callStatus={narrator.callStatus}
            isSpeaking={narrator.isSpeaking}
            isMuted={narrator.isMuted}
            queueLength={narrator.queueLength}
            onConnect={() => { setNarratorEnabled(true); narrator.connect() }}
            onDisconnect={() => { setNarratorEnabled(false); narrator.disconnect() }}
            onToggleMute={narrator.toggleMute}
          />
          <Link
            to="/tech-explainer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-emerald-300 border border-zinc-700/60 rounded-md px-3 py-1.5 bg-zinc-950/70 backdrop-blur-sm transition-colors"
          >
            View tech breakdown ↗
          </Link>
        </div>
        <Scene state={state} inmate={inmate} inmate2={inmate2} friend={friend} guard={guard} assets={assets} />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <AgentHud agent={inmate} label="Inmate" accent="orange" />
          <AgentHud agent={inmate2} label="Inmate #2" accent="green" />
          <WorldHud state={state} onAdvance={advanceTurn} onReset={resetWorld} busy={turnInFlight} autoPlay={autoPlay} onToggleAutoPlay={() => setAutoPlay(p => !p)} />
          <AgentHud agent={friend} label="Friend" accent="sky" />
          <AgentHud agent={guard} label="Guard" accent="red" />
        </div>
        <ActionLog entries={log} />
      </div>
    </div>
  )
}
