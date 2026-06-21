'use client'

import { useEffect } from 'react'
import { registerPushWorker } from '@/lib/push-client'

export default function PwaBootstrap() {
  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (!cancelled) {
        void registerPushWorker()
      }
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(run, { timeout: 1500 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(idleId)
      }
    }

    const timer = globalThis.setTimeout(run, 800)
    return () => {
      cancelled = true
      globalThis.clearTimeout(timer)
    }
  }, [])

  return null
}
