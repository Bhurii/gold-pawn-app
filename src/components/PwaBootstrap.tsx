'use client'

import { useEffect } from 'react'
import { registerPushWorker } from '@/lib/push-client'

export default function PwaBootstrap() {
  useEffect(() => {
    void registerPushWorker()
  }, [])

  return null
}
