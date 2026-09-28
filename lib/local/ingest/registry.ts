import type { SourceAdapter } from './types'
import { nwsAlertsAdapter } from './adapters/nws-alerts'

// slug -> adapter. Only sources with a registered adapter are dispatched; the
// rest of the `local_source` registry (to-build / dropped) sit inert until an
// adapter lands here.
export const LOCAL_ADAPTERS: Record<string, SourceAdapter> = {
  [nwsAlertsAdapter.slug]: nwsAlertsAdapter,
}

export function adapterFor(slug: string): SourceAdapter | undefined {
  return LOCAL_ADAPTERS[slug]
}
