import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BookLayout from '../components/BookLayout'
import { createBooking, formatWhatsappForApi } from '../api/booking'
import { saveBookingContact } from '../bookingContactStorage'

/** Ganti dengan nomor WhatsApp bisnis (tanpa +), contoh: 6281234567890 */
const WHATSAPP_BUSINESS_E164 = '6281234567890'

function fmtPrice(n) {
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}

/** Clean legacy API phrasing for display */
function displayBookingError(raw) {
  if (!raw) return ''
  return String(raw)
    .replace(/\s*\(booked or blocked\)/gi, '')
    .replace(/\s*\(sudah dibooking atau diblokir\)/gi, '')
    .trim()
}

function buildWhatsAppHref(state, { afterWebConfirm = false } = {}) {
  const lines = [
    'Halo Rifki,',
    '',
    afterWebConfirm
      ? 'Saya sudah booking lewat website Teman Cukur. Ringkasannya:'
      : 'Saya ingin konfirmasi booking Teman Cukur:',
    `• Layanan: ${state?.service?.name ?? '-'}`,
    `• Tanggal: ${state?.date ?? '-'}`,
    `• Waktu: ${state?.time ?? '-'}`,
    `• Nama: ${state?.name ?? '-'}`,
  ]
  if (state?.notes) {
    lines.push(`• Catatan: ${state.notes}`)
  }
  lines.push('', 'Terima kasih!')
  const text = encodeURIComponent(lines.join('\n'))
  return `https://wa.me/${WHATSAPP_BUSINESS_E164}?text=${text}`
}

export default function BookConfirm() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (
      !state?.service ||
      !state?.date ||
      !state?.dateISO ||
      !state?.time ||
      !state?.name
    ) {
      navigate('/book', { replace: true })
    }
  }, [state, navigate])

  const waHrefAfterConfirm = useMemo(
    () => (state ? buildWhatsAppHref(state, { afterWebConfirm: true }) : '#'),
    [state]
  )

  const handleConfirmBooking = async () => {
    if (!state?.service || !state?.dateISO || !state?.time || !state?.name) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const whatsapp = formatWhatsappForApi(state.whatsapp)
      await createBooking({
        customer_name: state.name.trim(),
        whatsapp,
        service: state.service.name,
        date: state.dateISO,
        time: state.time,
      })
      saveBookingContact({
        name: state.name.trim(),
        whatsapp: state.whatsapp,
        notes: state.notes ?? '',
      })
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
    if (!state?.service) return
    saveBookingContact({
      name: state.name.trim(),
      whatsapp: state.whatsapp,
      notes: state.notes ?? '',
    })
    setSubmitError(null)
    navigate('/book/schedule', { state: { service: state.service } })
  }

  if (!state?.service) {
    return null
  }

  if (confirmed) {
    return (
      <div className="bk-success">
        <div className="bk-success__card">
          <div className="bk-success__check" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <polyline points="4 12 9 17 20 6" />
            </svg>
          </div>
          <p className="bk-success__title">
            Booking <em>terkonfirmasi.</em>
          </p>
          <p className="bk-success__sub">Sampai jumpa, {state.name}.</p>
          <div className="bk-notice--success" role="note">
            <p className="bk-notice__kicker">Pembatalan</p>
            <p className="bk-notice__body">
              Minimal 2 jam sebelum jam booking, sesuai ketentuan yang berlaku.
            </p>
          </div>
          <div className="bk-success__actions">
            <div className="bk-success__wa-group">
              <a
                className="bk-success-wa"
                href={waHrefAfterConfirm}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Kabari lewat WhatsApp
              </a>
              <div className="bk-success__optional">
                <p className="bk-success__optional-kicker">Opsional</p>
                <p className="bk-success__optional-text">
                  Booking kamu sudah aman tanpa chat WhatsApp ini.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="bk-success__home"
              onClick={() => navigate('/')}
            >
              Ke beranda
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <BookLayout
      step={4}
      summary={state}
      onContinue={() => undefined}
      canContinue={false}
      showSidebarCta={false}
      ctaLabel="Lanjut →"
    >
      <p className="bk-step-of">Langkah 4 dari 4</p>
      <h2 className="bk-title">Cek &amp; konfirmasi</h2>
      <p className="bk-sub">
        Periksa detail di bawah, lalu konfirmasi.
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
          <span className="confirm-row__label">Layanan</span>
          <span className="confirm-row__val">{state?.service?.name}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row__label">Tanggal</span>
          <span className="confirm-row__val">{state?.date}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row__label">Waktu</span>
          <span className="confirm-row__val">{state?.time}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row__label">Nama</span>
          <span className="confirm-row__val">{state?.name}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row__label">WhatsApp</span>
          <span className="confirm-row__val confirm-row__val--sans">
            +62 {state?.whatsapp}
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
      </div>

      <div className="bk-confirm-actions">
        <button
          type="button"
          className={`bk-confirm-primary${submitError ? ' bk-confirm-primary--blocked' : ''}`}
          onClick={handleConfirmBooking}
          disabled={submitting || Boolean(submitError)}
          aria-busy={submitting}
        >
          {submitting ? 'Menyimpan…' : 'Konfirmasi booking'}
        </button>
        <div className="bk-pay-note" role="status">
          <span className="bk-pay-note__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </span>
          <div className="bk-pay-note__copy">
            <p className="bk-pay-note__kicker">Metode pembayaran</p>
            <p className="bk-pay-note__title">Pembayaran di tempat</p>
          </div>
        </div>
      </div>
      </div>
    </BookLayout>
  )
}
