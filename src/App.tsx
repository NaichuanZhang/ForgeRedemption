import { Scene } from './components/Scene'
import { WeatherOverlay } from './components/WeatherOverlay'
import { AgentHud } from './components/AgentHud'
import { WorldHud } from './components/WorldHud'
import { ActionLog } from './components/ActionLog'
import { useGameState } from './hooks/useGameState'

export function App() {
  const { state, inmate, friend, log, assets, loading, error, advanceTurn, resetWorld, turnInFlight } = useGameState()

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
  if (!state || !inmate || !friend) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        Waiting for initial state…
      </div>
    )
  }

  return (
    <div className="relative min-h-full flex flex-col">
      <WeatherOverlay weather={state.weather} />
      <div className="relative z-10 flex flex-col gap-4 p-4 max-w-[1400px] mx-auto w-full">
        <Scene state={state} inmate={inmate} friend={friend} assets={assets} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AgentHud agent={inmate} label="Inmate" accent="orange" />
          <WorldHud state={state} onAdvance={advanceTurn} onReset={resetWorld} busy={turnInFlight} />
          <AgentHud agent={friend} label="Outside Friend" accent="sky" />
        </div>
        <ActionLog entries={log} />
      </div>
    </div>
  )
}
