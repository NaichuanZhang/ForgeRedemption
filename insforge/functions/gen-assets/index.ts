import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

interface AssetSpec {
  key: string
  prompt: string
  size: `${number}x${number}`
}

const ASSETS: AssetSpec[] = [
  {
    key: 'scene-backdrop',
    size: '1536x512',
    prompt: 'side-scrolling pixel-art prison scene spanning four zones left to right: a barred stone prison cell on the far left, an arched library doorway with wooden bookshelves visible, a muddy open prison yard with a wooden crate dropbox center and high chain-link fence, and a small hammer-shop storefront with a wooden HAMMERS signboard on the far right. retro 16-bit aesthetic, muted dusk palette with purple and amber tones, flat parallax, dramatic lighting, no characters, no text other than the HAMMERS sign.',
  },
  {
    key: 'sprite-inmate',
    size: '512x512',
    prompt: 'pixel-art character sprite of an adult man in an orange prison jumpsuit, short dark hair, serious expression, standing facing slightly right, full body visible, retro 16-bit video game aesthetic, chunky pixels, centered on a plain white background.',
  },
  {
    key: 'sprite-friend',
    size: '512x512',
    prompt: 'pixel-art character sprite of a casual young man in a grey hoodie, blue jeans, brown boots, carrying a tan leather satchel over one shoulder, standing facing slightly right, full body visible, retro 16-bit video game aesthetic, chunky pixels, centered on a plain white background.',
  },
  {
    key: 'icon-hammer',
    size: '512x512',
    prompt: 'pixel-art icon of a claw hammer, wooden handle, iron head, diagonal 45-degree angle, retro 16-bit video game aesthetic, chunky pixels, centered on a plain white background.',
  },
]

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  })

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const only: string[] | undefined = body?.only
  const specs = only ? ASSETS.filter(a => only.includes(a.key)) : ASSETS

  const results: Array<{ key: string; url?: string; error?: string }> = []

  for (const spec of specs) {
    try {
      const gen = await client.ai.images.generate({
        model: 'google/gemini-3-pro-image-preview',
        prompt: spec.prompt,
        size: spec.size,
      })

      const item = gen?.data?.[0]
      const b64 = item?.b64_json
      const urlFromGen = item?.url

      let blob: Blob
      if (b64) {
        const bytes = base64ToBytes(b64)
        blob = new Blob([bytes], { type: 'image/png' })
      } else if (urlFromGen) {
        const fetched = await fetch(urlFromGen)
        blob = await fetched.blob()
      } else {
        throw new Error('image gen returned no b64_json or url')
      }

      const path = `${spec.key}-${Date.now()}.png`
      const file = new File([blob], path, { type: 'image/png' })
      const upload = await client.storage.from('game-assets').upload(path, file)

      if (upload.error || !upload.data) {
        throw new Error(upload.error?.message ?? 'upload failed')
      }
      const storageKey = (upload.data as any).key ?? path
      const publicUrl = (upload.data as any).url

      await client.database.from('assets').upsert([{
        key: spec.key,
        url: publicUrl,
        storage_key: storageKey,
      }], { onConflict: 'key' } as any)

      results.push({ key: spec.key, url: publicUrl })
    } catch (e) {
      results.push({ key: spec.key, error: (e as Error).message })
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
