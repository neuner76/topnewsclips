// Importance v1 (§9). Countywide 0–100 score, NO proximity factor (proximity is
// per-user ranking, later). Pure. Weights are inline here; move to config if tuned.

export interface ImportanceInput {
  baseImportance: number // event_type.base_importance
  eventType: string
  fields?: Record<string, unknown> // customers, majorRoute, severity, aqi, …
  startedAt?: string // ISO
  isNovel?: boolean // caller: no same-type event touched the same place in 30 days
  now?: Date
}

export function computeImportance(i: ImportanceInput): number {
  const f = i.fields ?? {}
  let magnitude = 0
  switch (i.eventType) {
    case 'power_outage': {
      const customers = Number(f.customers) || 0
      if (customers > 0) magnitude = Math.min(40, 10 * Math.log10(customers))
      break
    }
    case 'road_closure':
    case 'road_incident':
      // +25 for US-101 or the only route to a community (CA-1, SFD over White's Hill).
      magnitude = f.majorRoute ? 25 : 10
      break
    case 'weather_alert':
    case 'coastal_flood': {
      const sev = String(f.severity ?? '').toLowerCase()
      magnitude = sev === 'extreme' ? 45 : sev === 'severe' ? 30 : sev === 'moderate' ? 15 : sev === 'minor' ? 5 : 0
      break
    }
    case 'air_quality': {
      const aqi = Number(f.aqi) || 0
      magnitude = Math.min(30, Math.max(0, (aqi - 100) / 5))
      break
    }
  }

  let urgency = 0
  if (i.startedAt) {
    const started = new Date(i.startedAt).getTime()
    const now = (i.now ?? new Date()).getTime()
    if (Number.isFinite(started) && now >= started && now - started <= 2 * 3600 * 1000) urgency = 10
  }

  const novelty = i.isNovel ? 10 : 0
  return Math.max(0, Math.min(100, Math.round(i.baseImportance + magnitude + urgency + novelty)))
}
