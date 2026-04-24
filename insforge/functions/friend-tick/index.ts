import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const CLAUDE_MODEL = 'anthropic/claude-sonnet-4.5'
type Location = 'cell' | 'cell2' | 'library' | 'yard' | 'shop' | 'gate' | 'portal' | 'tunnel'

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
  const { data: guard } = await client.database.from('agents').select('location').eq('id', 'guard').single()
  const { data: inmates } = await client.database.from('agents').select('id, inventory').in('id', ['inmate', 'inmate2'])
  if (!state || !friend) return json(500, { error: 'missing state' })

  const skills: string[] = friend.skills ?? []
  const inventory: string[] = friend.inventory?.items ?? []
  const recentThoughts: string[] = bound(friend.memory?.thoughts ?? [], 5)

  const inmateInfo = (inmates ?? []).map((a: any) => {
    const items: string[] = a.inventory?.items ?? []
    return `${a.id}: has ${items.length ? items.join(', ') : 'nothing'}`
  })

  const systemPrompt = [
    'You are the Outside Friend — a helpful accomplice working to smuggle hammers to TWO incarcerated friends (inmate and inmate2).',
    'Each inmate needs their own hammer to dig. You must deliver two hammers total via the yard dropbox.',
    'You decide ONE action per turn. You can ONLY use skills you currently possess.',
    'Respond with STRICT JSON only — no prose, no markdown fences — using this shape:',
    '{"action": "<skill>", "args": {...}, "reasoning": "<one short sentence>"}',
    '',
    'Available skills:',
    '  walk_to            args: {"to": "shop"|"gate"|"portal"}   — walk to a location. You can only go to shop, gate, or portal. You CANNOT enter the prison.',
    '  buy_hammer         args: {}                                — buy one hammer from the shop; must be at "shop". You can only carry one hammer at a time.',
    '  drop_at_gate       args: {}                                — drop a hammer at the prison gate dropbox; must be at "gate" with hammer in inventory.',
    '  search_web         args: {"query": "<search query>"}       — search the internet for useful info; must be at "portal". Try searching for diversion or distraction techniques.',
    '  create_distraction args: {}                                — create a distraction at the gate to lure the guard away; must be at "gate" and time must be "night". Learned via search_web.',
    '',
    'Plan: walk to shop → buy hammer → walk to gate → drop at gate → repeat until both inmates have hammers.',
    'Bonus: walk to portal → search_web for distraction techniques → walk to gate → wait for night → create_distraction to lure the guard to the gate.',
    'The dropbox at the gate is where inmates pick up hammers. Only one item fits in the dropbox at a time.',
    'Check which inmates already have a hammer and skip buying for them.',
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
    guard_location: guard?.location ?? 'unknown',
    inmates: inmateInfo,
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
      const allowed: Location[] = ['shop', 'gate', 'portal']
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
      const idx = stock.indexOf('hammer')
      const newStock = [...stock.slice(0, idx), ...stock.slice(idx + 1)]
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

    case 'drop_at_gate': {
      if (friend.location !== 'gate') {
        return blockWith(client, friend, pushThought, pushAction, 'drop_at_gate', 'Friend must be at the gate to drop.')
      }
      if (!inventory.includes('hammer')) {
        return blockWith(client, friend, pushThought, pushAction, 'drop_at_gate', 'Friend has no hammer to drop.')
      }
      if (state.world?.dropbox?.item) {
        return blockWith(client, friend, pushThought, pushAction, 'drop_at_gate', 'The dropbox already has an item.')
      }
      await client.database.from('game_state').update({
        world: { ...state.world, dropbox: { item: 'hammer' } },
        updated_at: new Date().toISOString(),
      }).eq('id', 1)
      await client.database.from('agents').update({
        inventory: { items: (() => { const j = inventory.indexOf('hammer'); return [...inventory.slice(0, j), ...inventory.slice(j + 1)] })() },
        memory: { thoughts: pushThought('Dropped hammer at the gate dropbox.'), recent_actions: pushAction('drop_at_gate') },
      }).eq('id', 'friend')
      return { result: 'success', narration: 'Friend drops the hammer at the prison gate.' }
    }

    case 'search_web': {
      if (friend.location !== 'portal') {
        return blockWith(client, friend, pushThought, pushAction, 'search_web', 'Friend must be at the portal to search the web.')
      }
      const query = String((decided.args as any)?.query ?? 'prison break help')
      const apiKey = Deno.env.get('TINYFISH_API_KEY')
      if (!apiKey) {
        return blockWith(client, friend, pushThought, pushAction, 'search_web', 'TinyFish API key not configured.')
      }
      const url = new URL('https://api.search.tinyfish.ai')
      url.searchParams.set('query', query)
      url.searchParams.set('language', 'en')

      let searchResults: Array<{ title: string; snippet: string }> = []
      try {
        const resp = await fetch(url.toString(), {
          headers: { 'X-API-Key': apiKey },
        })
        if (resp.status === 429) {
          return blockWith(client, friend, pushThought, pushAction, 'search_web', 'Portal overloaded — wait a turn.')
        }
        if (!resp.ok) {
          return blockWith(client, friend, pushThought, pushAction, 'search_web', `Portal search failed (HTTP ${resp.status}).`)
        }
        const json = await resp.json()
        searchResults = (json.results ?? []).slice(0, 3).map((r: any) => ({
          title: r.title ?? '',
          snippet: r.snippet ?? '',
        }))
      } catch (e) {
        return blockWith(client, friend, pushThought, pushAction, 'search_web', `Portal error: ${(e as Error).message}`)
      }

      const summaries = searchResults.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`).join(' | ')
      const thoughtText = summaries
        ? `Web search "${query}" found: ${summaries}`
        : `Web search "${query}" returned no results.`

      const newSkills = [...skills]
      const learned: string[] = []
      const distractionKeywords = ['distract', 'diversion', 'decoy', 'lure', 'divert']
      const queryLower = query.toLowerCase()
      const snippetsLower = searchResults.map(r => `${r.title} ${r.snippet}`.toLowerCase()).join(' ')
      const matchesDistraction = distractionKeywords.some(kw => queryLower.includes(kw) || snippetsLower.includes(kw))

      if (matchesDistraction && !newSkills.includes('create_distraction')) {
        newSkills.push('create_distraction')
        learned.push('create_distraction')
      }

      const narration = learned.length
        ? `Friend searched the portal for "${query}" and learned: ${learned.join(', ')}!`
        : `Friend searched the portal for "${query}".`

      await client.database.from('agents').update({
        skills: newSkills,
        memory: {
          thoughts: pushThought(thoughtText.slice(0, 300)),
          recent_actions: pushAction(`search_web:${query.slice(0, 50)}`),
        },
      }).eq('id', 'friend')

      return { result: 'success', narration }
    }

    case 'create_distraction': {
      if (friend.location !== 'gate') {
        return blockWith(client, friend, pushThought, pushAction, 'create_distraction', 'Friend must be at the gate to create a distraction.')
      }
      if (state.time_of_day !== 'night') {
        return blockWith(client, friend, pushThought, pushAction, 'create_distraction', 'Too risky in daylight — wait for night to create a distraction.')
      }
      if (state.world?.distraction_active) {
        return blockWith(client, friend, pushThought, pushAction, 'create_distraction', 'A distraction is already active.')
      }
      await client.database.from('game_state').update({
        world: { ...state.world, distraction_active: true },
        updated_at: new Date().toISOString(),
      }).eq('id', 1)
      await client.database.from('agents').update({
        location: 'gate',
        memory: {
          thoughts: pushThought('Heard a commotion at the gate — rushing to investigate!'),
          recent_actions: pushAction('distracted_to_gate'),
        },
      }).eq('id', 'guard')
      await client.database.from('agents').update({
        memory: {
          thoughts: pushThought('Created a distraction at the gate at night. Guard rushed over.'),
          recent_actions: pushAction('create_distraction'),
        },
      }).eq('id', 'friend')
      return { result: 'success', narration: 'Friend creates a commotion at the gate under cover of darkness — the guard rushes to the gate to investigate!' }
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
