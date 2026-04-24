import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const CLAUDE_MODEL = 'anthropic/claude-sonnet-4.5'
const EMBEDDING_MODEL = 'openai/text-embedding-3-small'

type Location = 'cell' | 'library' | 'yard' | 'shop' | 'tunnel'

interface LibraryHit {
  topic: string
  content: string
  distance: number
}

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

  const { data: state, error: stateErr } = await client.database
    .from('game_state').select('*').eq('id', 1).single()
  const { data: inmate, error: agentErr } = await client.database
    .from('agents').select('*').eq('id', 'inmate').single()

  if (stateErr || agentErr || !state || !inmate) {
    return jsonError(500, stateErr?.message ?? agentErr?.message ?? 'missing state')
  }

  if (state.status === 'escaped') {
    return jsonOk({ action: 'noop', result: 'blocked', narration: 'Inmate is long gone — the demo is over.' })
  }

  const skills: string[] = inmate.skills ?? []
  const inventory: string[] = inmate.inventory?.items ?? []
  const recentThoughts: string[] = bound(inmate.memory?.thoughts ?? [], 5)

  const systemPrompt = [
    'You are the Inmate — a pragmatic prisoner trying to escape.',
    'You decide ONE action per turn. You can ONLY use skills you currently possess.',
    'Respond with STRICT JSON only — no prose, no markdown fences — using this shape:',
    '{"action": "<skill>", "args": {...}, "reasoning": "<one short sentence>"}',
    '',
    'Available skills and what they do:',
    '  learn_from_library   args: {"query": "<what to search for>"}   — you must be at location "library".',
    '  move                 args: {"to": "cell"|"library"|"yard"}      — walk to a new location.',
    '  dig                  args: {}                                   — tunnel out; requires skill "dig" AND weather "rain".',
    '  pickup_from_dropbox  args: {}                                   — pick up item from yard dropbox; you must be at location "yard".',
    '',
    'Goal: escape by digging out. You need the "dig" skill first (learned from the library).',
    'A hammer in your inventory speeds digging 3x. A friend outside is trying to smuggle you one.',
    'Digging is only safe during RAIN (the noise cover matters). If weather is not rain, do something else.',
  ].join('\n')

  const userPrompt = {
    world: {
      tick: state.tick,
      weather: state.weather,
      time_of_day: state.time_of_day,
      escape_progress: state.world?.escape_progress ?? 0,
      dropbox: state.world?.dropbox,
    },
    self: {
      location: inmate.location,
      skills,
      inventory,
      recent_thoughts: recentThoughts,
    },
  }

  const completion = await client.ai.chat.completions.create({
    model: CLAUDE_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Current state:\n${JSON.stringify(userPrompt, null, 2)}\n\nReply with JSON only.` },
    ],
    temperature: 0.7,
    maxTokens: 400,
  } as any).catch((e: Error) => ({ error: e.message }))

  const content: string = (completion as any)?.choices?.[0]?.message?.content ?? ''
  const decided = extractJson(content) ?? { action: 'move', args: { to: 'library' }, reasoning: '(LLM parse failed — default fallback)' }

  const result = await dispatch(client, state, inmate, decided)

  await client.database.from('action_log').insert([{
    agent_id: 'inmate',
    tick: state.tick,
    action: decided.action,
    args: decided.args ?? {},
    result: result.result,
    narration: result.narration,
  }])

  return jsonOk({ decided, result })
}

async function dispatch(client: any, state: any, inmate: any, decided: DecidedAction): Promise<{ result: 'success' | 'failed' | 'blocked'; narration: string }> {
  const skills: string[] = inmate.skills ?? []
  const inventory: string[] = inmate.inventory?.items ?? []
  const thoughts: string[] = inmate.memory?.thoughts ?? []
  const recent: string[] = inmate.memory?.recent_actions ?? []

  const pushThought = (t: string) => bound([...thoughts, t], 10)
  const pushAction = (a: string) => bound([...recent, a], 10)

  if (!skills.includes(decided.action)) {
    const narration = `Inmate tried to ${decided.action} but doesn't have that skill.`
    await client.database.from('agents').update({
      memory: { thoughts: pushThought(`I don't know how to ${decided.action} yet.`), recent_actions: pushAction(decided.action) },
    }).eq('id', 'inmate')
    return { result: 'blocked', narration }
  }

  switch (decided.action) {
    case 'learn_from_library': {
      if (inmate.location !== 'library') {
        return blockWith(client, inmate, pushThought, pushAction, 'learn_from_library',
          'Inmate tried to study but isn\'t at the library.')
      }
      const query = String((decided.args as any)?.query ?? 'how to escape prison')
      const emb = await client.ai.embeddings.create({ model: EMBEDDING_MODEL, input: query })
        .catch(() => null)
      const vec = emb?.data?.[0]?.embedding
      let hits: LibraryHit[] = []
      if (vec) {
        const rpc = await client.database.rpc('search_library', { query_embedding: vec, match_count: 3 })
        hits = (rpc?.data ?? []) as LibraryHit[]
      } else {
        const fallback = await client.database
          .from('library').select('topic, content').ilike('content', `%${query.split(' ')[0]}%`).limit(3)
        hits = (fallback.data ?? []).map((r: any) => ({ ...r, distance: 0 }))
      }

      const newSkills = [...skills]
      const learned: string[] = []
      for (const h of hits) {
        if (h.topic.startsWith('digging-technique-') && !newSkills.includes('dig')) {
          newSkills.push('dig')
          learned.push('dig')
        }
      }

      const hitTopics = hits.map(h => h.topic).join(', ') || '(nothing relevant)'
      const narration = learned.length
        ? `Inmate searched "${query}" → found ${hitTopics}. Learned skill: ${learned.join(', ')}.`
        : `Inmate searched "${query}" → found ${hitTopics}. Nothing new learned.`

      await client.database.from('agents').update({
        skills: newSkills,
        memory: {
          thoughts: pushThought(`Library search '${query}' returned: ${hitTopics}`),
          recent_actions: pushAction('learn_from_library'),
        },
      }).eq('id', 'inmate')

      return { result: 'success', narration }
    }

    case 'move': {
      const to = (decided.args as any)?.to as Location
      const allowed: Location[] = ['cell', 'library', 'yard']
      if (!allowed.includes(to)) {
        return blockWith(client, inmate, pushThought, pushAction, 'move',
          `Inmate cannot move to ${to}.`)
      }
      await client.database.from('agents').update({
        location: to,
        memory: { thoughts: pushThought(`Moving to ${to}.`), recent_actions: pushAction(`move:${to}`) },
      }).eq('id', 'inmate')
      return { result: 'success', narration: `Inmate moves to the ${to}.` }
    }

    case 'dig': {
      if (inmate.location !== 'cell' && inmate.location !== 'tunnel') {
        return blockWith(client, inmate, pushThought, pushAction, 'dig',
          'Inmate can only dig from the cell.')
      }
      if (state.weather !== 'rain') {
        return blockWith(client, inmate, pushThought, pushAction, 'dig',
          'Too noisy — the guards would hear. Wait for rain.')
      }
      const hasHammer = inventory.includes('hammer')
      const gain = hasHammer ? 30 : 10
      const progress = Math.min(100, (state.world?.escape_progress ?? 0) + gain)
      const escaped = progress >= 100
      await client.database.from('game_state').update({
        world: { ...state.world, escape_progress: progress },
        status: escaped ? 'escaped' : 'playing',
        updated_at: new Date().toISOString(),
      }).eq('id', 1)
      await client.database.from('agents').update({
        location: 'tunnel',
        memory: {
          thoughts: pushThought(`Dug ${gain}% (${hasHammer ? 'with hammer' : 'bare hands'}). Total ${progress}%.`),
          recent_actions: pushAction('dig'),
        },
      }).eq('id', 'inmate')
      return {
        result: 'success',
        narration: escaped
          ? `🎉 Inmate breaks through the wall and escapes! Progress ${progress}%.`
          : `Inmate digs under cover of rain ${hasHammer ? '(hammer!)' : '(bare hands)'} → ${progress}% progress.`,
      }
    }

    case 'pickup_from_dropbox': {
      if (inmate.location !== 'yard') {
        return blockWith(client, inmate, pushThought, pushAction, 'pickup_from_dropbox',
          'Inmate must be at the yard to check the dropbox.')
      }
      const item = state.world?.dropbox?.item
      if (!item) {
        return blockWith(client, inmate, pushThought, pushAction, 'pickup_from_dropbox',
          'The dropbox is empty.')
      }
      const newInventory = { items: [...inventory, item] }
      await client.database.from('game_state').update({
        world: { ...state.world, dropbox: { item: null } },
        updated_at: new Date().toISOString(),
      }).eq('id', 1)
      await client.database.from('agents').update({
        inventory: newInventory,
        memory: {
          thoughts: pushThought(`Picked up ${item} from dropbox.`),
          recent_actions: pushAction(`pickup:${item}`),
        },
      }).eq('id', 'inmate')
      return { result: 'success', narration: `Inmate picks up the ${item} from the dropbox.` }
    }

    default:
      return blockWith(client, inmate, pushThought, pushAction, decided.action,
        `Unknown action ${decided.action}.`)
  }
}

async function blockWith(client: any, inmate: any, pushThought: (t: string) => string[], pushAction: (a: string) => string[], action: string, narration: string) {
  await client.database.from('agents').update({
    memory: { thoughts: pushThought(narration), recent_actions: pushAction(action) },
  }).eq('id', 'inmate')
  return { result: 'blocked' as const, narration }
}

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
