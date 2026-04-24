import { useEffect, useState } from 'react'
import { chromaKey } from '../lib/chromaKey'

export function useChromaSprite(src: string | undefined): string | undefined {
  const [keyed, setKeyed] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!src) { setKeyed(undefined); return }
    let cancelled = false
    chromaKey(src).then(url => { if (!cancelled) setKeyed(url) }).catch(() => {
      if (!cancelled) setKeyed(src)
    })
    return () => { cancelled = true }
  }, [src])
  return keyed
}
