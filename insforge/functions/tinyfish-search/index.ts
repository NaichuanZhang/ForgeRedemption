const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const TINYFISH_URL = 'https://api.search.tinyfish.ai'

interface TinyfishResult {
  position: number
  site_name: string
  title: string
  snippet: string
  url: string
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  const body = await req.json().catch(() => null)
  const query = String(body?.query ?? '').trim()
  const max = clamp(parseInt(String(body?.max_results ?? '1'), 10) || 1, 1, 10)
  if (!query) return json(400, { error: 'query required (string)' })

  const apiKey = Deno.env.get('TINYFISH_API_KEY')
  const nexlaUrl = Deno.env.get('NEXLA_WEBHOOK_URL')
  if (!apiKey) return json(500, { error: 'TINYFISH_API_KEY not set' })
  if (!nexlaUrl) return json(500, { error: 'NEXLA_WEBHOOK_URL not set' })

  const tfRes = await fetch(`${TINYFISH_URL}?query=${encodeURIComponent(query)}`, {
    headers: { 'X-API-Key': apiKey },
  })
  if (!tfRes.ok) {
    return json(502, {
      error: 'tinyfish_request_failed',
      status: tfRes.status,
      body: await tfRes.text().catch(() => ''),
    })
  }
  const tfData = (await tfRes.json()) as { results?: TinyfishResult[] }
  const results = (tfData.results ?? []).slice(0, max)

  const sent: Array<{ url: string; ok: boolean; status?: number }> = []
  for (const r of results) {
    if (!r?.snippet || r.snippet.trim().length < 30) {
      sent.push({ url: r?.url ?? '', ok: false, status: 0 })
      continue
    }
    try {
      const res = await fetch(nexlaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'tinyfish',
          query,
          position: r.position,
          site_name: sanitize(r.site_name),
          title: sanitize(r.title),
          snippet: sanitize(r.snippet),
          url: r.url,
        }),
      })
      sent.push({ url: r.url, ok: res.ok, status: res.status })
    } catch {
      sent.push({ url: r.url, ok: false })
    }
  }

  return json(200, { query, fetched: results.length, sent })
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
function sanitize(s: string | undefined): string {
  if (!s) return ''
  return s
    .replace(/[•·]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[…]/g, '...')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
