import styles from './PlaceCard.module.css'

const PRICE_SYMBOLS = { PRICE_LEVEL_FREE: '·', PRICE_LEVEL_INEXPENSIVE: '₹', PRICE_LEVEL_MODERATE: '₹₹', PRICE_LEVEL_EXPENSIVE: '₹₹₹', PRICE_LEVEL_VERY_EXPENSIVE: '₹₹₹₹' }

const OCCASION_TAGS = {
  date_night: { label: 'Date Night Pick', color: '#ff5733' },
  family: { label: 'Family Friendly', color: '#22c55e' },
  friends: { label: 'Group Vibe', color: '#8b5cf6' },
}

function getOccasionMatch(primaryType, occasion) {
  const pt = (primaryType || '').toLowerCase()

  const matchers = {
    date_night: ['fine_dining_restaurant', 'rooftop_restaurant', 'wine_bar',
      'cocktail_bar', 'lounge', 'japanese_restaurant', 'french_restaurant',
      'seafood_restaurant', 'steak_house'],
    family: ['cafe', 'ice_cream_shop', 'pizza_restaurant', 'indian_restaurant',
      'fast_food_restaurant', 'chinese_restaurant', 'south_indian_restaurant',
      'north_indian_restaurant', 'buffet_restaurant'],
    friends: ['bar', 'night_club', 'sports_bar', 'pub', 'brewery',
      'mexican_restaurant', 'korean_restaurant', 'live_music_venue',
      'american_restaurant', 'barbecue_restaurant'],
  }

  return matchers[occasion]?.includes(pt) ?? false
}

function renderStars(rating) {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5
  const stars = []
  for (let i = 0; i < 5; i++) {
    if (i < full) stars.push('★')
    else if (i === full && half) stars.push('½')
    else stars.push('☆')
  }
  return stars
}

export default function PlaceCard({ place, rank, occasion }) {
  const isOpen = place.currentOpeningHours?.openNow
  const isMatch = getOccasionMatch(place.primaryType, occasion)
  const price = PRICE_SYMBOLS[place.priceLevel] || ''
  const tag = OCCASION_TAGS[occasion]
  const distance = place._distance != null ? place._distance.toFixed(1) : null
  const score = place._score?.toFixed(1)
  const videos = place.youtubeVideos || []

  return (
    <div className={`${styles.card} ${isMatch ? styles.match : ''}`}>
      <div className={styles.rank}>#{rank}</div>

      <div className={styles.body}>
        <div className={styles.top}>
          <div className={styles.nameRow}>
            <h3 className={styles.name}>{place.displayName?.text || 'Unnamed Place'}</h3>
            {price && <span className={styles.price}>{price}</span>}
          </div>

          <div className={styles.meta}>
            {place.primaryTypeDisplayName?.text && (
              <span className={styles.type}>{place.primaryTypeDisplayName.text}</span>
            )}
            {distance && <span className={styles.distance}>{distance} km</span>}
          </div>
        </div>

        <div className={styles.middle}>
          <div className={styles.ratingRow}>
            <span className={styles.stars}>
              {renderStars(place.rating || 0).map((s, i) => (
                <span key={i} className={s === '☆' ? styles.starEmpty : styles.starFull}>{s}</span>
              ))}
            </span>
            <span className={styles.ratingNum}>{place.rating?.toFixed(1) || '—'}</span>
            {place.userRatingCount > 0 && (
              <span className={styles.reviewCount}>({place.userRatingCount.toLocaleString()})</span>
            )}
          </div>

          {place.editorialSummary?.text && (
            <p className={styles.summary}>{place.editorialSummary.text}</p>
          )}
        </div>

        {videos.length > 0 && (
          <div className={styles.videos}>
            <p className={styles.videosLabel}>📹 Featured on YouTube</p>
            <div className={styles.videoGrid}>
              {videos.map((video, i) => (
                <a
                  key={i}
                  href={`https://youtube.com/watch?v=${video.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.videoCard}
                  title={video.title}
                >
                  <img src={video.thumbnail} alt={video.title} className={styles.videoThumb} />
                  <div className={styles.videoOverlay}>
                    <span className={styles.playIcon}>▶</span>
                  </div>
                  <p className={styles.videoTitle}>{video.title}</p>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className={styles.badges}>
          {isOpen === true && (
            <span className={styles.openBadge}>Open Now</span>
          )}
          {isOpen === false && (
            <span className={styles.closedBadge}>Closed</span>
          )}
          {isMatch && (
            <span className={styles.matchBadge} style={{ '--tag-color': tag.color }}>
              ✦ {tag.label}
            </span>
          )}
          {videos.length > 0 && (
            <span className={styles.viralBadge}>
              🔥 {videos.length} trending video{videos.length !== 1 ? 's' : ''}
            </span>
          )}
          {score && (
            <span className={styles.scoreBadge}>Score {score}</span>
          )}
        </div>
      </div>
    </div>
  )
}
