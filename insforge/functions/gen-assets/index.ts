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
    size: '1536x960',
    prompt: 'top-down pixel-art world map titled FORGEREDEMPTION WORLD MAP, retro 16-bit aesthetic with chunky pixels. The map is split left-right. LEFT SIDE (roughly 40 percent of width) OUTSIDE AREA: green checkered grass ground, scattered pixel-art trees with dark green canopies on brown trunks, small grass tufts, tiny rocks. A winding brown dirt path runs vertically through the center of the outside area from top to bottom. Upper-left: a HAMMER SHOP building with gray stone walls, a wooden sign reading SHOP, small windows, wooden door, peaked slate roof. Lower-left: a glowing blue swirling portal arch crackling with digital energy particles, labeled PORTAL, sitting on the green grass near scattered pixel-art trees. The outside area feels open and pastoral. RIGHT SIDE (roughly 60 percent of width) PRISON COMPOUND: thick gray stone perimeter wall with square corner watchtowers with crenellated tops. Inside the walls the floor is purple lavender checkered tiles. Upper-right inside the compound: CELL 1 and CELL 2 side by side, small rooms with barred doors, each containing a simple bed. Center-right: open PRISON YARD area, the largest open space inside walls. Lower-right inside the compound: a LIBRARY room with bookshelves lining the walls and a reading desk. A main gate opening sits at the left edge of the prison wall, connecting to the outside dirt path. Amber lantern glows on the prison walls. Bottom strip: a narrow legend bar showing colored squares labeled Outside area green, Dirt path brown, Building tan, Prison floor purple, Wall Tower gray, Guard NPC blue. Muted dusk palette, warm amber lantern glows, no characters, leave interiors uncluttered so overlayed sprites read clearly.',
  },
  {
    key: 'sprite-inmate',
    size: '512x512',
    prompt: 'top-down pixel-art character sprite of an adult man in a bright yellow prison uniform with a matching cap, viewed from above at a slight 3/4 angle so the head and shoulders are visible with arms at sides, retro 16-bit video game aesthetic, chunky pixels, centered on a plain white background.',
  },
  {
    key: 'sprite-friend',
    size: '512x512',
    prompt: 'top-down pixel-art character sprite of exactly one single stocky broad-shouldered casual young man in a green hoodie and dark jeans, carrying a small satchel, viewed from above at a slight 3/4 angle so the head and shoulders are visible, wide chunky body proportions, retro 16-bit video game aesthetic, chunky pixels, one character only, no other figures, centered on a plain white background.',
  },
  {
    key: 'sprite-guard',
    size: '512x512',
    prompt: 'top-down pixel-art character sprite of a stern prison guard in a dark navy uniform and peaked cap with a black baton at the hip, viewed from above at a slight 3/4 angle so the head and shoulders are visible, retro 16-bit video game aesthetic, chunky pixels, centered on a plain white background.',
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
