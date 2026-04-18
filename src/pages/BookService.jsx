import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookLayout from '../components/BookLayout'

const SERVICES = [
  { id: 'haircut',      name: 'Potong rambut', price: 80000, duration: 45 },
  { id: 'haircut-beard', name: 'Potong + jenggot', price: 110000, duration: 60 },
  { id: 'skinfade',     name: 'Skin fade', price: 100000, duration: 60 },
  { id: 'beard',        name: 'Rapikan jenggot', price: 50000, duration: 30 },
  { id: 'full',         name: 'Rambut + jenggot + cuci', price: 140000, duration: 75 },
]

export default function BookService() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  const proceed = () => {
    if (!selected) return
    navigate('/book/schedule', { state: { service: selected } })
  }

  return (
    <BookLayout
      step={1}
      summary={{ service: selected }}
      onContinue={proceed}
      canContinue={!!selected}
    >
      <p className="bk-step-of">Langkah 1 dari 4</p>
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
              <p className="svc-row__dur">{s.duration} mnt</p>
            </div>
            <span className="svc-row__price">
              Rp {s.price.toLocaleString('id-ID')}
            </span>
          </div>
        ))}
      </div>
    </BookLayout>
  )
}
