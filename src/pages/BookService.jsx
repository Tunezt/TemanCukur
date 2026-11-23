import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BookLayout from '../components/BookLayout'

const SERVICES = [
  {
    id: 'haircut-wash',
    name: 'Haircut + wash',
    price: 120_000,
    durationLabel: '1 jam',
  },
  {
    id: 'haircut',
    name: 'Haircut',
    price: 100_000,
    durationLabel: '45 menit',
  },
]

function fmtPriceIdr(n) {
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}

function hasBarberChoice(state) {
  return Boolean(state?.preferAny || state?.barber?.id)
}

export default function BookService() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!hasBarberChoice(state)) {
      navigate('/book', { replace: true })
    }
  }, [state, navigate])

  const proceed = () => {
    if (!selected || !hasBarberChoice(state)) return
    navigate('/book/schedule', {
      state: {
        ...state,
        service: selected,
      },
    })
  }

  if (!hasBarberChoice(state)) {
    return null
  }

  return (
    <BookLayout
      step={2}
      summary={{ ...state, service: selected }}
      onContinue={proceed}
      canContinue={!!selected}
    >
      <p className="bk-step-of">Langkah 2 dari 5</p>
      <h2 className="bk-title">Pilih layanan</h2>
      <p className="bk-sub">Satu layanan per booking.</p>

      <div className="svc-list">
        {SERVICES.map((s) => (
          <div
            key={s.id}
            className={`svc-row${selected?.id === s.id ? ' svc-row--sel' : ''}`}
            onClick={() => setSelected(s)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setSelected(s)}
          >
            <div className="svc-row__left">
              <p className="svc-row__name">{s.name}</p>
              <p className="svc-row__dur">{s.durationLabel}</p>
            </div>
            <span className="svc-row__price">{fmtPriceIdr(s.price)}</span>
          </div>
        ))}
      </div>
    </BookLayout>
  )
}
