import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const EMBEDDING_MODEL = 'openai/text-embedding-3-small'

interface IngestItem {
  topic: string
  content: string
}

interface IngestResult {
  topic: string
  ok: boolean
  error?: string
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  const body = await req.json().catch(() => null)
  const items: IngestItem[] = Array.isArray(body?.items)
    ? body.items
    : body?.topic && body?.content
      ? [body as IngestItem]
      : []

  const cleaned = items.filter(
    (it) => typeof it?.topic === 'string' && typeof it?.content === 'string' && it.content.trim().length > 0,
  )

  if (cleaned.length === 0) {
    return json(400, { error: 'expected {items:[{topic,content}]} or {topic,content}' })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  })

  const results: IngestResult[] = []

  for (const { topic, content } of cleaned) {
    try {
      const emb = await client.ai.embeddings.create({ model: EMBEDDING_MODEL, input: content })
      const vec = emb?.data?.[0]?.embedding
      if (!vec) throw new Error('empty embedding')

      const { error } = await client.database
        .from('library')
        .upsert({ topic, content, embedding: vec }, { onConflict: 'topic' })

      if (error) throw new Error(error.message)
      results.push({ topic, ok: true })
    } catch (e) {
      results.push({ topic, ok: false, error: (e as Error).message })
    }
  }

  const ok = results.filter((r) => r.ok).length
  return json(200, { ingested: ok, failed: results.length - ok, results })
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
