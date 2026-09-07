// AirNow adapter — current observations -> the worst (max AQI) reading.
import type { AirQualityReading } from './types'

interface AirNowObs { ParameterName?: string; AQI?: number; Category?: { Name?: string } }

export function normalizeAirNow(raw: AirNowObs[]): AirQualityReading {
  const obs = (raw ?? []).filter(o => typeof o.AQI === 'number')
  if (obs.length === 0) return { aqi: 0, category: 'Unknown', parameter: '' }
  const worst = obs.reduce((a, b) => ((b.AQI ?? 0) > (a.AQI ?? 0) ? b : a))
  return { aqi: worst.AQI ?? 0, category: worst.Category?.Name ?? 'Unknown', parameter: worst.ParameterName ?? '' }
}
