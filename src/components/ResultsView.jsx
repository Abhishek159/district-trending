import PlaceCard from './PlaceCard.jsx'
import styles from './ResultsView.module.css'

const OCCASION_LABELS = {
  date_night: 'Date Night',
  family: 'Family Outing',
  friends: 'Friends / Group',
}

export default function ResultsView({ places, occasion, neighborhood, onReset }) {
  const label = OCCASION_LABELS[occasion]

  if (!places || places.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyIcon}>🔍</p>
        <p className={styles.emptyTitle}>No places found</p>
        <p className={styles.emptySub}>Try a different neighbourhood or check back later.</p>
        <button className={styles.resetBtn} onClick={onReset}>Start Over</button>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.resultsHeader}>
        <div>
          <p className={styles.eyebrow}>{label} · {neighborhood}</p>
          <h2 className={styles.heading}>
            {places.length} trending spot{places.length !== 1 ? 's' : ''}
          </h2>
        </div>
        <button className={styles.resetBtn} onClick={onReset}>
          Change
        </button>
      </div>

      <div className={styles.list}>
        {places.map((place, i) => (
          <PlaceCard
            key={place.id || i}
            place={place}
            rank={i + 1}
            occasion={occasion}
          />
        ))}
      </div>
    </div>
  )
}
