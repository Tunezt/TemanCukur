import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BookLayout from '../components/BookLayout'
import {
  loadBookingContact,
  saveBookingContact,
} from '../bookingContactStorage'

export default function BookDetails() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const storedContact = useMemo(() => {
    const s = loadBookingContact()
    return {
      name: s?.name ?? '',
      phone: s?.whatsapp ?? '',
      notes: s?.notes ?? '',
    }
  }, [])

  const [name, setName] = useState(storedContact.name)
  const [phone, setPhone] = useState(storedContact.phone)
  const [notes, setNotes] = useState(storedContact.notes)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!name.trim() || !phone.trim()) return
    const id = window.setTimeout(() => {
      saveBookingContact({
        name,
        whatsapp: phone,
        notes,
      })
    }, 600)
    return () => window.clearTimeout(id)
  }, [name, phone, notes])

  useEffect(() => {
    if (!state?.service || !state?.date || !state?.dateISO || !state?.time) {
      navigate('/book', { replace: true })
    }
  }, [state, navigate])

  const canContinue = name.trim().length > 0 && phone.trim().length > 0

  const proceed = () => {
    saveBookingContact({
      name: name.trim(),
      whatsapp: phone.trim(),
      notes: notes.trim(),
    })
    navigate('/book/confirm', {
      state: {
        ...state,
        name: name.trim(),
        whatsapp: phone.trim(),
        notes: notes.trim() || undefined,
      },
    })
  }

  if (!state?.service) {
    return null
  }

  return (
    <BookLayout
      step={3}
      summary={state}
      onContinue={proceed}
      canContinue={canContinue}
    >
      <p className="bk-step-of">Langkah 3 dari 4</p>
      <h2 className="bk-title">Data kamu</h2>
      <p className="bk-sub">Konfirmasi lewat WhatsApp.</p>

      <div className="bk-form">
        <div className="bk-field">
          <label className="bk-field__label" htmlFor="name">
            Nama lengkap
          </label>
          <input
            id="name"
            className="bk-field__input"
            type="text"
            placeholder="Nama lengkap"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="bk-field">
          <label className="bk-field__label" htmlFor="phone">
            Nomor WhatsApp
          </label>
          <div className="bk-field__phone-wrap">
            <span className="bk-field__phone-prefix">+62</span>
            <input
              id="phone"
              className="bk-field__input"
              type="tel"
              placeholder="08xx xxxx xxxx"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="bk-field">
          <label className="bk-field__label" htmlFor="notes">
            Catatan (opsional)
          </label>
          <textarea
            id="notes"
            className="bk-field__textarea"
            placeholder="Ada request khusus? Contoh: minta foto referensi"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <p className="bk-field__hint">
            Kalau ada referensi gaya, bisa kamu share langsung ke WhatsApp
            setelah booking.
          </p>
        </div>
      </div>
    </BookLayout>
  )
}
