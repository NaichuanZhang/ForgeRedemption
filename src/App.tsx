import { Scene } from './components/Scene'
import { WeatherOverlay } from './components/WeatherOverlay'
import { AgentHud } from './components/AgentHud'
import { WorldHud } from './components/WorldHud'
import { ActionLog } from './components/ActionLog'
import { useGameState } from './hooks/useGameState'

export function App() {
  const { state, inmate, inmate2, friend, guard, log, assets, loading, error, advanceTurn, resetWorld, turnInFlight, autoPlay, setAutoPlay } = useGameState()

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
