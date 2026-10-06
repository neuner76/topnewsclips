import type { AirQualityReading } from './types'

// AirNow current-observation row. AirNow retired /aq/observation/latLong/current/
// on 2026-09-30; the replacement /aq/observation/current/ziplatlong/ returns the
// same shape but in lowerCamelCase with the AQI under `nowcastAQI`. These readers
// accept BOTH the old PascalCase and the new camelCase so the parse is resilient
// across the migration. "No observations in range" comes back as a WebServiceError
// object (not an array) — airNowObsList maps that to [].
export interface AirNowObs {
  ParameterName?: string; parameter?: string; parameterName?: string
  AQI?: number; aqi?: number; nowcastAQI?: number
  Category?: { Name?: string } | string; category?: string; categoryName?: string
  ReportingArea?: string; reportingArea?: string
  Latitude?: number; latitude?: number
  Longitude?: number; longitude?: number
  DateObserved?: string; dateObserved?: string
  HourObserved?: number; hourObserved?: number
}

export function airNowObsList(body: unknown): AirNowObs[] {
  return Array.isArray(body) ? (body as AirNowObs[]) : []
}
export function airNowAqi(o: AirNowObs): number | undefined {
  const v = o.nowcastAQI ?? o.AQI ?? o.aqi
  return typeof v === 'number' ? v : undefined
}
export function airNowCategory(o: AirNowObs): string {
  const c = (o.Category && typeof o.Category === 'object' ? o.Category.Name : (o.Category as string | undefined)) ?? o.category ?? o.categoryName
  return c || 'Unknown'
}
export function airNowParameter(o: AirNowObs): string {
  return o.ParameterName ?? o.parameter ?? o.parameterName ?? ''
}
export function airNowReportingArea(o: AirNowObs): string | undefined {
  return o.ReportingArea ?? o.reportingArea
}
export function airNowLat(o: AirNowObs): number | undefined {
  const v = o.Latitude ?? o.latitude
  return typeof v === 'number' ? v : undefined
}
export function airNowLng(o: AirNowObs): number | undefined {
  const v = o.Longitude ?? o.longitude
  return typeof v === 'number' ? v : undefined
}

export function normalizeAirNow(raw: unknown): AirQualityReading {
  const obs = airNowObsList(raw).filter(o => typeof airNowAqi(o) === 'number')
  if (obs.length === 0) return { aqi: 0, category: 'Unknown', parameter: '', source: 'AirNow' }
  const worst = obs.reduce((a, b) => ((airNowAqi(b) ?? 0) > (airNowAqi(a) ?? 0) ? b : a))
  return { aqi: airNowAqi(worst) ?? 0, category: airNowCategory(worst), parameter: airNowParameter(worst), source: 'AirNow' }
}
