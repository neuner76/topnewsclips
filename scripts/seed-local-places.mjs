// Seed the Build-A saved places into local_saved_places.
// Public places (Novato / Marin / West Marin) are centroid point + radius from
// lib/local/seed-places.json. "Near Me" (private home) is seeded ONLY when
// LOCAL_HOME_LAT / LOCAL_HOME_LNG are set — never from source control.
// Idempotent: deletes the seed labels first, then re-inserts.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const HOME_LAT = process.env.LOCAL_HOME_LAT ?? env.LOCAL_HOME_LAT
const HOME_LNG = process.env.LOCAL_HOME_LNG ?? env.LOCAL_HOME_LNG

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const pointEwkt = (lng, lat) => `SRID=4326;POINT(${lng} ${lat})`

const publicPlaces = JSON.parse(fs.readFileSync(path.join('lib', 'local', 'seed-places.json'), 'utf8'))
const places = [...publicPlaces]

if (HOME_LAT && HOME_LNG) {
  places.push({
    label: 'Near Me', type: 'home', latitude: Number(HOME_LAT), longitude: Number(HOME_LNG),
    radiusMiles: 5, county: 'Marin County', state: 'CA', isPrivate: true,
  })
  console.log('Near Me: seeding from LOCAL_HOME_LAT/LNG (private)')
} else {
  console.log('Near Me: skipped (LOCAL_HOME_LAT/LOCAL_HOME_LNG not set)')
}

const labels = places.map(p => p.label)
await sb.from('local_saved_places').delete().in('label', labels)

for (const p of places) {
  const { error } = await sb.from('local_saved_places').insert({
    label: p.label, type: p.type,
    center: pointEwkt(p.longitude, p.latitude), radius_miles: p.radiusMiles,
    zip_code: p.zipCode ?? null, city: p.city ?? null, county: p.county ?? null,
    state: p.state ?? null, is_private: p.isPrivate,
  })
  console.log(`  ${error ? 'ERROR ' + p.label + ': ' + error.message : 'seeded ' + p.label}`)
}

const { data } = await sb.from('local_saved_places').select('label,type,radius_miles,city,county,is_private').order('label')
console.log('\nlocal_saved_places now:')
for (const r of data ?? []) console.log('  ', JSON.stringify(r))
