// PurpleAir crowd-sensor air quality — the fallback when AirNow (official EPA
// monitors) has no reading near the point. PurpleAir reports raw PM2.5, so we
// apply the EPA (Barkjohn 2021) humidity correction, take the median of nearby
// outdoor sensors, and convert to AQI with the EPA breakpoints. Readings are
// tagged source: 'PurpleAir' so the UI can show these are crowd sensors, not
// official monitors. Needs a PurpleAir READ key (X-API-Key).
import type { AirQualityReading } from './types'

// EPA AQI breakpoints for PM2.5 (µg/m³), revised effective May 2024.
// [concentration low, concentration high, AQI low, AQI high]
const PM25_BREAKPOINTS: Array<[number, number, number, number]> = [
  [0.0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 500],
]

export function pm25ToAqi(pm: number): number {
  if (!Number.isFinite(pm) || pm < 0) return 0
  const c = Math.floor(pm * 10) / 10 // EPA truncates concentration to 0.1 µg/m³
  for (const [cLo, cHi, iLo, iHi] of PM25_BREAKPOINTS) {
    if (c <= cHi) return Math.round(((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo)
  }
  return 500
}

export function aqiCategory(aqi: number): string {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very Unhealthy'
  return 'Hazardous'
}

// EPA (Barkjohn 2021) US-wide correction for PurpleAir PM2.5 using relative
// humidity; adopted by AirNow's Fire & Smoke Map. Without humidity, use raw PM.
function correctPm25(pm: number, humidity: number | null): number {
  if (humidity == null || !Number.isFinite(humidity)) return pm
  return Math.max(0, 0.524 * pm - 0.0862 * humidity + 5.75)
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

interface PurpleAirResponse {
  fields?: string[]
  data?: Array<Array<number | string | null>>
}

export function normalizePurpleAir(raw: PurpleAirResponse): AirQualityReading | null {
  const fields = raw?.fields ?? []
  const iPm = fields.indexOf('pm2.5')
  const iHum = fields.indexOf('humidity')
  if (iPm < 0 || !Array.isArray(raw?.data)) return null

  const corrected: number[] = []
  for (const row of raw.data) {
    const pm = Number(row[iPm])
    if (!Number.isFinite(pm) || pm < 0) continue
    const hum = iHum >= 0 ? Number(row[iHum]) : NaN
    corrected.push(correctPm25(pm, Number.isFinite(hum) ? hum : null))
  }
  if (corrected.length === 0) return null

  const aqi = pm25ToAqi(median(corrected))
  return { aqi, category: aqiCategory(aqi), parameter: 'PM2.5', source: 'PurpleAir' }
}

// Query outdoor sensors seen in the last hour within ~radiusKm of the point.
export async function fetchPurpleAir(
  point: { lat: number; lng: number },
  apiKey: string,
  radiusKm = 15,
): Promise<AirQualityReading | null> {
  const dLat = radiusKm / 111
  const dLng = radiusKm / (111 * Math.cos((point.lat * Math.PI) / 180))
  const params = new URLSearchParams({
    fields: 'pm2.5,humidity,latitude,longitude',
    location_type: '0', // outdoor sensors only
    max_age: '3600', // reported within the last hour
    nwlng: String(point.lng - dLng),
    nwlat: String(point.lat + dLat),
    selng: String(point.lng + dLng),
    selat: String(point.lat - dLat),
  })
  const res = await fetch(`https://api.purpleair.com/v1/sensors?${params}`, {
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) throw new Error(`purpleair ${res.status}`)
  return normalizePurpleAir(await res.json())
}
