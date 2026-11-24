import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import BookSuccess from '../components/BookSuccess'
import { fmtPrice, fmtTime } from '../format'
import { cancelBooking, fetchPayment, simulateDemoPayment } from '../api/booking'
import { PAYMENT_HOLD_MINUTES } from '../shopConfig'
import '../book.css'

const POLL_MS = 3000

function fmtClock(sec) {
  const s = Math.max(0, sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function fmtDateId(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y) return iso
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** Summary for the success page, from the booking flow state or (after a reload) the server. */
function summaryFrom(view, flowSummary) {
  if (flowSummary) return flowSummary
  return {
    name: view.customer_name,
    barber: { name: view.barber_name },
    service: { name: view.service, price: view.service_price },
    date: fmtDateId(view.booking_date),
    time: fmtTime(view.booking_time),
  }
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="12 7.5 12 12 15 14" />
    </svg>
  )
}

export default function BookPay() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { state: navState } = useLocation()
  const flowSummary = navState?.summary ?? null

  const [view, setView] = useState(navState?.payment ?? null)
  const [secondsLeft, setSecondsLeft] = useState(navState?.payment?.seconds_left ?? null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(null) // 'pay' | 'cancel'

  const applyView = useCallback((v) => {
    setView(v)
    setSecondsLeft(v.seconds_left)
  }, [])

  const refresh = useCallback(async () => {
    try {
      applyView(await fetchPayment(bookingId))
      setLoadError('')
    } catch (e) {
      setLoadError(e.status === 404 ? 'not_found' : e.message)
    }
  }, [bookingId, applyView])

  useEffect(() => {
    window.scrollTo(0, 0)
    refresh()
  }, [refresh])

  const waiting = view?.status === 'awaiting_payment'

  // Ask the server every few seconds while waiting; it confirms the moment the payment lands.
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [waiting, refresh])

  // Local countdown between polls; at zero, ask the server (it expires the hold).
  useEffect(() => {
    if (!waiting || secondsLeft == null) return
    if (secondsLeft <= 0) {
      refresh()
      return
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [waiting, secondsLeft, refresh])

  const simulatePay = async () => {
    setActionError('')
    setBusy('pay')
    try {
      applyView(await simulateDemoPayment(bookingId))
    } catch (e) {
      setActionError(e.message)
      refresh()
    } finally {
      setBusy(null)
    }
  }

  const releaseAndRebook = async () => {
    setActionError('')
    setBusy('cancel')
    try {
      await cancelBooking(bookingId)
    } catch {
      // already expired or cancelled: either way the slot is free
    }
    setBusy(null)
    rebookSamePicks()
  }

  const rebookSamePicks = () => {
    const s = flowSummary
    if (s?.service && (s.barber || s.preferAny)) {
      navigate('/book/schedule', { replace: true, state: { barber: s.barber, preferAny: s.preferAny, service: s.service } })
    } else {
      navigate('/book')
    }
  }

  if (loadError === 'not_found') {
    return (
      <EndCard
        title={<>Booking <em>tidak ditemukan.</em></>}
        text="Link ini tidak cocok dengan booking mana pun. Silakan mulai booking baru."
        onAgain={() => navigate('/book')}
      />
    )
  }

  if (!view) {
    return (
      <div className="bk-pay bk-pay--loading" aria-busy="true">
        <p className="bk-pay__status">{loadError || 'Memuat pembayaran…'}</p>
        {loadError ? (
          <button type="button" className="bk-secondary-link" onClick={refresh}>
            Coba lagi
          </button>
        ) : null}
      </div>
    )
  }

  if (view.status === 'confirmed') {
    return (
      <BookSuccess
        summary={summaryFrom(view, flowSummary)}
        paid={view.payment_status === 'paid' ? { amount: view.amount, servicePrice: view.service_price, demo: view.mode === 'demo' } : null}
      />
    )
  }

  if (view.status !== 'awaiting_payment') {
    const cancelled = view.status === 'cancelled'
    const paidLate = view.payment_status === 'paid_late'
    return (
      <EndCard
        icon
        title={cancelled ? <>Booking <em>dibatalkan.</em></> : <>Waktu <em>habis.</em></>}
        text={
          paidLate
            ? 'Pembayaranmu masuk setelah waktu habis dan slot ini sudah diambil pelanggan lain. Toko akan menghubungimu untuk refund.'
            : cancelled
              ? 'Slot ini sudah dilepas. Pilih jadwal baru kapan saja.'
              : `Pembayaran belum masuk dalam ${PAYMENT_HOLD_MINUTES} menit, jadi slot ${fmtTime(view.booking_time)} WITA dilepas untuk pelanggan lain. Belum ada uang yang tercatat masuk.`
        }
        onAgain={rebookSamePicks}
      />
    )
  }

  const demo = view.mode === 'demo'
  const rest = view.service_price && view.amount < view.service_price ? view.service_price - view.amount : 0
  const urgent = secondsLeft != null && secondsLeft <= 120
  const progress = Math.max(0, Math.min(1, (secondsLeft ?? 0) / (PAYMENT_HOLD_MINUTES * 60)))

  return (
    <div className="bk-pay">
      <header className="bk-pay__top">
        <Link to="/" className="bl__site-brand" aria-label="Beranda Norm Studio">
          <span className="bl__site-brand-line">Norm</span>
          <span className="bl__site-brand-line bl__site-brand-line--2">Studio</span>
        </Link>
      </header>

      <main className="bk-pay__card">
        <p className="bk-pay__kicker">Langkah terakhir</p>
        <h1 className="bk-pay__title">
          Bayar untuk <em>mengunci slot.</em>
        </h1>

        <div className={`bk-pay__timer${urgent ? ' bk-pay__timer--urgent' : ''}`} role="timer" aria-live="off">
          <div className="bk-pay__timer-row">
            <span>Slot ditahan</span>
            <span className="bk-pay__clock" aria-label={`Sisa waktu ${fmtClock(secondsLeft ?? 0)}`}>
              {fmtClock(secondsLeft ?? 0)}
            </span>
          </div>
          <div className="bk-pay__bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
          <p className="bk-pay__safe">Lewat waktu sebelum bayar? Slot dilepas, tidak ada uang yang terpotong.</p>
        </div>

        <div className="bk-pay__amount">
          <span className="bk-pay__amount-label">{rest ? 'DP sekarang' : 'Total'}</span>
          <span className="bk-pay__amount-val">{fmtPrice(view.amount)}</span>
          {rest ? <span className="bk-pay__amount-rest">Sisa {fmtPrice(rest)} dibayar di toko</span> : null}
        </div>

        <figure className="bk-pay__qr">
          {demo ? <span className="bk-pay__demo-tag">Contoh QR · demo</span> : null}
          <img src={view.qr_url} alt={demo ? 'Contoh QR untuk demo, bukan QRIS asli' : `QRIS Norm Studio, ${fmtPrice(view.amount)}`} width="240" height="240" />
          <figcaption title={view.order_id}>QRIS · order …{String(view.order_id).slice(-6)}</figcaption>
        </figure>

        <p className="bk-pay__status" role="status" aria-live="polite">
          <span className="bk-pay__pulse" aria-hidden="true" />
          Menunggu pembayaran
        </p>

        <ol className="bk-pay__steps">
          <li>Buka GoPay, OVO, DANA, ShopeePay atau m‑banking.</li>
          <li>Pilih <strong>Scan / Bayar</strong>, arahkan ke QR di atas.</li>
          <li>Halaman ini berubah sendiri begitu pembayaran masuk.</li>
        </ol>

        <div className="bk-pay__same-phone">
          <p>
            <strong>Bayar dari HP ini?</strong> Simpan gambar QR, lalu di aplikasi pembayaran pilih Scan dan
            ambil QR dari galeri.
          </p>
          <a className="bk-pay__save" href={view.qr_url} download={`QRIS-NormStudio-${view.booking_time.replace(':', '')}.png`} target="_blank" rel="noopener noreferrer">
            Simpan gambar QR
          </a>
        </div>

        {actionError ? (
          <p className="bk-pay__error" role="alert">
            {actionError}
          </p>
        ) : null}

        {demo ? (
          <div className="bk-pay__demo">
            <button type="button" className="bk-confirm-primary" onClick={simulatePay} disabled={busy != null}>
              {busy === 'pay' ? 'Memproses…' : 'Simulasikan pembayaran (demo)'}
            </button>
            <p className="bk-pay__demo-note">
              Mode demo: belum terhubung ke pembayaran asli. Tombol ini meniru pembayaran yang berhasil.
            </p>
          </div>
        ) : null}

        <dl className="bk-pay__summary">
          <div>
            <dt>Jadwal</dt>
            <dd>
              {fmtDateId(view.booking_date)} · {fmtTime(view.booking_time)} WITA
            </dd>
          </div>
          <div>
            <dt>Barber</dt>
            <dd>{view.barber_name || '—'}</dd>
          </div>
          <div>
            <dt>Layanan</dt>
            <dd>{view.service}</dd>
          </div>
        </dl>

        <button type="button" className="bk-secondary-link" onClick={releaseAndRebook} disabled={busy != null}>
          {busy === 'cancel' ? 'Melepas slot…' : 'Ganti jadwal'}
        </button>
      </main>
    </div>
  )
}

function EndCard({ title, text, onAgain, icon = false }) {
  return (
    <div className="bk-success">
      <div className="bk-success__card">
        {icon ? (
          <div className="bk-success__check bk-success__check--muted" aria-hidden="true">
            <ClockIcon />
          </div>
        ) : null}
        <p className="bk-success__title">{title}</p>
        <p className="bk-success__sub">{text}</p>
        <div className="bk-success__actions">
          <button type="button" className="bk-confirm-primary" onClick={onAgain}>
            Booking lagi
          </button>
          <Link className="bk-success__home" to="/">
            Ke beranda
          </Link>
        </div>
      </div>
    </div>
  )
}
