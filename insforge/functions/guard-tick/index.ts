import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const CLAUDE_MODEL = 'anthropic/claude-sonnet-4.5'

type Location = 'cell' | 'cell2' | 'library' | 'yard' | 'shop' | 'gate' | 'tunnel'

interface DecidedAction {
  action: string
  args: Record<string, unknown>
  reasoning: string
}

function extractJson(text: string): DecidedAction | null {
  if (!text) return null
  try { return JSON.parse(text) } catch {}
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

function bound<T>(arr: T[], max: number): T[] {
  return arr.length <= max ? arr : arr.slice(arr.length - max)
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  })

  const { data: state } = await client.database.from('game_state').select('*').eq('id', 1).single()
  const { data: guard } = await client.database.from('agents').select('*').eq('id', 'guard').single()
  if (!state || !guard) return json(500, { error: 'missing state' })

  if (state.status === 'escaped') {
    return json(200, { action: 'noop', result: 'blocked', narration: 'The prisoners are gone.' })
  }

  const { data: allAgents } = await client.database.from('agents').select('id, location').in('id', ['inmate', 'inmate2'])
  const inmateLocations = (allAgents ?? []).map((a: any) => ({ id: a.id, location: a.location }))

  const skills: string[] = guard.skills ?? []
  const recentThoughts: string[] = bound(guard.memory?.thoughts ?? [], 5)

  if (state.time_of_day === 'night') {
    const narration = 'Guard dozes off at the desk during the night shift.'
    const thoughts = guard.memory?.thoughts ?? []
    const recent = guard.memory?.recent_actions ?? []
    await client.database.from('agents').update({
      memory: {
        thoughts: bound([...thoughts, 'Night shift… so tired… zzz'], 10),
        recent_actions: bound([...recent, 'slack_off'], 10),
      },
    }).eq('id', 'guard')
    await client.database.from('action_log').insert([{
      agent_id: 'guard',
      tick: state.tick,
      action: 'slack_off',
      args: { reason: 'night' },
      result: 'success',
      narration,
    }])
    return json(200, { action: 'slack_off', result: 'success', narration })
  }

  const systemPrompt = [
    'You are the Prison Guard — stern, suspicious, and dedicated to preventing escape.',
    'You decide ONE action per turn. Respond with STRICT JSON only:',
    '{"action": "<skill>", "args": {...}, "reasoning": "<one short sentence>"}',
    '',
    'Available skills:',
    '  patrol      args: {"to": "cell"|"cell2"|"library"|"yard"}  — walk to a location to watch prisoners. cell is Inmate\'s cell, cell2 is Inmate #2\'s cell.',
    '  slack_off   args: {}                                — stay where you are and slack off.',
    '',
    'Strategy: patrol to wherever prisoners are acting suspiciously.',
    'If a prisoner is at the yard (near the dropbox), that is suspicious.',
    'If a prisoner is at the cell during rain at night, they might dig.',
    'Move around to keep prisoners on their toes. Do not always go to the same place.',
  ].join('\n')

  const userPrompt = {
    world: {
      tick: state.tick,
      weather: state.weather,
      time_of_day: state.time_of_day,
      escape_progress: state.world?.escape_progress ?? 0,
    },
    self: {
      location: guard.location,
      recent_thoughts: recentThoughts,
    },
    prisoner_locations: inmateLocations,
  }

  const completion = await client.ai.chat.completions.create({
    model: CLAUDE_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Current state:\n${JSON.stringify(userPrompt, null, 2)}\n\nReply with JSON only.` },
    ],
    temperature: 0.8,
    maxTokens: 300,
  } as any).catch((e: Error) => ({ error: e.message }))

  const content: string = (completion as any)?.choices?.[0]?.message?.content ?? ''
  const decided = extractJson(content) ?? { action: 'patrol', args: { to: 'yard' }, reasoning: '(LLM parse failed — default patrol)' }

  const result = await dispatch(client, guard, decided)

  await client.database.from('action_log').insert([{
    agent_id: 'guard',
    tick: state.tick,
    action: decided.action,
    args: decided.args ?? {},
    result: result.result,
    narration: result.narration,
  }])

  return json(200, { decided, result })
}

async function dispatch(client: any, guard: any, decided: DecidedAction): Promise<{ result: 'success' | 'failed' | 'blocked'; narration: string }> {
  const thoughts: string[] = guard.memory?.thoughts ?? []
  const recent: string[] = guard.memory?.recent_actions ?? []
  const pushThought = (t: string) => bound([...thoughts, t], 10)
  const pushAction = (a: string) => bound([...recent, a], 10)

  switch (decided.action) {
    case 'patrol': {
      const to = (decided.args as any)?.to as Location
      const allowed: Location[] = ['cell', 'cell2', 'library', 'yard']
      if (!allowed.includes(to)) {
        return blockWith(client, pushThought, pushAction, 'patrol', `Guard cannot patrol to ${to}.`)
      }
      await client.database.from('agents').update({
        location: to,
        memory: { thoughts: pushThought(`Patrolling to ${to}.`), recent_actions: pushAction(`patrol:${to}`) },
      }).eq('id', 'guard')
      return { result: 'success', narration: `Guard patrols to the ${to}.` }
    }

    case 'slack_off': {
      await client.database.from('agents').update({
        memory: { thoughts: pushThought('Taking it easy for a moment.'), recent_actions: pushAction('slack_off') },
      }).eq('id', 'guard')
      return { result: 'success', narration: `Guard slacks off at the ${guard.location}.` }
    }

    default:
      return blockWith(client, pushThought, pushAction, decided.action, `Unknown action ${decided.action}.`)
  }
}

async function blockWith(client: any, pushThought: (t: string) => string[], pushAction: (a: string) => string[], action: string, narration: string) {
  await client.database.from('agents').update({
    memory: { thoughts: pushThought(narration), recent_actions: pushAction(action) },
  }).eq('id', 'guard')
  return { result: 'blocked' as const, narration }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
