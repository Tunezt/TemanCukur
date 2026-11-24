import { Link, useNavigate } from 'react-router-dom'
import '../book.css'

const STEP_NAMES = ['Barber', 'Layanan', 'Jadwal', 'Data', 'Konfirmasi']

function fmtPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return '-'
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}

function barberSidebarLabel(barber, preferAny) {
  if (preferAny) return 'Tidak ada preferensi'
  if (barber?.name) return barber.name
  return 'Belum dipilih'
}

export default function BookLayout({
  step,
  summary = {},
  onContinue,
  canContinue = true,
  ctaLabel = 'Lanjut →',
  showSidebarCta = true,
  children,
}) {
  const navigate = useNavigate()
  const { barber, preferAny, service, date, time } = summary
  const barberLabel = barberSidebarLabel(barber, preferAny)
  const barberSelected = Boolean(preferAny || barber?.name)
  const barberInitial = preferAny
    ? '?'
    : (barber?.name?.trim()?.[0] || '—').toUpperCase()

  return (
    <div className={`bl bl--step-${step}${showSidebarCta ? ' bl--has-cta' : ''}`}>
      <header className="bl__site-header">
        <Link to="/" className="bl__site-brand" aria-label="Beranda Norm Studio">
          <span className="bl__site-brand-line">Norm</span>
          <span className="bl__site-brand-line bl__site-brand-line--2">Studio</span>
        </Link>
        <div className="bl__site-actions">
          <Link to="/" className="bl__site-home">
            Beranda
          </Link>
        </div>
      </header>

      <div className="bl__stepbar" role="navigation" aria-label="Langkah booking">
        {[1, 2, 3, 4, 5].flatMap((n, i) => {
          const items = []
          if (i > 0) {
            items.push(
              <div
                key={`ln${n}`}
                className={`bl__sep${n <= step ? ' bl__sep--fill' : ''}`}
              />
            )
          }
          items.push(
            <div key={n} className="bl__step-item">
              <div
                className={[
                  'bl__sn',
                  n < step ? 'bl__sn--done' : '',
                  n === step ? 'bl__sn--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {n < step ? (
                  <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <polyline
                      points="2,6 5,9 10,3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  n
                )}
              </div>
              <span className={`bl__sl${n <= step ? ' bl__sl--vis' : ''}`}>
                {STEP_NAMES[n - 1]}
              </span>
            </div>
          )
          return items
        })}
      </div>

      <div className="bl__body">
        <main className="bl__main">
          <button
            type="button"
            className="bl__back"
            onClick={() => navigate(-1)}
          >
            ← Kembali
          </button>
          <div className="bl__content">{children}</div>
        </main>

        <aside className="bl__panel">
          <div className="bl__panel-scroll">
            <div className="bl__panel-inner">
              <p className="bl__ph">Booking kamu</p>
              <div className="bl__barber">
                {barberSelected && !preferAny && barber?.photo_url ? (
                  <img
                    className="bl__avatar bl__avatar--photo"
                    src={barber.photo_url}
                    alt=""
                    width={40}
                    height={40}
                  />
                ) : (
                  <div
                    className={`bl__avatar${!barberSelected ? ' bl__avatar--empty' : ''}`}
                    aria-hidden="true"
                  >
                    {barberSelected ? barberInitial : '—'}
                  </div>
                )}
                <div>
                  <p
                    className={[
                      'bl__barber-name',
                      !barberSelected ? ' bl__barber-name--empty' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {barberLabel}
                  </p>
                  <p className="bl__barber-sub">
                    {preferAny
                      ? 'Auto-assign · Balikpapan'
                      : barber?.specialty
                        ? barber.specialty
                        : 'Barber · Balikpapan'}
                  </p>
                </div>
              </div>

              <div className="bl__rows">
                <div className="bl__row">
                  <p className="bl__rk">Layanan</p>
                  <p
                    className={[
                      'bl__rv',
                      service ? ' bl__rv--serif' : '',
                      !service ? ' bl__rv--empty' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {service?.name ?? 'Belum dipilih'}
                  </p>
                </div>
                <div className="bl__row">
                  <p className="bl__rk">Tanggal</p>
                  <p
                    className={[
                      'bl__rv',
                      date ? ' bl__rv--serif' : '',
                      !date ? ' bl__rv--empty' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {date ?? 'Belum dipilih'}
                  </p>
                </div>
                <div className="bl__row">
                  <p className="bl__rk">Waktu</p>
                  <p
                    className={[
                      'bl__rv',
                      time ? ' bl__rv--serif' : '',
                      !time ? ' bl__rv--empty' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {time ?? 'Belum dipilih'}
                  </p>
                </div>
              </div>

              <div className="bl__total">
                <p className="bl__rk">Total</p>
                <p className="bl__total-price">{fmtPrice(service?.price)}</p>
              </div>
            </div>
          </div>

          {showSidebarCta && (
            <button
              type="button"
              className="bl__cta"
              onClick={onContinue}
              disabled={!canContinue}
            >
              {ctaLabel}
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
