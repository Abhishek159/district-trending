import { useState, useMemo, useEffect } from 'react'
import styles from './LocationSelector.module.css'

// Distinctive "play triangle" icon so users see it's a video count, not a restaurant count.
function VideoIcon() {
  return (
    <svg className={styles.videoIcon} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="3" width="14" height="10" rx="2.5" fill="currentColor" />
      <path d="M7 6.5v3l2.5-1.5z" fill="#0b0b0d" />
    </svg>
  )
}

// Location-pin icon for the "neighborhoods" pill in each city tab.
function PinIcon() {
  return (
    <svg className={styles.tabIcon} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="currentColor"/>
    </svg>
  )
}

// Fork-and-knife icon for the "restaurants" pill in each city tab.
function ForkIcon() {
  return (
    <svg className={styles.tabIcon} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 1.5v4.25a1.25 1.25 0 0 0 1 1.22V14.5h1V6.97a1.25 1.25 0 0 0 1-1.22V1.5h-.8v3.6h-.6V1.5h-.8v3.6h-.6V1.5H4zm6.5 0c-1 0-1.5 1-1.5 3.2 0 1.6.6 2.4 1.25 2.55V14.5H11V7.25c.65-.15 1.25-.95 1.25-2.55 0-2.2-.5-3.2-1.75-3.2z" fill="currentColor"/>
    </svg>
  )
}

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

const OCCASION_LABELS = {
  date_night: 'Date Night',
  family: 'Family Outing',
  friends: 'Friends / Group',
}

export default function LocationSelector({ occasion, onSelect, loading, error }) {
  const [city, setCity] = useState('Bangalore')
  const [selected, setSelected] = useState('')
  const [query, setQuery] = useState('')
  const [videoCounts, setVideoCounts] = useState({})
  const [cityStats, setCityStats] = useState({})  // { Bangalore: { placeCount: 400 }, … }

  const cityHoods = CITIES[city]

  // Restaurant counts per city — so each tab can show "20 areas · 400 restaurants".
  useEffect(() => {
    fetch('/api/cities')
      .then(r => r.ok ? r.json() : { cities: {} })
      .then(data => setCityStats(data.cities || {}))
      .catch(() => setCityStats({}))
  }, [])

  // Fetch video counts for the current (city, occasion) combo so each
  // neighborhood chip can show how much YouTube buzz it has for this vibe.
  useEffect(() => {
    if (!occasion) return
    let cancelled = false
    fetch(`/api/video-counts?occasion=${occasion}&city=${encodeURIComponent(city)}`)
      .then(r => r.ok ? r.json() : {})
      .then(data => { if (!cancelled) setVideoCounts(data || {}) })
      .catch(() => { if (!cancelled) setVideoCounts({}) })
    return () => { cancelled = true }
  }, [occasion, city])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cityHoods
    return cityHoods.filter(h => h.toLowerCase().includes(q))
  }, [query, cityHoods])

  function handleCityChange(newCity) {
    setCity(newCity)
    setSelected('')
    setQuery('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (selected) onSelect(selected)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{OCCASION_LABELS[occasion]} · {city}</p>
        <h2 className={styles.heading}>Which neighbourhood?</h2>
        <p className={styles.sub}>
          {cityHoods.length} areas · we'll search within 5km for trending spots.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.cityTabs}>
          {Object.keys(CITIES).map(c => {
            const placeCount = cityStats[c]?.placeCount
            return (
              <button
                key={c}
                type="button"
                className={`${styles.cityTab} ${city === c ? styles.cityTabActive : ''}`}
                onClick={() => handleCityChange(c)}
              >
                <span className={styles.cityName}>{c}</span>
                <span className={styles.cityPills}>
                  <span className={styles.cityPill} title={`${CITIES[c].length} neighbourhoods`}>
                    <PinIcon />
                    {CITIES[c].length}
                  </span>
                  {typeof placeCount === 'number' && (
                    <span className={styles.cityPill} title={`${placeCount} restaurants cached`}>
                      <ForkIcon />
                      {placeCount}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <input
          type="text"
          className={styles.search}
          placeholder={`Search ${city} neighbourhoods…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className={styles.grid}>
          {filtered.map(hood => {
            const stats = videoCounts[hood]
            const videos = stats?.videos
            const places = stats?.places
            return (
              <button
                key={hood}
                type="button"
                className={`${styles.option} ${selected === hood ? styles.selected : ''}`}
                onClick={() => setSelected(hood)}
              >
                <span className={styles.optionDot} />
                <span className={styles.optionName}>{hood}</span>
                <span className={styles.optionPills}>
                  {typeof places === 'number' && places > 0 && (
                    <span
                      className={styles.placeBadge}
                      title={`${places} restaurants in ${hood}`}
                    >
                      <ForkIcon />
                      {places}
                    </span>
                  )}
                  {typeof videos === 'number' && (
                    <span
                      className={styles.videoBadge}
                      title={`${videos} trending YouTube ${videos === 1 ? 'video' : 'videos'} for ${OCCASION_LABELS[occasion]?.toLowerCase() || occasion}`}
                    >
                      <VideoIcon />
                      {videos}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className={styles.noResults}>No match for "{query}"</p>
          )}
        </div>

        {error && (
          <div className={styles.error}>
            <span>⚠️</span> {error}
          </div>
        )}

        <button
          type="submit"
          className={styles.submit}
          disabled={!selected || loading}
        >
          {loading ? (
            <>
              <span className={styles.spinner} />
              Finding places…
            </>
          ) : (
            'Find Places →'
          )}
        </button>
      </form>
    </div>
  )
}
