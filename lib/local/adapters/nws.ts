// NWS adapter — forecast (wind/conditions) + active alerts (+ derived fire risk).
import type { Adapter, WindReading, FireRisk, NwsAlertSummary } from './types'

const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'

interface NwsForecastRaw { properties?: { periods?: Array<{ temperature?: number; windSpeed?: string; windDirection?: string; shortForecast?: string }> } }
interface NwsAlertsRaw { features?: Array<{ properties?: { event?: string; severity?: string; headline?: string; areaDesc?: string; onset?: string | null; expires?: string | null } }> }

// Parse "1 to 5 mph" / "10 mph" -> the upper number.
function parseMph(windSpeed?: string): number | undefined {
  if (!windSpeed) return undefined
  const nums = windSpeed.match(/\d+/g)
  if (!nums) return undefined
  return Math.max(...nums.map(Number))
}

export function normalizeNwsForecast(raw: NwsForecastRaw): { wind: WindReading; temperatureF?: number; shortForecast?: string } {
  const p = raw.properties?.periods?.[0] ?? {}
  return {
    wind: { text: p.windSpeed ?? '', speedMph: parseMph(p.windSpeed), direction: p.windDirection },
    temperatureF: p.temperature,
    shortForecast: p.shortForecast,
  }
}

const FIRE_EVENTS: Record<string, FireRisk['level']> = {
  'red flag warning': 'high',
  'extreme fire danger': 'extreme',
  'fire weather watch': 'elevated',
}

export function normalizeNwsAlerts(raw: NwsAlertsRaw): { alerts: NwsAlertSummary[]; fireRisk: FireRisk } {
  const alerts: NwsAlertSummary[] = (raw.features ?? []).map(f => ({
    event: f.properties?.event ?? 'Alert',
    severity: f.properties?.severity ?? 'Unknown',
    headline: f.properties?.headline ?? '',
    area: f.properties?.areaDesc ?? '',
    onset: f.properties?.onset ?? undefined,
    expires: f.properties?.expires ?? undefined,
  }))
  let fireRisk: FireRisk = { level: 'unknown', basis: 'no active fire-weather alert' }
  for (const a of alerts) {
    const level = FIRE_EVENTS[a.event.toLowerCase()]
    if (level) { fireRisk = { level, basis: a.event }; break }
  }
  return { alerts, fireRisk }
}

export const nwsForecastAdapter: Adapter<NwsForecastRaw, ReturnType<typeof normalizeNwsForecast>> = {
  id: 'nws-forecast', refreshMinutes: 15,
  fetchRaw: async () => {
    const res = await fetch('https://api.weather.gov/gridpoints/MTR/83,121/forecast', { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`NWS forecast HTTP ${res.status}`)
    return res.json()
  },
  normalize: normalizeNwsForecast,
}

export function nwsAlertsAdapter(lat: number, lng: number): Adapter<NwsAlertsRaw, ReturnType<typeof normalizeNwsAlerts>> {
  return {
    id: 'nws-alerts', refreshMinutes: 15,
    fetchRaw: async () => {
      const res = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lng}`, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`NWS alerts HTTP ${res.status}`)
      return res.json()
    },
    normalize: normalizeNwsAlerts,
  }
}
