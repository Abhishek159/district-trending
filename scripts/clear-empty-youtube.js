// Removes YouTube cache entries that are empty arrays — these are 403/quota
// stubs that shouldn't persist. Keeps entries with real videos intact.

import fs from 'fs'

const path = 'cache.json'
const cache = JSON.parse(fs.readFileSync(path, 'utf-8'))

const before = Object.keys(cache.youtube || {}).length
let removed = 0

for (const [key, entry] of Object.entries(cache.youtube || {})) {
  if (!entry.data || entry.data.length === 0) {
    delete cache.youtube[key]
    removed++
  }
}

fs.writeFileSync(path, JSON.stringify(cache, null, 2))
console.log(`YouTube cache: ${before} → ${before - removed} (removed ${removed} empty entries)`)
