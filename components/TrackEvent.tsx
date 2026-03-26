'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export default function TrackEvent({ name, properties }: { name: string; properties?: Record<string, string> }) {
  useEffect(() => {
    track(name, properties)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
