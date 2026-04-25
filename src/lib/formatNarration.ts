import { traceAction, FEATURE_META, FEATURE_DESCRIPTIONS } from './techMap'
import type { ActionLogEntry } from '../types'

const AGENT_LABELS: Record<string, string> = {
  inmate: 'Inmate',
  inmate2: 'Inmate Two',
  friend: 'Friend',
  guard: 'Guard',
  world: 'World',
}

export function formatForGame(entry: ActionLogEntry): string {
  const agent = AGENT_LABELS[entry.agent_id] ?? entry.agent_id
  return `${agent}. Tick ${entry.tick}. ${entry.narration}`
}

export function formatForTechExplainer(entry: ActionLogEntry): string {
  const trace = traceAction(entry)
  const agent = AGENT_LABELS[entry.agent_id] ?? entry.agent_id

  const featureLines = trace.features
    .map(f => `${FEATURE_META[f].label}: ${FEATURE_DESCRIPTIONS[f]}`)
    .join('; ')

  const parts = [
    `At tick ${entry.tick}, the ${agent} agent performed "${entry.action}" via edge function ${trace.edgeFunction}.`,
    `Result: ${entry.result}. Narration: "${entry.narration}"`,
    `InsForge features exercised: ${featureLines}.`,
  ]

  if (trace.notes) {
    parts.push(`Note: ${trace.notes}.`)
  }

  parts.push('Please explain what just happened and which infrastructure components were involved, in a friendly way.')

  return parts.join('\n')
}
