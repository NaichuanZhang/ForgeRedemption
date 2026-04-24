import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const EMBEDDING_MODELS = [
  'openai/text-embedding-3-small',
  'openai/text-embedding-3-large',
  'openai/text-embedding-ada-002',
]

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  })

  const { data: rows, error } = await client.database
    .from('library')
    .select('id, topic, content, embedding')

  if (error || !rows) {
    return new Response(JSON.stringify({ error: error?.message ?? 'no library rows' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const pending = rows.filter((r: any) => !r.embedding)
  if (pending.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: rows.length }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let chosenModel: string | null = null
  for (const model of EMBEDDING_MODELS) {
    try {
      const probe = await client.ai.embeddings.create({ model, input: 'probe' })
      if (probe?.data?.[0]?.embedding) {
        chosenModel = model
        break
      }
    } catch {
      // try next
    }
  }

  if (!chosenModel) {
    return new Response(JSON.stringify({
      ok: false,
      reason: 'no_embedding_model',
      message: 'No embedding model enabled in the Insforge AI gateway. Enable an embedding model in the dashboard, or the demo will use keyword search instead.',
      pending: pending.map((r: any) => r.topic),
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const updated: string[] = []
  const failed: Array<{ topic: string; error: string }> = []

  for (const row of pending) {
    try {
      const resp = await client.ai.embeddings.create({
        model: chosenModel,
        input: row.content,
      })
      const vec = resp?.data?.[0]?.embedding
      if (!vec) throw new Error('empty embedding')
      const { error: updErr } = await client.database
        .from('library')
        .update({ embedding: vec })
        .eq('id', row.id)
      if (updErr) throw new Error(updErr.message)
      updated.push(row.topic)
    } catch (e) {
      failed.push({ topic: row.topic, error: (e as Error).message })
    }
  }

  return new Response(JSON.stringify({ ok: true, model: chosenModel, updated, failed }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
