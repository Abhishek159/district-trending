import { useState } from 'react'
import OccasionSelector from './components/OccasionSelector.jsx'
import LocationSelector from './components/LocationSelector.jsx'
import ResultsView from './components/ResultsView.jsx'
import styles from './App.module.css'

const STEPS = { OCCASION: 'occasion', LOCATION: 'location', RESULTS: 'results' }

export default function App() {
  const [step, setStep] = useState(STEPS.OCCASION)
  const [occasion, setOccasion] = useState(null)
  const [neighborhood, setNeighborhood] = useState(null)
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function fetchPlaces(hood) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/places?neighborhood=${encodeURIComponent(hood)}&occasion=${occasion}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setPlaces(data.places || [])
      setStep(STEPS.RESULTS)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleOccasionSelect(o) {
    setOccasion(o)
    setStep(STEPS.LOCATION)
  }

  function handleLocationSelect(hood) {
    setNeighborhood(hood)
    fetchPlaces(hood)
  }

  function handleReset() {
    setStep(STEPS.OCCASION)
    setOccasion(null)
    setNeighborhood(null)
    setPlaces([])
    setError(null)
  }

  function handleBack() {
    if (step === STEPS.LOCATION) setStep(STEPS.OCCASION)
    if (step === STEPS.RESULTS) setStep(STEPS.LOCATION)
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo} onClick={handleReset}>
          <span className={styles.logoMark}>D</span>
          <span className={styles.logoText}>istrict</span>
        </div>
        {step !== STEPS.OCCASION && (
          <button className={styles.backBtn} onClick={handleBack}>
            ← Back
          </button>
        )}
      </header>

      <main className={styles.main}>
        {step === STEPS.OCCASION && (
          <OccasionSelector onSelect={handleOccasionSelect} />
        )}

        {step === STEPS.LOCATION && (
          <LocationSelector
            occasion={occasion}
            onSelect={handleLocationSelect}
            loading={loading}
            error={error}
          />
        )}

        {step === STEPS.RESULTS && (
          <ResultsView
            places={places}
            occasion={occasion}
            neighborhood={neighborhood}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}
