import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const CLAUDE_MODEL = 'anthropic/claude-sonnet-4.5'
type Location = 'cell' | 'library' | 'yard' | 'shop'

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
  const { data: friend } = await client.database.from('agents').select('*').eq('id', 'friend').single()
  if (!state || !friend) return json(500, { error: 'missing state' })

  const skills: string[] = friend.skills ?? []
  const inventory: string[] = friend.inventory?.items ?? []
  const recentThoughts: string[] = bound(friend.memory?.thoughts ?? [], 5)

  const systemPrompt = [
    'You are the Outside Friend — a helpful accomplice working to smuggle a hammer to an incarcerated friend.',
    'You decide ONE action per turn. You can ONLY use skills you currently possess.',
    'Respond with STRICT JSON only — no prose, no markdown fences — using this shape:',
    '{"action": "<skill>", "args": {...}, "reasoning": "<one short sentence>"}',
    '',
    'Available skills:',
    '  walk_to         args: {"to": "shop"|"yard"}   — walk to a location.',
    '  buy_hammer      args: {}                       — buy a hammer; must be at "shop".',
    '  drop_in_yard    args: {}                       — drop the hammer in the yard dropbox; must be at "yard" with hammer in inventory.',
    '',
    'Plan: walk to shop → buy hammer → walk to yard → drop in yard → done.',
    'The dropbox in the yard is where your friend can pick it up.',
  ].join('\n')

  const userPrompt = {
    world: {
      tick: state.tick,
      weather: state.weather,
      dropbox: state.world?.dropbox,
      shop_stock: state.world?.shop?.stock ?? [],
    },
    self: {
      location: friend.location,
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
    temperature: 0.5,
    maxTokens: 300,
  } as any).catch((e: Error) => ({ error: e.message }))

  const content: string = (completion as any)?.choices?.[0]?.message?.content ?? ''
  const decided = extractJson(content) ?? { action: 'walk_to', args: { to: 'shop' }, reasoning: '(LLM parse failed — default)' }

  const result = await dispatch(client, state, friend, decided)

  await client.database.from('action_log').insert([{
    agent_id: 'friend',
    tick: state.tick,
    action: decided.action,
    args: decided.args ?? {},
    result: result.result,
    narration: result.narration,
  }])

  return json(200, { decided, result })
}

async function dispatch(client: any, state: any, friend: any, decided: DecidedAction): Promise<{ result: 'success' | 'failed' | 'blocked'; narration: string }> {
  const skills: string[] = friend.skills ?? []
  const inventory: string[] = friend.inventory?.items ?? []
  const thoughts: string[] = friend.memory?.thoughts ?? []
  const recent: string[] = friend.memory?.recent_actions ?? []
  const pushThought = (t: string) => bound([...thoughts, t], 10)
  const pushAction = (a: string) => bound([...recent, a], 10)

  if (!skills.includes(decided.action)) {
    return blockWith(client, friend, pushThought, pushAction, decided.action, `Friend doesn't have skill ${decided.action}.`)
  }

  switch (decided.action) {
    case 'walk_to': {
      const to = (decided.args as any)?.to as Location
      const allowed: Location[] = ['shop', 'yard']
      if (!allowed.includes(to)) {
        return blockWith(client, friend, pushThought, pushAction, 'walk_to', `Friend cannot walk to ${to}.`)
      }
      await client.database.from('agents').update({
        location: to,
        memory: { thoughts: pushThought(`Walking to ${to}.`), recent_actions: pushAction(`walk_to:${to}`) },
      }).eq('id', 'friend')
      return { result: 'success', narration: `Friend walks to the ${to}.` }
    }

    case 'buy_hammer': {
      if (friend.location !== 'shop') {
        return blockWith(client, friend, pushThought, pushAction, 'buy_hammer', 'Friend must be at the shop to buy.')
      }
      if (inventory.includes('hammer')) {
        return blockWith(client, friend, pushThought, pushAction, 'buy_hammer', 'Friend already has a hammer.')
      }
      const stock: string[] = state.world?.shop?.stock ?? []
      if (!stock.includes('hammer')) {
        return blockWith(client, friend, pushThought, pushAction, 'buy_hammer', 'The shop is out of hammers.')
      }
      const newStock = stock.filter((s: string) => s !== 'hammer')
      await client.database.from('game_state').update({
        world: { ...state.world, shop: { ...state.world.shop, stock: newStock } },
        updated_at: new Date().toISOString(),
      }).eq('id', 1)
      await client.database.from('agents').update({
        inventory: { items: [...inventory, 'hammer'] },
        memory: { thoughts: pushThought('Bought a hammer.'), recent_actions: pushAction('buy_hammer') },
      }).eq('id', 'friend')
      return { result: 'success', narration: 'Friend buys a hammer at the shop.' }
    }

    case 'drop_in_yard': {
      if (friend.location !== 'yard') {
        return blockWith(client, friend, pushThought, pushAction, 'drop_in_yard', 'Friend must be at the yard to drop.')
      }
      if (!inventory.includes('hammer')) {
        return blockWith(client, friend, pushThought, pushAction, 'drop_in_yard', 'Friend has no hammer to drop.')
      }
      if (state.world?.dropbox?.item) {
        return blockWith(client, friend, pushThought, pushAction, 'drop_in_yard', 'The dropbox already has an item.')
      }
      await client.database.from('game_state').update({
        world: { ...state.world, dropbox: { item: 'hammer' } },
        updated_at: new Date().toISOString(),
      }).eq('id', 1)
      await client.database.from('agents').update({
        inventory: { items: inventory.filter((i: string) => i !== 'hammer') },
        memory: { thoughts: pushThought('Dropped hammer in the yard dropbox.'), recent_actions: pushAction('drop_in_yard') },
      }).eq('id', 'friend')
      return { result: 'success', narration: 'Friend drops the hammer in the yard dropbox.' }
    }

    default:
      return blockWith(client, friend, pushThought, pushAction, decided.action, `Unknown action ${decided.action}.`)
  }
}

async function blockWith(client: any, friend: any, pushThought: (t: string) => string[], pushAction: (a: string) => string[], action: string, narration: string) {
  await client.database.from('agents').update({
    memory: { thoughts: pushThought(narration), recent_actions: pushAction(action) },
  }).eq('id', 'friend')
  return { result: 'blocked' as const, narration }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
