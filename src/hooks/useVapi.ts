import { useCallback, useEffect, useRef, useState } from 'react'
import { formatForGame, formatForTechExplainer } from '../lib/formatNarration'
import type { ActionLogEntry } from '../types'

type CallStatus = 'idle' | 'connecting' | 'active' | 'error'

const MAX_QUEUE = 10
const SPEECH_TIMEOUT_MS = 30_000

interface UseVapiOptions {
  mode: 'game' | 'tech-explainer'
  log: ActionLogEntry[]
  enabled: boolean
}

export interface UseVapiReturn {
  callStatus: CallStatus
  isSpeaking: boolean
  isMuted: boolean
  queueLength: number
  connect: () => Promise<void>
  disconnect: () => void
  toggleMute: () => void
}

export function useVapi({ mode, log, enabled }: UseVapiOptions): UseVapiReturn {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [queueLength, setQueueLength] = useState(0)

  const vapiRef = useRef<any>(null)
  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const narratedIdsRef = useRef(new Set<string>())
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const initRef = useRef(false)

  const updateQueueLength = useCallback(() => {
    setQueueLength(queueRef.current.length)
  }, [])

  const processQueue = useCallback(() => {
    const vapi = vapiRef.current
    if (!vapi || queueRef.current.length === 0) {
      processingRef.current = false
      updateQueueLength()
      return
    }

    processingRef.current = true
    const text = queueRef.current.shift()!
    updateQueueLength()

    vapi.send({ type: 'add-message', message: { role: 'user', content: text } })

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      processingRef.current = false
      processQueue()
    }, SPEECH_TIMEOUT_MS)
  }, [updateQueueLength])

  const handleSpeechEnd = useCallback(() => {
    setIsSpeaking(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    processingRef.current = false
    processQueue()
  }, [processQueue])

  const connect = useCallback(async () => {
    if (vapiRef.current && callStatus === 'active') return

    setCallStatus('connecting')
    try {
      const { default: Vapi } = await import('@vapi-ai/web')

      if (!vapiRef.current) {
        const instance = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY)

        instance.on('call-start', () => setCallStatus('active'))
        instance.on('call-end', () => {
          setCallStatus('idle')
          setIsSpeaking(false)
          processingRef.current = false
          queueRef.current = []
          setQueueLength(0)
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
        })
        instance.on('speech-start', () => setIsSpeaking(true))
        instance.on('speech-end', handleSpeechEnd)
        instance.on('error', () => setCallStatus('error'))

        vapiRef.current = instance
        initRef.current = true
      }

      await vapiRef.current.start(import.meta.env.VITE_VAPI_ASSISTANT_ID)
    } catch {
      setCallStatus('error')
    }
  }, [callStatus, handleSpeechEnd])

  const disconnect = useCallback(() => {
    vapiRef.current?.stop()
    queueRef.current = []
    processingRef.current = false
    setQueueLength(0)
    setIsSpeaking(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const toggleMute = useCallback(() => {
    const vapi = vapiRef.current
    if (!vapi) return
    const next = !isMuted
    vapi.setMuted(next)
    setIsMuted(next)
  }, [isMuted])

  useEffect(() => {
    if (!enabled || callStatus !== 'active') return

    if (log.length === 0) {
      narratedIdsRef.current.clear()
      queueRef.current = []
      processingRef.current = false
      updateQueueLength()
      return
    }

    const formatter = mode === 'game' ? formatForGame : formatForTechExplainer
    const newEntries = log.filter(e => !narratedIdsRef.current.has(e.id))

    for (const entry of newEntries) {
      narratedIdsRef.current.add(entry.id)
      queueRef.current.push(formatter(entry))
    }

    if (queueRef.current.length > MAX_QUEUE) {
      const latest = queueRef.current[queueRef.current.length - 1]
      queueRef.current = [
        'Several events happened quickly. Here is the latest.',
        latest,
      ]
    }

    updateQueueLength()

    if (newEntries.length > 0 && !processingRef.current) {
      processQueue()
    }
  }, [log, enabled, callStatus, mode, processQueue, updateQueueLength])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      vapiRef.current?.stop()
    }
  }, [])

  return { callStatus, isSpeaking, isMuted, queueLength, connect, disconnect, toggleMute }
}
