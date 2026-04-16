// Pre-warm the disk cache by hitting every neighborhood × occasion combo once.
// Run after the server is up: `npm run prewarm` (server must be running).
// Writes cache.json beside server.js. After this, the app serves zero-latency
// from cache and burns no quota until TTLs expire.

import axios from 'axios'

const CITIES = {
  Bangalore: [
    'Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'Marathahalli',
    'Jayanagar', 'JP Nagar', 'BTM Layout', 'Electronic City', 'Sarjapur Road',
    'Bellandur', 'MG Road', 'Church Street', 'Malleshwaram', 'Rajajinagar',
    'Banashankari', 'Hebbal', 'Frazer Town', 'Domlur', 'Ulsoor',
  ],
  Gurgaon: [
    'Cyber Hub', 'Sector 29', 'Golf Course Road', 'MG Road Gurgaon',
    'Sohna Road', 'DLF Phase 1', 'DLF Phase 3', 'Galleria Market',
    'Sector 14', 'Nirvana Country',
  ],
}

const OCCASIONS = ['date_night', 'family', 'friends']
const BASE_URL = process.env.PREWARM_URL || 'http://localhost:3001'
const DELAY_MS = Number(process.env.PREWARM_DELAY_MS || 1500)

const allJobs = []
for (const [city, hoods] of Object.entries(CITIES)) {
  for (const hood of hoods) {
    for (const occ of OCCASIONS) {
      allJobs.push({ city, hood, occ })
    }
  }
}

console.log(`Pre-warming ${allJobs.length} neighborhood × occasion combos`)
console.log(`Target: ${BASE_URL} · delay: ${DELAY_MS}ms\n`)

let ok = 0, fail = 0, videoCount = 0

for (let i = 0; i < allJobs.length; i++) {
  const { city, hood, occ } = allJobs[i]
  const label = `[${String(i + 1).padStart(2, '0')}/${allJobs.length}] ${city}/${hood}/${occ}`
  try {
    const r = await axios.get(`${BASE_URL}/api/places`, {
      params: { neighborhood: hood, occasion: occ },
      timeout: 30000,
    })
    const count = r.data.places?.length || 0
    const videos = r.data.places?.reduce((s, p) => s + (p._videoCount || 0), 0) || 0
    videoCount += videos
    console.log(`✓ ${label} — ${count} places, ${videos} videos`)
    ok++
  } catch (e) {
    console.warn(`✗ ${label} — ${e.response?.data?.error || e.message}`)
    fail++
  }
  // Small delay between calls so we don't saturate the server or YouTube quota
  if (i < allJobs.length - 1) await new Promise(r => setTimeout(r, DELAY_MS))
}

console.log(`\nDone. ${ok} ok · ${fail} failed · ${videoCount} total videos cached`)
console.log('Check cache.json to confirm persistence.')
