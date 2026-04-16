import express from 'express'
import cors from 'cors'
import axios from 'axios'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

config()

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Disk-persisted cache ────────────────────────────────────────────
const CACHE_FILE = join(__dirname, 'cache.json')
// Frozen snapshot mode: TTLs set to Infinity so cache never expires.
// The 30 neighborhoods in cache.json become the permanent data source —
// no API calls fire while data exists, and the shared link serves the
// same rankings on day 1, day 30, day 100. To "unfreeze" and resume
// live fetching, set these back to 7d / 3d respectively.
const PLACES_TTL_MS  = Infinity
const YOUTUBE_TTL_MS = Infinity

let cache = { places: {}, youtube: {} }
try {
  if (fs.existsSync(CACHE_FILE)) {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    const placeCount = Object.keys(cache.places || {}).length
    const ytCount = Object.keys(cache.youtube || {}).length
    console.log(`Loaded cache: ${placeCount} neighborhoods, ${ytCount} YouTube entries`)
  }
} catch (err) {
  console.warn('Cache load failed, starting fresh:', err.message)
  cache = { places: {}, youtube: {} }
}

let saveTimer = null
function saveCache() {
  // debounce: batch writes within 500ms
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
    } catch (err) {
      console.warn('Cache save failed:', err.message)
    }
  }, 500)
}

function cacheGet(bucket, key, ttlMs) {
  const entry = cache[bucket]?.[key]
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > ttlMs) return null
  return entry.data
}

function cacheSet(bucket, key, data) {
  if (!cache[bucket]) cache[bucket] = {}
  cache[bucket][key] = { data, fetchedAt: Date.now() }
  saveCache()
}

const app = express()
app.use(cors())
app.use(express.json())

// Serve built React app in production
app.use(express.static(join(__dirname, 'dist')))

const PORT = process.env.PORT || 3001
const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY
// Falls back to PLACES_API_KEY if a separate YouTube key isn't set
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_PLACES_API_KEY

// 20 Bangalore + 10 Gurgaon dining/entertainment neighborhoods
const NEIGHBORHOODS = {
  // Bangalore
  Koramangala:       { lat: 12.9352, lng: 77.6245, city: 'Bangalore' },
  Indiranagar:       { lat: 12.9784, lng: 77.6408, city: 'Bangalore' },
  'HSR Layout':      { lat: 12.9116, lng: 77.6389, city: 'Bangalore' },
  Whitefield:        { lat: 12.9698, lng: 77.7499, city: 'Bangalore' },
  Marathahalli:      { lat: 12.9591, lng: 77.6974, city: 'Bangalore' },
  Jayanagar:         { lat: 12.9250, lng: 77.5938, city: 'Bangalore' },
  'JP Nagar':        { lat: 12.9082, lng: 77.5855, city: 'Bangalore' },
  'BTM Layout':      { lat: 12.9166, lng: 77.6101, city: 'Bangalore' },
  'Electronic City': { lat: 12.8452, lng: 77.6602, city: 'Bangalore' },
  'Sarjapur Road':   { lat: 12.9010, lng: 77.6874, city: 'Bangalore' },
  Bellandur:         { lat: 12.9258, lng: 77.6762, city: 'Bangalore' },
  'MG Road':         { lat: 12.9756, lng: 77.6066, city: 'Bangalore' },
  'Church Street':   { lat: 12.9747, lng: 77.6081, city: 'Bangalore' },
  Malleshwaram:      { lat: 13.0068, lng: 77.5692, city: 'Bangalore' },
  Rajajinagar:       { lat: 12.9915, lng: 77.5554, city: 'Bangalore' },
  Banashankari:      { lat: 12.9249, lng: 77.5536, city: 'Bangalore' },
  Hebbal:            { lat: 13.0358, lng: 77.5970, city: 'Bangalore' },
  'Frazer Town':     { lat: 13.0007, lng: 77.6143, city: 'Bangalore' },
  Domlur:            { lat: 12.9611, lng: 77.6387, city: 'Bangalore' },
  Ulsoor:            { lat: 12.9828, lng: 77.6204, city: 'Bangalore' },
  // Gurgaon
  'Cyber Hub':         { lat: 28.4954, lng: 77.0890, city: 'Gurgaon' },
  'Sector 29':         { lat: 28.4675, lng: 77.0644, city: 'Gurgaon' },
  'Golf Course Road':  { lat: 28.4459, lng: 77.0965, city: 'Gurgaon' },
  'MG Road Gurgaon':   { lat: 28.4789, lng: 77.0805, city: 'Gurgaon' },
  'Sohna Road':        { lat: 28.4080, lng: 77.0404, city: 'Gurgaon' },
  'DLF Phase 1':       { lat: 28.4745, lng: 77.1030, city: 'Gurgaon' },
  'DLF Phase 3':       { lat: 28.4947, lng: 77.0914, city: 'Gurgaon' },
  'Galleria Market':   { lat: 28.4677, lng: 77.0955, city: 'Gurgaon' },
  'Sector 14':         { lat: 28.4666, lng: 77.0311, city: 'Gurgaon' },
  'Nirvana Country':   { lat: 28.4108, lng: 77.0542, city: 'Gurgaon' },
}

// Place types to search for
const INCLUDED_TYPES = ['restaurant', 'cafe', 'bar', 'night_club']

// Field mask for the Places API (New)
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.currentOpeningHours',
  'places.regularOpeningHours',
  'places.types',
  'places.location',
  'places.formattedAddress',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.photos',
  'places.editorialSummary',
].join(',')

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Bayesian average constants — dampens outlier review counts
const BAYES_PRIOR_RATING = 4.0   // assumed average rating across all venues
const BAYES_MIN_REVIEWS  = 500   // weight of the prior (equivalent review count)

function bayesianRating(rating, reviewCount) {
  if (reviewCount === 0) return BAYES_PRIOR_RATING * 0.5
  return (rating * reviewCount + BAYES_PRIOR_RATING * BAYES_MIN_REVIEWS) / (reviewCount + BAYES_MIN_REVIEWS)
}

// ─── Ranking weights (sum to 1.0) ───────────────────────────
const WEIGHTS = {
  socialBuzz:  0.40,  // YouTube video count — DOMINANT signal
  quality:     0.20,  // Bayesian rating
  proximity:   0.15,  // distance from neighborhood center
  occasionFit: 0.15,  // type + price match for occasion
  recency:     0.10,  // how fresh the YouTube videos are
}

// Per-occasion preferred types + price tiers. Match on primaryType only.
const OCCASION_PROFILES = {
  date_night: {
    types: ['fine_dining_restaurant', 'rooftop_restaurant', 'wine_bar',
      'cocktail_bar', 'lounge', 'japanese_restaurant', 'french_restaurant',
      'seafood_restaurant', 'steak_house'],
    prices: ['PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'],
  },
  family: {
    types: ['cafe', 'ice_cream_shop', 'pizza_restaurant', 'indian_restaurant',
      'fast_food_restaurant', 'chinese_restaurant', 'buffet_restaurant',
      'south_indian_restaurant', 'north_indian_restaurant'],
    prices: ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE'],
  },
  friends: {
    types: ['bar', 'night_club', 'sports_bar', 'pub', 'brewery',
      'mexican_restaurant', 'korean_restaurant', 'live_music_venue',
      'american_restaurant', 'barbecue_restaurant'],
    prices: ['PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE'],
  },
}

function occasionSubScore(primaryType, priceLevel, occasion) {
  const profile = OCCASION_PROFILES[occasion]
  if (!profile) return 0
  const typeMatch = profile.types.includes((primaryType || '').toLowerCase())
  const priceMatch = profile.prices.includes(priceLevel)
  // 70% weight on type, 30% on price — type is more important signal
  return (typeMatch ? 70 : 0) + (priceMatch ? 30 : 0)
}

// Compute quality/proximity/occasionFit sub-scores (0-100 each).
// YouTube-dependent sub-scores (socialBuzz, recency) are added later in finalizeScore.
function computeBaseScores(places, centerLat, centerLng, occasion) {
  return places.map(place => {
    const rating = place.rating || 0
    const reviewCount = place.userRatingCount || 0
    const bayes = bayesianRating(rating, reviewCount)
    // Map Bayesian 2.5 → 0, 5.0 → 100
    const quality = Math.max(0, ((bayes - 2.5) / 2.5) * 100)

    const distance = place.location
      ? haversineDistance(centerLat, centerLng, place.location.latitude, place.location.longitude)
      : null
    // 0km → 100, 5km → 0 (linear fall-off matching search radius)
    const proximity = distance != null ? Math.max(0, 100 - distance * 20) : 50

    const occasionFit = occasionSubScore(place.primaryType, place.priceLevel, occasion)

    return {
      ...place,
      _quality: Math.round(quality * 10) / 10,
      _proximity: Math.round(proximity * 10) / 10,
      _occasionFit: occasionFit,
      _distance: distance,
    }
  })
}

// Combine all sub-scores into the final weighted score.
function finalizeScore(place) {
  const videos = place.youtubeVideos || []
  const videoCount = videos.length
  // Soft-cap at 5 videos so one viral spot doesn't runaway
  const socialBuzz = Math.min(videoCount, 5) / 5 * 100

  let recency = 0
  if (videoCount > 0) {
    const now = Date.now()
    const avgMs = videos.reduce(
      (sum, v) => sum + (now - new Date(v.publishedAt).getTime()),
      0
    ) / videoCount
    const avgDays = avgMs / (1000 * 60 * 60 * 24)
    if (avgDays < 14) recency = 100
    else if (avgDays < 30) recency = 70
    else if (avgDays < 60) recency = 40
    else recency = 0
  }

  const finalScore =
    WEIGHTS.socialBuzz  * socialBuzz +
    WEIGHTS.quality     * (place._quality     || 0) +
    WEIGHTS.proximity   * (place._proximity   || 50) +
    WEIGHTS.occasionFit * (place._occasionFit || 0) +
    WEIGHTS.recency     * recency

  return {
    ...place,
    _socialBuzz: Math.round(socialBuzz * 10) / 10,
    _recency: recency,
    _videoCount: videoCount,
    _score: Math.round(finalScore * 10) / 10,
  }
}

// YouTube fetch — disk-cached for 3 days. Prevents quota exhaustion across restarts.
async function fetchYouTubeVideos(placeName, cityHint = 'India') {
  const cacheKey = placeName.toLowerCase().trim()
  const cached = cacheGet('youtube', cacheKey, YOUTUBE_TTL_MS)
  if (cached) return cached

  try {
    const query = `${placeName} ${cityHint} restaurant`
    const publishedAfter = new Date()
    publishedAfter.setDate(publishedAfter.getDate() - 60)

    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: YOUTUBE_API_KEY,
        q: query,
        type: 'video',
        part: 'snippet',
        maxResults: 5,           // cost is per-call not per-result — still 100 quota units
        order: 'viewCount',
        publishedAfter: publishedAfter.toISOString(),
        regionCode: 'IN',
      },
    })

    const videos = (response.data.items || []).map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails.medium?.url,
    }))

    cacheSet('youtube', cacheKey, videos)
    return videos
  } catch (err) {
    // On quota error, cache empty briefly (1hr) to avoid thundering herd.
    // Writes directly to skip the 3d TTL — quota resets daily, retry sooner.
    if (err.response?.status === 403) {
      if (!cache.youtube) cache.youtube = {}
      cache.youtube[cacheKey] = { data: [], fetchedAt: Date.now() - YOUTUBE_TTL_MS + 60 * 60 * 1000 }
      saveCache()
    }
    console.warn(`YouTube fetch failed for "${placeName}":`, err.message)
    return []
  }
}

app.get('/api/places', async (req, res) => {
  const { neighborhood, occasion } = req.query

  if (!neighborhood || !NEIGHBORHOODS[neighborhood]) {
    return res.status(400).json({ error: 'Invalid or missing neighborhood' })
  }

  if (!PLACES_API_KEY) {
    return res.status(500).json({ error: 'Google Places API key not configured. Add GOOGLE_PLACES_API_KEY to your .env file.' })
  }

  const { lat, lng, city } = NEIGHBORHOODS[neighborhood]

  try {
    // ─── Places cache (7d TTL) ─────────────────────────────
    let rawPlaces = cacheGet('places', neighborhood, PLACES_TTL_MS)
    let placesFetchedAt = cache.places?.[neighborhood]?.fetchedAt
    if (!rawPlaces) {
      const response = await axios.post(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          locationRestriction: {
            circle: { center: { latitude: lat, longitude: lng }, radius: 5000 },
          },
          includedTypes: INCLUDED_TYPES,
          maxResultCount: 20,
          rankPreference: 'POPULARITY',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': PLACES_API_KEY,
            'X-Goog-FieldMask': FIELD_MASK,
          },
        }
      )
      rawPlaces = response.data.places || []
      cacheSet('places', neighborhood, rawPlaces)
      placesFetchedAt = Date.now()
      console.log(`[places] fresh: ${neighborhood} (${rawPlaces.length} places)`)
    } else {
      console.log(`[places] cache hit: ${neighborhood} (${rawPlaces.length} places)`)
    }

    // Compute base sub-scores (quality/proximity/occasionFit) — independent of YouTube
    const withBaseScores = computeBaseScores(rawPlaces, lat, lng, occasion)

    // Fetch YouTube only for the top-10 by base score (caps YouTube calls per request)
    const TOP_N_FOR_YT = 10
    const preRanked = [...withBaseScores].sort((a, b) => {
      const aBase = WEIGHTS.quality * a._quality + WEIGHTS.proximity * a._proximity + WEIGHTS.occasionFit * a._occasionFit
      const bBase = WEIGHTS.quality * b._quality + WEIGHTS.proximity * b._proximity + WEIGHTS.occasionFit * b._occasionFit
      return bBase - aBase
    })
    const topPlaces = preRanked.slice(0, TOP_N_FOR_YT)
    const restPlaces = preRanked.slice(TOP_N_FOR_YT)

    const topWithVideos = await Promise.all(
      topPlaces.map(async place => {
        const videos = await fetchYouTubeVideos(place.displayName?.text || '', city)
        return finalizeScore({ ...place, youtubeVideos: videos })
      })
    )
    const restNoVideos = restPlaces.map(p => finalizeScore({ ...p, youtubeVideos: [] }))

    // Final sort by weighted score
    const allScored = [...topWithVideos, ...restNoVideos].sort((a, b) => b._score - a._score)

    const ageMs = Date.now() - (placesFetchedAt || Date.now())
    res.json({
      places: allScored,
      center: { lat, lng },
      neighborhood,
      city,
      meta: {
        placesFetchedAt: placesFetchedAt ? new Date(placesFetchedAt).toISOString() : null,
        ageHours: Math.round(ageMs / (1000 * 60 * 60)),
        snapshotDate: placesFetchedAt
          ? new Date(placesFetchedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : null,
        weights: WEIGHTS,
      },
    })
  } catch (err) {
    console.error('Places API error:', err.response?.data || err.message)
    res.status(500).json({
      error: 'Failed to fetch places',
      details: err.response?.data?.error?.message || err.message,
    })
  }
})

// Cache status — exposes last-updated timestamps per neighborhood.
// Used by the UI footer and for debugging cache freshness.
app.get('/api/status', (req, res) => {
  const now = Date.now()
  const neighborhoods = {}
  for (const [name, meta] of Object.entries(NEIGHBORHOODS)) {
    const entry = cache.places?.[name]
    neighborhoods[name] = {
      city: meta.city,
      cached: !!entry,
      placesFetchedAt: entry ? new Date(entry.fetchedAt).toISOString() : null,
      placesAgeHours: entry ? Math.round((now - entry.fetchedAt) / (1000 * 60 * 60)) : null,
      placeCount: entry?.data?.length || 0,
    }
  }
  const cachedCount = Object.values(neighborhoods).filter(n => n.cached).length
  res.json({
    totalNeighborhoods: Object.keys(NEIGHBORHOODS).length,
    cachedNeighborhoods: cachedCount,
    youtubeEntries: Object.keys(cache.youtube || {}).length,
    weights: WEIGHTS,
    neighborhoods,
  })
})

// Video counts per neighborhood for a given occasion.
// Used by the selector UI so users can see which neighborhood has the most
// YouTube buzz for their chosen vibe. Mirrors /api/places's ranking logic
// (top-10 by base score → sum their cached YouTube videos) so the number
// matches what the results page will actually show.
const videoCountMemo = {}  // { 'Bangalore|family': { Koramangala: 23, … } }
app.get('/api/video-counts', (req, res) => {
  const { occasion, city } = req.query
  if (!occasion || !OCCASION_PROFILES[occasion]) {
    return res.status(400).json({ error: 'Invalid or missing occasion' })
  }
  const memoKey = `${city || 'ALL'}|${occasion}`
  if (videoCountMemo[memoKey]) return res.json(videoCountMemo[memoKey])

  const result = {}
  for (const [hood, meta] of Object.entries(NEIGHBORHOODS)) {
    if (city && meta.city !== city) continue
    const rawPlaces = cache.places?.[hood]?.data
    if (!rawPlaces) { result[hood] = { videos: 0, places: 0 }; continue }
    const withBase = computeBaseScores(rawPlaces, meta.lat, meta.lng, occasion)
    const preRanked = [...withBase].sort((a, b) => {
      const aBase = WEIGHTS.quality * a._quality + WEIGHTS.proximity * a._proximity + WEIGHTS.occasionFit * a._occasionFit
      const bBase = WEIGHTS.quality * b._quality + WEIGHTS.proximity * b._proximity + WEIGHTS.occasionFit * b._occasionFit
      return bBase - aBase
    })
    const top10 = preRanked.slice(0, 10)
    const totalVideos = top10.reduce((sum, p) => {
      const key = (p.displayName?.text || '').toLowerCase().trim()
      const videos = cache.youtube?.[key]?.data || []
      return sum + videos.length
    }, 0)
    result[hood] = { videos: totalVideos, places: rawPlaces.length }
  }
  videoCountMemo[memoKey] = result
  res.json(result)
})

// Grouped neighborhoods for the city filter dropdown.
// Also returns total cached restaurants per city so the city tabs can
// surface "X areas · Y restaurants" context.
app.get('/api/cities', (req, res) => {
  const cities = {}
  for (const [name, meta] of Object.entries(NEIGHBORHOODS)) {
    if (!cities[meta.city]) cities[meta.city] = { neighborhoods: [], placeCount: 0 }
    cities[meta.city].neighborhoods.push(name)
    cities[meta.city].placeCount += cache.places?.[name]?.data?.length || 0
  }
  res.json({ cities })
})

// Catch-all: serve React app for any non-API route
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`District server running on http://localhost:${PORT}`)
})
