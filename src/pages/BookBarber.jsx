import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookLayout from '../components/BookLayout'
import { fetchBarbers } from '../api/booking'

export default function BookBarber() {
  const navigate = useNavigate()
  const [barbers, setBarbers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [preferAny, setPreferAny] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchBarbers()
      .then((list) => {
        if (cancelled) return
        setBarbers(list)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : 'Gagal memuat daftar barber.'
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectBarber = (b) => {
    setPreferAny(false)
    setSelected(b)
  }

  const selectNoPreference = () => {
    setSelected(null)
    setPreferAny(true)
  }

  const proceed = () => {
    if (preferAny) {
      navigate('/book/service', { state: { preferAny: true } })
      return
    }
    if (!selected) return
    navigate('/book/service', {
      state: {
        barber: {
          id: selected.id,
          name: selected.name,
          specialty: selected.specialty,
          photo_url: selected.photo_url,
        },
      },
    })
  }

  const canContinue = preferAny || !!selected

  return (
    <BookLayout
      step={1}
      summary={{
        barber: preferAny ? null : selected,
        preferAny,
      }}
      onContinue={proceed}
      canContinue={canContinue}
    >
      <p className="bk-step-of">Langkah 1 dari 5</p>
      <h2 className="bk-title">Pilih barber</h2>
      <p className="bk-sub">Siapa yang mau potong rambutmu?</p>

      {loading ? (
        <p className="bk-sub">Memuat barber…</p>
      ) : error ? (
        <p className="bk-sub">{error}</p>
      ) : (
        <div className="barber-list">
          {barbers.map((b) => {
            const sel = !preferAny && selected?.id === b.id
            return (
              <div
                key={b.id}
                className={`barber-row${sel ? ' barber-row--sel' : ''}`}
                onClick={() => selectBarber(b)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && selectBarber(b)}
              >
                {b.photo_url ? (
                  <img
                    className="barber-row__photo"
                    src={b.photo_url}
                    alt=""
                    width={56}
                    height={56}
                  />
                ) : (
                  <div className="barber-row__photo barber-row__photo--fallback" aria-hidden="true">
                    {(b.name?.trim()?.[0] || '?').toUpperCase()}
                  </div>
                )}
                <div className="barber-row__meta">
                  <p className="barber-row__name">{b.name}</p>
                  <p className="barber-row__specialty">{b.specialty}</p>
                </div>
              </div>
            )
          })}

          <div
            className={`barber-row barber-row--any${preferAny ? ' barber-row--sel' : ''}`}
            onClick={selectNoPreference}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && selectNoPreference()}
          >
            <div className="barber-row__photo barber-row__photo--any" aria-hidden="true">
              ?
            </div>
            <div className="barber-row__meta">
              <p className="barber-row__name">Tidak ada preferensi</p>
              <p className="barber-row__specialty">
                Kami assign barber dengan slot terbanyak di tanggal yang kamu pilih.
              </p>
            </div>
          </div>
        </div>
      )}
    </BookLayout>
  )
}
