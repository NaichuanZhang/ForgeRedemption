const cache = new Map<string, Promise<string>>()

export function chromaKey(src: string, threshold = 230): Promise<string> {
  if (cache.has(src)) return cache.get(src)!
  const p = new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const px = data.data
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2]
        if (r > threshold && g > threshold && b > threshold) {
          px[i + 3] = 0
        } else if (r > threshold - 30 && g > threshold - 30 && b > threshold - 30) {
          px[i + 3] = 128
        }
      }
      ctx.putImageData(data, 0, 0)
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('toBlob failed'))
        resolve(URL.createObjectURL(blob))
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('img load failed'))
    img.src = src
  })
  cache.set(src, p)
  return p
}

export function revokeChromaKeyCache() {
  for (const p of cache.values()) {
    p.then(url => URL.revokeObjectURL(url)).catch(() => {})
  }
  cache.clear()
}
