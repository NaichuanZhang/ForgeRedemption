import type { ActionLogEntry } from '../types'

export type Feature =
  | 'postgres-read'
  | 'postgres-write'
  | 'realtime-broadcast'
  | 'claude-chat'
  | 'embeddings'
  | 'pgvector-rpc'
  | 'image-gen'
  | 'storage'
  | 'edge-function'
  | 'tinyfish-search'

export interface FeatureTrace {
  features: Feature[]
  edgeFunction: string
  notes?: string
}

const ALWAYS: Feature[] = ['edge-function', 'postgres-read', 'postgres-write', 'realtime-broadcast']

const AGENT_TO_FN: Record<string, string> = {
  inmate: 'inmate-tick',
  inmate2: 'inmate2-tick',
  friend: 'friend-tick',
  guard: 'guard-tick',
  world: 'advance-world',
}

export function traceAction(entry: ActionLogEntry): FeatureTrace {
  const edgeFunction = AGENT_TO_FN[entry.agent_id] ?? 'unknown'
  const base = new Set<Feature>(ALWAYS)

  if (entry.agent_id === 'world') {
    return { features: [...base], edgeFunction, notes: 'Tick advanced; weather rolled server-side' }
  }

  const isLLMDriven = entry.agent_id !== 'world'
  if (isLLMDriven) base.add('claude-chat')

  switch (entry.action) {
    case 'learn_from_library': {
      base.add('embeddings')
      base.add('pgvector-rpc')
      const q = typeof entry.args?.query === 'string' ? entry.args.query : ''
      return {
        features: [...base],
        edgeFunction,
        notes: q ? `Semantic search: "${q}"` : 'Semantic search over library',
      }
    }
    case 'search_web': {
      base.add('tinyfish-search')
      const q = typeof entry.args?.query === 'string' ? entry.args.query : ''
      return {
        features: [...base],
        edgeFunction,
        notes: q ? `TinyFish query: "${q}"` : 'TinyFish web search',
      }
    }
    case 'slack_off': {
      base.delete('claude-chat')
      return { features: [...base], edgeFunction, notes: 'Night slack-off — rule-based, no LLM call' }
    }
    case 'curfew': {
      base.delete('claude-chat')
      return { features: [...base], edgeFunction: 'advance-world', notes: 'Night lockdown enforcement' }
    }
    default:
      return { features: [...base], edgeFunction }
  }
}

export const FEATURE_META: Record<Feature, { label: string; group: 'insforge' | 'external'; short: string }> = {
  'postgres-read':      { label: 'Postgres SELECT',     group: 'insforge', short: 'SELECT' },
  'postgres-write':     { label: 'Postgres UPDATE',     group: 'insforge', short: 'UPDATE' },
  'realtime-broadcast': { label: 'Realtime broadcast',  group: 'insforge', short: 'Realtime' },
  'claude-chat':        { label: 'Claude Sonnet 4.5',   group: 'insforge', short: 'Claude 4.5' },
  'embeddings':         { label: 'OpenAI embeddings',   group: 'insforge', short: 'Embeddings' },
  'pgvector-rpc':       { label: 'pgvector RPC',        group: 'insforge', short: 'pgvector' },
  'image-gen':          { label: 'Gemini 3 Pro image',  group: 'insforge', short: 'Image gen' },
  'storage':            { label: 'Storage upload',      group: 'insforge', short: 'Storage' },
  'edge-function':      { label: 'Edge function',       group: 'insforge', short: 'Edge fn' },
  'tinyfish-search':    { label: 'TinyFish Search API', group: 'external', short: 'TinyFish' },
}

export interface Counters {
  edgeFn: number
  postgresReads: number
  postgresWrites: number
  realtimeBroadcasts: number
  claudeCalls: number
  embeddingCalls: number
  pgvectorSearches: number
  tinyfishSearches: number
}

export const ZERO_COUNTERS: Counters = {
  edgeFn: 0,
  postgresReads: 0,
  postgresWrites: 0,
  realtimeBroadcasts: 0,
  claudeCalls: 0,
  embeddingCalls: 0,
  pgvectorSearches: 0,
  tinyfishSearches: 0,
}

export function countFromLog(entries: ActionLogEntry[]): Counters {
  return entries.reduce<Counters>((acc, entry) => {
    const { features } = traceAction(entry)
    return {
      edgeFn: acc.edgeFn + (features.includes('edge-function') ? 1 : 0),
      postgresReads: acc.postgresReads + (features.includes('postgres-read') ? 1 : 0),
      postgresWrites: acc.postgresWrites + (features.includes('postgres-write') ? 1 : 0),
      realtimeBroadcasts: acc.realtimeBroadcasts,
      claudeCalls: acc.claudeCalls + (features.includes('claude-chat') ? 1 : 0),
      embeddingCalls: acc.embeddingCalls + (features.includes('embeddings') ? 1 : 0),
      pgvectorSearches: acc.pgvectorSearches + (features.includes('pgvector-rpc') ? 1 : 0),
      tinyfishSearches: acc.tinyfishSearches + (features.includes('tinyfish-search') ? 1 : 0),
    }
  }, ZERO_COUNTERS)
}

export const FEATURE_GROUPS: { group: 'insforge' | 'external'; label: string; features: Feature[] }[] = [
  {
    group: 'insforge',
    label: 'InsForge Platform',
    features: [
      'postgres-write',
      'pgvector-rpc',
      'realtime-broadcast',
      'claude-chat',
      'embeddings',
      'image-gen',
      'storage',
      'edge-function',
    ],
  },
  {
    group: 'external',
    label: 'External Integrations',
    features: ['tinyfish-search'],
  },
]

export const FEATURE_DESCRIPTIONS: Record<Feature, string> = {
  'postgres-read': 'client.database SELECT — fetch game_state, agents, action_log',
  'postgres-write': 'client.database UPDATE / INSERT — mutates game_state and agents',
  'realtime-broadcast': 'Postgres trigger publishes to channel game:world',
  'claude-chat': 'anthropic/claude-sonnet-4.5 via client.ai.chat.completions',
  'embeddings': 'openai/text-embedding-3-small — 1536-dim query embedding',
  'pgvector-rpc': 'RPC search_library — IVFFlat cosine over library.embedding',
  'image-gen': 'google/gemini-3-pro-image-preview via client.ai.images.generate',
  'storage': 'client.storage.from(game-assets).upload — sprite PNGs',
  'edge-function': 'Deno edge function deployed via InsForge CLI',
  'tinyfish-search': 'api.search.tinyfish.ai — called from friend-tick with TINYFISH_API_KEY secret',
}
