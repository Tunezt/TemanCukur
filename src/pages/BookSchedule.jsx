import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BookLayout from '../components/BookLayout'
import { fetchAvailableSlots } from '../api/booking'
import { todayWitaISO } from '../admin/dates'

const DAY_NAMES = ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb']

function toISODate({ year, month, day }) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

/** @param {number} y @param {number} month0 0–11 @param {number} day */
function isoFromYMD(y, month0, day) {
  return `${y}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function BookSchedule() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const todayIso = todayWitaISO()
  const [ty, tm1] = todayIso.split('-').map(Number)
  const todayMonth0 = tm1 - 1

  const [viewYear, setViewYear] = useState(ty)
  const [viewMonth, setViewMonth] = useState(todayMonth0)
  const [selDate, setSelDate] = useState(null)
  const [selTime, setSelTime] = useState(null)
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState(null)
  const fetchSeq = useRef(0)

  /** After prefetch: which YYYY-MM-DD still have ≥1 bookable slot (Mon–Sat, future) */
  const [slotAvailability, setSlotAvailability] = useState({})
  /** When this matches `viewKey`, prefetch for the visible month has finished */
  const [fetchedAvailabilityKey, setFetchedAvailabilityKey] = useState(null)

  const viewKey = `${viewYear}-${viewMonth}`
  const monthPrefetchDone = fetchedAvailabilityKey === viewKey

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!state?.service) {
      navigate('/book', { replace: true })
    }
  }, [state, navigate])

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()

  const isPrevDisabled =
    viewYear < ty || (viewYear === ty && viewMonth <= todayMonth0)

  const resetMonthSelection = () => {
    fetchSeq.current += 1
    setSelDate(null)
    setSelTime(null)
    setAvailableSlots([])
    setSlotsError(null)
    setSlotsLoading(false)
  }

  const prevMonth = () => {
    resetMonthSelection()
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    resetMonthSelection()
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else setViewMonth((m) => m + 1)
  }

  useEffect(() => {
    let cancelled = false
    const key = viewKey

    const toFetch = []
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromYMD(viewYear, viewMonth, day)
      if (iso < todayIso) continue
      const dow = new Date(viewYear, viewMonth, day).getDay()
      if (dow === 0) continue
      toFetch.push(iso)
    }

    if (toFetch.length === 0) {
      Promise.resolve().then(() => {
        if (cancelled) return
        setFetchedAvailabilityKey(key)
      })
      return () => {
        cancelled = true
      }
    }

    Promise.all(
      toFetch.map((iso) =>
        fetchAvailableSlots(iso)
          .then((data) => ({
            iso,
            ok: Array.isArray(data.slots) && data.slots.length > 0,
          }))
          .catch(() => ({ iso, ok: false }))
      )
    ).then((results) => {
      if (cancelled) return
      const map = {}
      for (const { iso, ok } of results) map[iso] = ok
      setSlotAvailability(map)
      setFetchedAvailabilityKey(key)
    })

    return () => {
      cancelled = true
    }
  }, [viewKey, viewYear, viewMonth, daysInMonth, todayIso])

  const isPast = (d) => isoFromYMD(viewYear, viewMonth, d) < todayIso
  const isSunday = (d) => new Date(viewYear, viewMonth, d).getDay() === 0
  const isToday = (d) => isoFromYMD(viewYear, viewMonth, d) === todayIso
  const isSelected = (d) =>
    selDate &&
    selDate.year === viewYear &&
    selDate.month === viewMonth &&
    selDate.day === d

  const dayIso = (d) => isoFromYMD(viewYear, viewMonth, d)

  const isDayDisabled = (d) => {
    if (isPast(d)) return true
    if (isSunday(d)) return true
    const iso = dayIso(d)
    if (!monthPrefetchDone) return true
    return slotAvailability[iso] !== true
  }

  const selectDay = (d) => {
    if (isDayDisabled(d)) return
    const next = { year: viewYear, month: viewMonth, day: d }
    setSelDate(next)
    setSelTime(null)

    const seq = ++fetchSeq.current
    const iso = toISODate(next)
    setSlotsLoading(true)
    setSlotsError(null)

    fetchAvailableSlots(iso)
      .then((data) => {
        if (seq !== fetchSeq.current) return
        const slots = Array.isArray(data.slots) ? data.slots : []
        setAvailableSlots(slots)
      })
      .catch((err) => {
        if (seq !== fetchSeq.current) return
        setAvailableSlots([])
        setSlotsError(
          err instanceof Error ? err.message : 'Gagal memuat jam.'
        )
      })
      .finally(() => {
        if (seq !== fetchSeq.current) return
        setSlotsLoading(false)
      })
  }

  const monthYearLabel = new Date(viewYear, viewMonth).toLocaleDateString(
    'id-ID',
    { month: 'long', year: 'numeric' }
  )

  const panelDate = selDate
    ? new Date(selDate.year, selDate.month, selDate.day).toLocaleDateString(
        'id-ID',
        {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }
      )
    : null

  const proceed = () => {
    const d = new Date(selDate.year, selDate.month, selDate.day)
    const dateStr = d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const iso = toISODate(selDate)
    navigate('/book/details', {
      state: { ...state, date: dateStr, dateISO: iso, time: selTime },
    })
  }

  if (!state?.service) {
    return null
  }

  return (
    <BookLayout
      step={2}
      summary={{ ...state, date: panelDate, time: selTime }}
      onContinue={proceed}
      canContinue={!!selDate && !!selTime && !slotsLoading && !slotsError}
    >
      <p className="bk-step-of">Langkah 2 dari 4</p>
      <h2 className="bk-title">Pilih tanggal &amp; jam</h2>
      <p className="bk-sub">
        Senin–Sabtu saja. Hari tanpa slot terbuka tidak bisa dipilih. Booking
        hari ini jika jam di bawah masih tersedia.
      </p>

      <div className="cal">
        <div className="cal__nav">
          <button
            type="button"
            className="cal__arrow"
            onClick={prevMonth}
            disabled={isPrevDisabled}
            aria-label="Bulan sebelumnya"
          >
            ‹
          </button>
          <span className="cal__month">{monthYearLabel}</span>
          <button
            type="button"
            className="cal__arrow"
            onClick={nextMonth}
            aria-label="Bulan berikutnya"
          >
            ›
          </button>
        </div>

        <div className="cal__grid">
          {DAY_NAMES.map((n) => (
            <span key={n} className="cal__day-name">
              {n}
            </span>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <span key={`e${i}`} className="cal__day cal__day--empty" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const disabled = isDayDisabled(day)
            const past = isPast(day)
            const sunday = isSunday(day)
            const noSlots =
              monthPrefetchDone &&
              !past &&
              !sunday &&
              slotAvailability[dayIso(day)] === false
            return (
              <button
                key={day}
                type="button"
                className={[
                  'cal__day',
                  past ? 'cal__day--past' : '',
                  sunday ? 'cal__day--closed' : '',
                  noSlots ? 'cal__day--full' : '',
                  isToday(day) ? 'cal__day--today' : '',
                  isSelected(day) ? 'cal__day--sel' : '',
                  !monthPrefetchDone && !past && !sunday
                    ? 'cal__day--loading'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => selectDay(day)}
                disabled={disabled}
                title={
                  sunday
                    ? 'Tutup (Minggu)'
                    : noSlots
                      ? 'Tidak ada jam kosong'
                      : undefined
                }
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      <p className="ts-label">Jam tersedia</p>
      {selDate && slotsLoading ? (
        <p className="bk-sub">Memuat jam tersedia…</p>
      ) : selDate && slotsError ? (
        <p className="bk-sub">{slotsError}</p>
      ) : (
        <div className="ts-grid">
          {(selDate ? availableSlots : []).map((t) => (
            <button
              key={t}
              type="button"
              className={`ts-btn${selTime === t ? ' ts-btn--sel' : ''}`}
              onClick={() => setSelTime(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </BookLayout>
  )
}
