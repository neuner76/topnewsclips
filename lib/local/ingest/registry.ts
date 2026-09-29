import type { SourceAdapter } from './types'
import { nwsAlertsAdapter } from './adapters/nws-alerts'
import { bay511EventsAdapter } from './adapters/bay511-events'
import { caltransLcsAdapter } from './adapters/caltrans-lcs'
import { calfireIncidentsAdapter } from './adapters/calfire-incidents'
import { marinPermitsAdapter } from './adapters/marin-permits'
import { marinAgendasAdapter } from './adapters/marin-agendas'
import { nasaFirmsAdapter } from './adapters/nasa-firms'

// Every ingestion adapter, keyed by its local_source.slug. The dispatcher (D4) runs
// only sources that (a) are active in local_source and (b) appear here.
export const LOCAL_ADAPTERS: Record<string, SourceAdapter> = {
  [nwsAlertsAdapter.slug]: nwsAlertsAdapter,
  [bay511EventsAdapter.slug]: bay511EventsAdapter,
  [caltransLcsAdapter.slug]: caltransLcsAdapter,
  [calfireIncidentsAdapter.slug]: calfireIncidentsAdapter,
  [marinPermitsAdapter.slug]: marinPermitsAdapter,
  [marinAgendasAdapter.slug]: marinAgendasAdapter,
  [nasaFirmsAdapter.slug]: nasaFirmsAdapter,
}

export function adapterFor(slug: string): SourceAdapter | undefined {
  return LOCAL_ADAPTERS[slug]
}
