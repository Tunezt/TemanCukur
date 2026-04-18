import { Link, useNavigate } from 'react-router-dom'
import '../book.css'

const STEP_NAMES = ['Layanan', 'Jadwal', 'Data', 'Konfirmasi']

function fmtPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `Rp ${Number(n).toLocaleString('id-ID')}`
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
  const { service, date, time } = summary

  return (
    <div className="bl">
      <header className="bl__site-header">
        <Link to="/" className="bl__site-brand" aria-label="Beranda Teman Cukur">
          <span className="bl__site-brand-line">Teman</span>
          <span className="bl__site-brand-line">Cukur</span>
        </Link>
        <div className="bl__site-actions">
          <Link to="/" className="bl__site-home">
            Beranda
          </Link>
        </div>
      </header>

      <div className="bl__stepbar" role="navigation" aria-label="Langkah booking">
        {[1, 2, 3, 4].flatMap((n, i) => {
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
                <div className="bl__avatar" aria-hidden="true">
                  R
                </div>
                <div>
                  <p className="bl__barber-name">Rifki Muhammad</p>
                  <p className="bl__barber-sub">Barber · Balikpapan</p>
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
