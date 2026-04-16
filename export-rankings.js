// Walks every neighborhood × occasion, dumps per-restaurant ranking database.
// Outputs rankings.csv (spreadsheet) + rankings.json (structured).
// Run after prewarm so everything serves from cache (no API calls).
//
// Columns explain WHY each restaurant ranks where:
//   _score       = final weighted score (0-100)
//   _socialBuzz  = 40% — YouTube video count (soft-cap at 5)
//   _quality     = 20% — Bayesian rating (dampens low-review outliers)
//   _proximity   = 15% — distance penalty from neighborhood center
//   _occasionFit = 15% — primaryType + price match for occasion
//   _recency     = 10% — freshness of cached YouTube videos

import axios from 'axios'
import fs from 'fs'

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
const BASE_URL = process.env.EXPORT_URL || 'http://localhost:5173'

const rows = []
const structured = []

for (const [city, hoods] of Object.entries(CITIES)) {
  for (const hood of hoods) {
    for (const occ of OCCASIONS) {
      try {
        const r = await axios.get(`${BASE_URL}/api/places`, {
          params: { neighborhood: hood, occasion: occ },
          timeout: 30000,
        })
        const places = r.data.places || []
        const block = {
          city, neighborhood: hood, occasion: occ,
          snapshotDate: r.data.meta?.snapshotDate,
          places: [],
        }
        places.forEach((p, i) => {
          const row = {
            city,
            neighborhood: hood,
            occasion: occ,
            rank: i + 1,
            name: p.displayName?.text || '',
            primaryType: p.primaryType || '',
            rating: p.rating || 0,
            reviewCount: p.userRatingCount || 0,
            priceLevel: p.priceLevel || '',
            distanceKm: p._distance?.toFixed(2) || '',
            videoCount: p._videoCount || 0,
            score: p._score || 0,
            socialBuzz: p._socialBuzz || 0,
            quality: p._quality || 0,
            proximity: p._proximity || 0,
            occasionFit: p._occasionFit || 0,
            recency: p._recency || 0,
          }
          rows.push(row)
          block.places.push(row)
        })
        structured.push(block)
        console.log(`✓ ${city}/${hood}/${occ} — ${places.length} rows`)
      } catch (e) {
        console.warn(`✗ ${city}/${hood}/${occ} — ${e.response?.data?.error || e.message}`)
      }
    }
  }
}

// ─── CSV ────────────────────────────────────────────────
const headers = [
  'city', 'neighborhood', 'occasion', 'rank', 'name', 'primaryType',
  'rating', 'reviewCount', 'priceLevel', 'distanceKm', 'videoCount',
  'score', 'socialBuzz', 'quality', 'proximity', 'occasionFit', 'recency',
]
const esc = v => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = [headers.join(',')]
for (const r of rows) csv.push(headers.map(h => esc(r[h])).join(','))
fs.writeFileSync('rankings.csv', csv.join('\n'))

// ─── JSON ───────────────────────────────────────────────
fs.writeFileSync('rankings.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  weights: { socialBuzz: 0.40, quality: 0.20, proximity: 0.15, occasionFit: 0.15, recency: 0.10 },
  totalRows: rows.length,
  blocks: structured,
}, null, 2))

console.log(`\nWrote ${rows.length} rows to rankings.csv + rankings.json`)
