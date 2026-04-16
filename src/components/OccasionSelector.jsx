import styles from './OccasionSelector.module.css'

const OCCASIONS = [
  {
    id: 'date_night',
    label: 'Date Night',
    emoji: '🕯️',
    description: 'Rooftop bars, fine dining & intimate spots',
    gradient: 'linear-gradient(135deg, #1a0a0a 0%, #2d1010 100%)',
    accent: '#ff5733',
  },
  {
    id: 'family',
    label: 'Family Outing',
    emoji: '🌿',
    description: 'Casual cafes, kid-friendly & easy dining',
    gradient: 'linear-gradient(135deg, #0a1a0e 0%, #0d2b13 100%)',
    accent: '#22c55e',
  },
  {
    id: 'friends',
    label: 'Friends / Group',
    emoji: '🎉',
    description: 'Bars, nightlife & late-night favourites',
    gradient: 'linear-gradient(135deg, #0d0a1a 0%, #1a1035 100%)',
    accent: '#8b5cf6',
  },
]

export default function OccasionSelector({ onSelect }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Bengaluru · Tonight</p>
        <h1 className={styles.heading}>What's the occasion?</h1>
        <p className={styles.sub}>We'll surface the best spots for your vibe.</p>
      </div>

      <div className={styles.grid}>
        {OCCASIONS.map(occ => (
          <button
            key={occ.id}
            className={styles.card}
            style={{ background: occ.gradient, '--card-accent': occ.accent }}
            onClick={() => onSelect(occ.id)}
          >
            <span className={styles.emoji}>{occ.emoji}</span>
            <span className={styles.cardLabel}>{occ.label}</span>
            <span className={styles.cardDesc}>{occ.description}</span>
            <span className={styles.arrow}>→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
