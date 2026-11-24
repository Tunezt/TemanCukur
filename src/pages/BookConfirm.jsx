import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BookLayout from '../components/BookLayout'
import BookSuccess from '../components/BookSuccess'
import { fmtPrice, fmtTime } from '../format'
import { createBooking, fetchPaymentConfig, formatWhatsappForApi } from '../api/booking'
import { saveBookingContact } from '../bookingContactStorage'

function hasBarberChoice(state) {
  return Boolean(state?.preferAny || state?.barber?.id)
}

/** Clean legacy API phrasing for display */
function displayBookingError(raw) {
  if (!raw) return ''
  return String(raw)
    .replace(/\s*\(booked or blocked\)/gi, '')
    .replace(/\s*\(sudah dibooking atau diblokir\)/gi, '')
    .trim()
}

export default function BookConfirm() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  /** null while loading; mode 'off' = pay at the shop, otherwise QRIS before the slot is yours */
  const [payConfig, setPayConfig] = useState(null)

  useEffect(() => {
    fetchPaymentConfig()
      .then(setPayConfig)
      .catch(() => setPayConfig(null)) // the server still decides; only labels depend on this
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (
      !hasBarberChoice(state) ||
      !state?.service ||
      !state?.date ||
      !state?.dateISO ||
      !state?.time ||
      !state?.name
    ) {
      navigate('/book', { replace: true })
    }
  }, [state, navigate])

  const handleConfirmBooking = async () => {
    if (
      !hasBarberChoice(state) ||
      !state?.service ||
      !state?.dateISO ||
      !state?.time ||
      !state?.name
    ) {
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      const whatsapp = formatWhatsappForApi(state.whatsapp)
      const payload = {
        customer_name: state.name.trim(),
        whatsapp,
        service: state.service.name,
        service_price: Number(state.service.price),
        date: state.dateISO,
        time: state.time,
      }
      if (state.preferAny) {
        payload.prefer_any_barber = true
      } else {
        payload.barber_id = state.barber.id
      }
      const res = await createBooking(payload)
      saveBookingContact({
        name: state.name.trim(),
        whatsapp: state.whatsapp,
        notes: state.notes ?? '',
      })
      if (res.payment) {
        navigate(`/book/pay/${res.payment.booking_id}`, {
          replace: true,
          state: { summary: state, payment: res.payment },
        })
        return
      }
      setConfirmed(true)
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'Terjadi kesalahan. Coba lagi.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const goPickAnotherTime = () => {
    if (!hasBarberChoice(state) || !state?.service) return
    saveBookingContact({
      name: state.name.trim(),
      whatsapp: state.whatsapp,
      notes: state.notes ?? '',
    })
    setSubmitError(null)
    navigate('/book/schedule', {
      state: {
        barber: state.barber,
        preferAny: state.preferAny,
        service: state.service,
      },
    })
  }

  if (!hasBarberChoice(state) || !state?.service) {
    return null
  }

  if (confirmed) {
    return <BookSuccess summary={state} />
  }

  const payOnline = payConfig && payConfig.mode !== 'off'
  const payNow = payOnline
    ? Math.min(payConfig.deposit_idr || Infinity, Number(state.service.price))
    : null

  const barberDisplay = state.preferAny
    ? 'Tidak ada preferensi'
    : state.barber?.name

  return (
    <BookLayout
      step={5}
      summary={state}
      onContinue={() => undefined}
      canContinue={false}
      showSidebarCta={false}
      ctaLabel="Lanjut →"
    >
      <p className="bk-step-of">Langkah 5 dari 5</p>
      <h2 className="bk-title">Cek &amp; konfirmasi</h2>
      <p className="bk-sub">
        {payOnline
          ? 'Periksa detail di bawah. Slot jadi milikmu setelah dibayar lewat QRIS.'
          : 'Periksa detail di bawah, lalu konfirmasi.'}
      </p>
      <p className="bk-policy-hint" role="note">
        Untuk pembatalan: minimal 2 jam sebelum jam booking, sesuai ketentuan yang berlaku.
      </p>

      <div className="bk-confirm-stack">
      {submitError ? (
        <div className="bk-confirm-error" role="alert" aria-live="assertive">
          <p className="bk-confirm-error__title">Tidak bisa mengonfirmasi booking ini</p>
          <p className="bk-confirm-error__text">
            {displayBookingError(submitError)}
          </p>
          <button
            type="button"
            className="bk-rebook-btn"
            onClick={goPickAnotherTime}
          >
            Pilih jam lain
          </button>
        </div>
      ) : null}

      <div className="confirm-rows">
        <div className="confirm-row">
          <span className="confirm-row__label">Barber</span>
          <span className="confirm-row__val">{barberDisplay}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row__label">Layanan</span>
          <span className="confirm-row__val">{state?.service?.name}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row__label">Tanggal</span>
          <span className="confirm-row__val">{state?.date}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row__label">Waktu</span>
          <span className="confirm-row__val">{fmtTime(state?.time)} WITA</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row__label">Nama</span>
          <span className="confirm-row__val">{state?.name}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row__label">WhatsApp</span>
          <span className="confirm-row__val confirm-row__val--sans">
            +62 {formatWhatsappForApi(state?.whatsapp).slice(3)}
          </span>
        </div>
        {state?.notes ? (
          <div className="confirm-row">
            <span className="confirm-row__label">Catatan</span>
            <span className="confirm-row__val confirm-row__val--sans">
              {state.notes}
            </span>
          </div>
        ) : null}
        <div className="confirm-row">
          <span className="confirm-row__label">Total</span>
          <span className="confirm-row__val confirm-row__val--price">
            {fmtPrice(state?.service?.price)}
          </span>
        </div>
        {payOnline && payNow < Number(state.service.price) ? (
          <div className="confirm-row">
            <span className="confirm-row__label">Bayar sekarang (DP)</span>
            <span className="confirm-row__val confirm-row__val--price">{fmtPrice(payNow)}</span>
          </div>
        ) : null}
      </div>

      <div className="bk-confirm-actions">
        <div className="bk-pay-note" role="status">
          <span className="bk-pay-note__icon" aria-hidden="true">
            {payOnline ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
                <path strokeLinecap="round" d="M14 14h2v2h-2zM18 18h2v2h-2zM14 20h2M20 14v2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </span>
          <div className="bk-pay-note__copy">
            <p className="bk-pay-note__kicker">Metode pembayaran</p>
            {payOnline ? (
              <>
                <p className="bk-pay-note__title">QRIS: GoPay, OVO, DANA, ShopeePay, m-banking</p>
                <p className="bk-pay-note__text">
                  Slot ditahan {payConfig.hold_minutes} menit untukmu sambil menunggu pembayaran.
                </p>
              </>
            ) : (
              <p className="bk-pay-note__title">Pembayaran di tempat</p>
            )}
          </div>
        </div>
        <button
          type="button"
          className={`bk-confirm-primary${submitError ? ' bk-confirm-primary--blocked' : ''}`}
          onClick={handleConfirmBooking}
          disabled={submitting || Boolean(submitError)}
          aria-busy={submitting}
        >
          {submitting
            ? payOnline ? 'Menyiapkan QRIS…' : 'Menyimpan…'
            : payOnline ? `Bayar ${fmtPrice(payNow)} dengan QRIS` : 'Konfirmasi booking'}
        </button>
      </div>
      </div>
    </BookLayout>
  )
}
