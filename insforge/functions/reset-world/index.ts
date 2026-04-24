import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  })

  await client.database.from('game_state').update({
    tick: 0,
    time_of_day: 'morning',
    weather: 'sun',
    world: { dropbox: { item: null }, shop: { stock: ['hammer'] }, escape_progress: 0 },
    status: 'playing',
    updated_at: new Date().toISOString(),
  }).eq('id', 1)

  await client.database.from('agents').update({
    location: 'cell',
    skills: ['learn_from_library', 'move', 'pickup_from_dropbox'],
    inventory: { items: [] },
    memory: { thoughts: [], recent_actions: [] },
  }).eq('id', 'inmate')

  await client.database.from('agents').update({
    location: 'shop',
    skills: ['walk_to', 'buy_hammer', 'drop_in_yard'],
    inventory: { items: [] },
    memory: { thoughts: [], recent_actions: [] },
  }).eq('id', 'friend')

  await client.database.from('action_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  await client.database.from('action_log').insert([{
    agent_id: 'world',
    tick: 0,
    action: 'reset',
    args: {},
    result: 'success',
    narration: 'World reset. Inmate in cell. Friend at shop.',
  }])

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
