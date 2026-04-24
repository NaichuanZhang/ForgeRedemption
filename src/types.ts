export type Location = 'cell' | 'library' | 'yard' | 'shop' | 'tunnel'
export type Weather = 'sun' | 'rain' | 'fog'
export type TimeOfDay = 'morning' | 'noon' | 'evening' | 'night'
export type Status = 'playing' | 'escaped'

export interface WorldBlob {
  dropbox: { item: 'hammer' | null }
  shop: { stock: string[] }
  escape_progress: number
}

export interface GameState {
  id: number
  tick: number
  time_of_day: TimeOfDay
  weather: Weather
  world: WorldBlob
  status: Status
  updated_at: string
}

export interface Memory {
  thoughts: string[]
  recent_actions: string[]
}

export interface Inventory {
  items: string[]
}

export interface Agent {
  id: 'inmate' | 'friend'
  role: 'inmate' | 'friend'
  location: Location
  skills: string[]
  inventory: Inventory
  memory: Memory
}

export type ActionResult = 'success' | 'failed' | 'blocked'

export interface ActionLogEntry {
  id: string
  agent_id: string
  tick: number
  action: string
  args: Record<string, unknown>
  result: ActionResult
  narration: string
  created_at: string
}

export interface AssetMap {
  'scene-backdrop'?: string
  'sprite-inmate'?: string
  'sprite-friend'?: string
  'icon-hammer'?: string
  'ui-tile-frame'?: string
}
