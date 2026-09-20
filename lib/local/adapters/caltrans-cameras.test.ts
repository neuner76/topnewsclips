import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseCctvCameras, nearbyCameras, cleanCameraName } from './caltrans-cameras'

const raw = JSON.parse(fs.readFileSync(path.join('fixtures', 'sources', 'caltrans-cctv', 'sample.json'), 'utf8'))
const NOVATO = { lat: 38.1074, lng: -122.5697 }

describe('parseCctvCameras', () => {
  it('keeps only in-service cameras with coords + an image, cleaning the TV-prefix name', () => {
    const cams = parseCctvCameras(raw)
    expect(cams.length).toBe(2) // the out-of-service TV965 is dropped
    expect(cams.every(c => c.imageUrl.startsWith('http') && Number.isFinite(c.lat) && Number.isFinite(c.lng))).toBe(true)
    const cam = cams.find(c => c.route === 'US-101')!
    expect(cam.name).toBe('US-101 : Wilfred Avenue') // "TV127 -- " stripped
    expect(cam.county).toBe('Sonoma')
  })
})

describe('cleanCameraName', () => {
  it('strips the route prefix, drops "AT", and expands Caltrans codes', () => {
    expect(cleanCameraName('US-101', 'US-101 : AT JNO CENTRAL SRF')).toBe('Just North of Central San Rafael')
    expect(cleanCameraName('I-580', 'I-580 : AT WOF FRANCISCO BLVD')).toBe('West of Francisco Blvd')
    expect(cleanCameraName('US-101', 'US-101 :  JNO LINCOLN AV')).toBe('Just North of Lincoln Ave')
  })
})

describe('nearbyCameras', () => {
  it('returns cameras within the radius, nearest first, capped', () => {
    const cams = parseCctvCameras(raw)
    const near = nearbyCameras(cams, { near: NOVATO, radiusMiles: 20, limit: 4 })
    expect(near.length).toBe(1) // only the US-101 Sonoma cam is within 20 mi; Alameda is ~30+
    expect(near[0].route).toBe('US-101')
  })
})
