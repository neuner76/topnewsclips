'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export function NewsletterAnalytics() {
  useEffect(() => {
    track('newsletter_page_view', {})
  }, [])
  return null
}
