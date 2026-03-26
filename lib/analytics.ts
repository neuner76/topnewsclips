'use client'

import posthog from 'posthog-js'

export function track(event: string, properties?: Record<string, string>) {
  try {
    posthog.capture(event, properties)
  } catch {
    // posthog not initialized (SSR or missing key)
  }
}
