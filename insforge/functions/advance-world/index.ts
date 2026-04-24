import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const TIME_ORDER = ['morning', 'noon', 'evening', 'night'] as const

function rollWeather(): 'rain' | 'sun' | 'fog' {
  const r = Math.random()
  if (r < 0.4) return 'rain'
  if (r < 0.75) return 'sun'
  return 'fog'
}

function nextTime(current: string): string {
  const i = TIME_ORDER.indexOf(current as typeof TIME_ORDER[number])
  return TIME_ORDER[(i + 1) % TIME_ORDER.length]
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  })

  const { data: current, error: getErr } = await client.database
    .from('game_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (getErr || !current) {
    return new Response(JSON.stringify({ error: getErr?.message ?? 'no game_state' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const tick = (current.tick ?? 0) + 1
  const time_of_day = nextTime(current.time_of_day ?? 'morning')
  const weather = rollWeather()

  const { data: updated, error: updErr } = await client.database
    .from('game_state')
    .update({ tick, time_of_day, weather, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single()

  if (updErr) {
    return new Response(JSON.stringify({ error: updErr.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  await client.database.from('action_log').insert([{
    agent_id: 'world',
    tick,
    action: 'advance',
    args: { weather, time_of_day },
    result: 'success',
    narration: `Tick ${tick} — ${time_of_day}, ${weather}.`,
  }])

  return new Response(JSON.stringify({ ok: true, state: updated }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
