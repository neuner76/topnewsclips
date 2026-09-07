// TopNewsClips Local — environmental adapter output (Task 8).
//
// Adapters fetch a source and normalize it to these shapes. The normalizers are
// pure (raw JSON -> reading) and unit-tested against committed fixtures; the
// fetch wrappers are thin I/O. Readings feed the "Your Environment" module;
// elevation into LocalEvents (thresholds/warnings) is handled in digest assembly.

export interface WindReading {
  text: string
  speedMph?: number
  gustMph?: number
  direction?: string
}

export type FireRiskLevel = 'low' | 'elevated' | 'high' | 'extreme' | 'unknown'
export interface FireRisk {
  level: FireRiskLevel
  basis: string
}

export interface AirQualityReading {
  aqi: number
  category: string
  parameter: string
}

export interface TideExtreme {
  type: 'H' | 'L'
  time: string // "YYYY-MM-DD HH:MM" local
  heightFt: number
}
export interface TideReading {
  station: string
  extremes: TideExtreme[]
  nextHigh?: TideExtreme
  nextLow?: TideExtreme
}

export interface NwsAlertSummary {
  event: string
  severity: string
  headline: string
  area: string
  onset?: string
  expires?: string
}

export interface QuakeSummary {
  magnitude: number
  place: string
  time: string // ISO
  latitude: number
  longitude: number
  distanceMiles?: number
}

export interface EnvironmentSnapshot {
  wind?: WindReading
  fireRisk?: FireRisk
  airQuality?: AirQualityReading
  tide?: TideReading
  activeAlerts: NwsAlertSummary[]
  recentEarthquakes: QuakeSummary[]
  thermalAnomalies?: { count: number }
  dataAsOf: string
}

// Shared adapter shape: a normalize (pure) + a thin fetchRaw (I/O). Callers track
// lastSuccessAt / lastError around run().
export interface Adapter<Raw, Out> {
  id: string
  refreshMinutes: number
  fetchRaw: () => Promise<Raw>
  normalize: (raw: Raw) => Out
}
