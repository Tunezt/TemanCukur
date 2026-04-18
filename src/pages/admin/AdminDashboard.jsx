import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  adminCancelBooking,
  adminCreateBlock,
  adminDeleteBlock,
  adminListBlocks,
  adminListBookings,
} from '../../api/adminApi'
import BlockDateCalendar from '../../components/admin/BlockDateCalendar'
import { clearAdminAuth, isAdminAuthenticated } from '../../admin/auth'
import {
  earliestSelectableBlockDateISO,
  formatDateHeadingId,
  formatDateLabel,
  isSundayISO,
  todayWitaISO,
} from '../../admin/dates'
import '../../admin/admin.css'

const SLOT_OPTIONS = [
  '09:00',
  '10:00',
  '11:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
]

function sortSlotsShopOrder(slots) {
  return [...new Set(slots)].sort(
    (a, b) => SLOT_OPTIONS.indexOf(a) - SLOT_OPTIONS.indexOf(b)
  )
}

const EMPTY_BLOCKED_TIME_SET = new Set()

function waHref(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return '#'
  return `https://wa.me/${digits}`
}

function IconRefresh() {
  return (
    <svg className="adm-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.65 6.35A7.95 7.95 0 0012 4V1L7 6l5 5V6.5c2.48 0 4.5 2.02 4.5 4.5s-2.02 4.5-4.5 4.5-4.5-2.02-4.5-4.5H6c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.66-.67-3.16-1.76-4.24z"
      />
    </svg>
  )
}

function IconCancelX() {
  return (
    <svg className="adm-card__cancel-x" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        d="M9 9l6 6M15 9l-6 6"
      />
    </svg>
  )
}

function SkeletonCards() {
  return (
    <div className="adm-skel-wrap" aria-hidden="true">
      {[1, 2, 3].map((k) => (
        <div key={k} className="adm-skel-card">
          <div className="adm-skel adm-skel--time" />
          <div className="adm-skel adm-skel--line" />
          <div className="adm-skel adm-skel--line adm-skel--short" />
          <div className="adm-skel adm-skel--line" />
        </div>
      ))}
    </div>
  )
}

function BookingCard({ booking, onRequestCancel, cancelling }) {
  const b = booking
  return (
    <article className="adm-card">
      <div className="adm-card__head">
        <div className="adm-card__head-main">
          <span className="adm-card__time-wrap">
            <span className="adm-card__time">{b.booking_time}</span>
            <span className="adm-card__tz">WITA</span>
          </span>
        </div>
        <span className="adm-card__status">Dikonfirmasi</span>
      </div>
      <div className="adm-card__body">
        <div className="adm-card__grid">
          <div className="adm-card__cell">
            <span className="adm-card__label">Pelanggan</span>
            <span className="adm-card__val">{b.customer_name}</span>
          </div>
          <div className="adm-card__cell">
            <span className="adm-card__label">Layanan</span>
            <span className="adm-card__val adm-card__val--display">{b.service}</span>
          </div>
          <div className="adm-card__cell adm-card__cell--wide">
            <span className="adm-card__label">WhatsApp</span>
            <a
              className="adm-card__wa"
              href={waHref(b.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {b.whatsapp}
            </a>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="adm-card__cancel"
        disabled={cancelling}
        onClick={() => onRequestCancel(b)}
      >
        <IconCancelX />
        <span>{cancelling ? 'Membatalkan…' : 'Batalkan booking'}</span>
      </button>
    </article>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('today')
  const [bookings, setBookings] = useState([])
  const [blocks, setBlocks] = useState([])
  const [loadBookingsErr, setLoadBookingsErr] = useState('')
  const [loadBlocksErr, setLoadBlocksErr] = useState('')
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [cancelDialog, setCancelDialog] = useState(null)
  /** YYYY-MM-DD, sorted; same slot choices apply to each day when using Pick times */
  const [selectedBlockDates, setSelectedBlockDates] = useState([])
  /** whole day (single DB row, time null) | pick discrete slots */
  const [blockMode, setBlockMode] = useState('slots')
  const [selectedSlots, setSelectedSlots] = useState([])
  const [blockSubmitting, setBlockSubmitting] = useState(false)
  const [blockFormErr, setBlockFormErr] = useState('')
  const [unblockingId, setUnblockingId] = useState(null)
  const [toast, setToast] = useState(null)
  /** Re-render blocked tab ~every minute so “today” rolls off after closing time (WITA). */
  const [, setBlockCalendarTick] = useState(0)

  const today = todayWitaISO()
  const minBlockDate = earliestSelectableBlockDateISO()

  const showToast = (text, kind = 'success') => {
    const isError = kind === 'error'
    setToast({ text, isError })
    window.setTimeout(() => setToast(null), isError ? 5200 : 3200)
  }

  const refreshBookings = useCallback(async () => {
    setLoadBookingsErr('')
    setLoadingBookings(true)
    try {
      const rows = await adminListBookings({ from: today })
      const confirmed = rows.filter((b) => b.status === 'confirmed')
      setBookings(confirmed)
    } catch (e) {
      setBookings([])
      setLoadBookingsErr(
        e instanceof Error ? e.message : 'Gagal memuat booking.'
      )
    } finally {
      setLoadingBookings(false)
    }
  }, [today])

  const refreshBlocks = useCallback(async () => {
    setLoadBlocksErr('')
    setLoadingBlocks(true)
    try {
      const rows = await adminListBlocks()
      setBlocks(rows)
    } catch (e) {
      setBlocks([])
      setLoadBlocksErr(
        e instanceof Error ? e.message : 'Gagal memuat blok.'
      )
    } finally {
      setLoadingBlocks(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      navigate('/admin/login', { replace: true })
      return
    }
    refreshBookings()
  }, [navigate, refreshBookings])

  useEffect(() => {
    if (tab !== 'blocked' || !isAdminAuthenticated()) return
    refreshBlocks()
  }, [tab, refreshBlocks])

  useEffect(() => {
    if (tab !== 'blocked') return
    const id = window.setInterval(
      () => setBlockCalendarTick((n) => n + 1),
      60_000
    )
    return () => window.clearInterval(id)
  }, [tab])

  useEffect(() => {
    setSelectedBlockDates((prev) =>
      prev.filter((iso) => iso >= minBlockDate && !isSundayISO(iso))
    )
  }, [minBlockDate])

  /** Pick times: clear pending slot picks only when the selected day string changes (not on array ref churn). */
  const slotDateKey =
    blockMode === 'slots'
      ? [...selectedBlockDates].sort().join(',')
      : ''
  useEffect(() => {
    if (blockMode !== 'slots') return
    setSelectedSlots([])
  }, [slotDateKey, blockMode])

  const selectedBlockDate =
    blockMode === 'slots' && selectedBlockDates.length === 1
      ? selectedBlockDates[0]
      : null

  const blockedTimesForSelectedDate = useMemo(() => {
    if (!selectedBlockDate) return EMPTY_BLOCKED_TIME_SET
    const s = new Set()
    for (const bl of blocks) {
      if (bl.block_date === selectedBlockDate && bl.block_time) {
        s.add(bl.block_time)
      }
    }
    return s
  }, [blocks, selectedBlockDate])

  useEffect(() => {
    if (blockMode !== 'slots') return
    setSelectedSlots((prev) =>
      prev.filter((t) => !blockedTimesForSelectedDate.has(t))
    )
  }, [blockedTimesForSelectedDate, blockMode])

  const todayList = useMemo(() => {
    const list = bookings.filter((b) => b.booking_date === today)
    return [...list].sort((a, b) =>
      a.booking_time.localeCompare(b.booking_time)
    )
  }, [bookings, today])

  const upcomingGrouped = useMemo(() => {
    const list = bookings.filter((b) => b.booking_date > today)
    const sorted = [...list].sort((a, b) => {
      const dc = a.booking_date.localeCompare(b.booking_date)
      return dc !== 0 ? dc : a.booking_time.localeCompare(b.booking_time)
    })
    const map = new Map()
    for (const b of sorted) {
      const k = b.booking_date
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(b)
    }
    return map
  }, [bookings, today])

  const upcomingCount = useMemo(() => {
    let n = 0
    for (const [, list] of upcomingGrouped) n += list.length
    return n
  }, [upcomingGrouped])

  const logout = () => {
    clearAdminAuth()
    navigate('/admin/login', { replace: true })
  }

  const cancelBooking = async (rawId) => {
    const id = String(rawId).trim()
    if (!id || id === 'undefined') {
      showToast('ID booking tidak ada — muat ulang halaman dan coba lagi.', 'error')
      return
    }
    setCancellingId(id)
    try {
      await adminCancelBooking(id)
      setBookings((prev) => prev.filter((b) => String(b.id) !== id))
      showToast('Booking dibatalkan.', 'success')
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Gagal membatalkan. Periksa jaringan dan coba lagi.'
      showToast(msg, 'error')
    } finally {
      setCancellingId(null)
    }
  }

  const openCancelDialog = (b) => {
    setCancelDialog({
      id: String(b.id),
      customerName: b.customer_name?.trim() || 'Pelanggan',
      time: b.booking_time,
      service: b.service ?? '—',
      dateLabel: b.booking_date ? formatDateLabel(b.booking_date) : null,
    })
  }

  const confirmCancelFromDialog = () => {
    if (!cancelDialog) return
    const id = cancelDialog.id
    setCancelDialog(null)
    cancelBooking(id)
  }

  useEffect(() => {
    if (!cancelDialog) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setCancelDialog(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [cancelDialog])

  const toggleSlot = (t) => {
    if (blockMode === 'slots' && blockedTimesForSelectedDate.has(t)) return
    setSelectedSlots((prev) => {
      const has = prev.includes(t)
      const next = has ? prev.filter((x) => x !== t) : [...prev, t]
      return sortSlotsShopOrder(next)
    })
  }

  const toggleBlockDate = (iso) => {
    if (blockMode === 'slots') {
      setSelectedBlockDates((prev) => {
        if (prev.length === 1 && prev[0] === iso) return []
        return [iso]
      })
      return
    }
    setSelectedBlockDates((prev) => {
      const has = prev.includes(iso)
      const next = has ? prev.filter((x) => x !== iso) : [...prev, iso]
      return next.sort()
    })
  }

  const setBlockModeAndCoerceDates = (mode) => {
    setBlockMode(mode)
    if (mode === 'slots') {
      setSelectedBlockDates((prev) => {
        const ok = prev.filter((d) => d >= minBlockDate && !isSundayISO(d))
        if (ok.length <= 1) return ok
        return [ok.sort()[0]]
      })
    }
  }

  const submitBlock = async (e) => {
    e.preventDefault()
    setBlockFormErr('')
    const dates = [...selectedBlockDates].sort()
    if (dates.length === 0) {
      setBlockFormErr(
        blockMode === 'slots'
          ? 'Pilih satu hari di kalender.'
          : 'Pilih satu atau lebih hari di kalender.'
      )
      return
    }
    setBlockSubmitting(true)
    try {
      if (blockMode === 'whole') {
        for (const date of dates) {
          await adminCreateBlock({ date, time: null })
        }
        await refreshBlocks()
        showToast(
          dates.length === 1
            ? 'Hari penuh diblokir.'
            : `${dates.length} hari penuh diblokir.`
        )
      } else {
        if (dates.length !== 1) {
          setBlockFormErr('Mode pilih jam: satu tanggal saja. Pilih satu tanggal.')
          return
        }
        const date = dates[0]
        const slots = sortSlotsShopOrder(
          selectedSlots.filter((t) => !blockedTimesForSelectedDate.has(t))
        )
        if (slots.length === 0) {
          const tried = sortSlotsShopOrder(selectedSlots)
          setBlockFormErr(
            tried.length > 0
              ? 'Jam itu sudah diblokir untuk hari ini.'
              : 'Pilih satu atau lebih slot, atau pakai Hari penuh.'
          )
          return
        }
        for (const t of slots) {
          await adminCreateBlock({ date, time: t })
        }
        await refreshBlocks()
        setSelectedSlots([])
        const total = slots.length
        showToast(
          total === 1
            ? `Diblokir ${slots[0]}.`
            : `${total} slot diblokir untuk ${formatDateLabel(date)}.`
        )
      }
    } catch (err) {
      setBlockFormErr(
        err instanceof Error ? err.message : 'Gagal membuat blok.'
      )
    } finally {
      setBlockSubmitting(false)
    }
  }

  const unblock = async (id) => {
    setUnblockingId(id)
    try {
      await adminDeleteBlock(id)
      setBlocks((prev) => prev.filter((b) => String(b.id) !== String(id)))
      showToast('Blok dihapus.')
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Gagal menghapus blok. Coba lagi.'
      showToast(msg, 'error')
    } finally {
      setUnblockingId(null)
    }
  }

  if (!isAdminAuthenticated()) return null

  const hasBookingsData = !loadBookingsErr && !loadingBookings

  return (
    <div className="adm adm-dash">
      <header className="adm-nav">
        <div className="adm-nav__left">
          <span className="adm-nav__brand">
            <span className="adm-nav__brand-sans">teman</span>{' '}
            <span className="adm-nav__brand-serif">cukur</span>
          </span>
          <p className="adm-nav__sub">
            ADMIN · WITA · {formatDateLabel(today).toUpperCase()}
          </p>
        </div>
        <div className="adm-nav__actions">
          <button
            type="button"
            className="adm-nav__iconbtn"
            onClick={() => {
              refreshBookings()
              if (tab === 'blocked') refreshBlocks()
            }}
            disabled={loadingBookings}
            title="Muat ulang"
            aria-label="Muat ulang data"
          >
            <IconRefresh />
          </button>
          <button type="button" className="adm-nav__btn" onClick={logout}>
            Keluar
          </button>
        </div>
      </header>

      <div className="adm-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'today'}
          className={`adm-tab${tab === 'today' ? ' adm-tab--active' : ''}`}
          onClick={() => setTab('today')}
        >
          Hari ini
          {hasBookingsData ? (
            <span className="adm-tab__badge">{todayList.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upcoming'}
          className={`adm-tab${tab === 'upcoming' ? ' adm-tab--active' : ''}`}
          onClick={() => setTab('upcoming')}
        >
          Mendatang
          {hasBookingsData && upcomingCount > 0 ? (
            <span className="adm-tab__badge">{upcomingCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'blocked'}
          className={`adm-tab${tab === 'blocked' ? ' adm-tab--active' : ''}`}
          onClick={() => setTab('blocked')}
        >
          Blok
          {!loadBlocksErr && blocks.length > 0 ? (
            <span className="adm-tab__badge">{blocks.length}</span>
          ) : null}
        </button>
      </div>

      <main className="adm-main">
        {tab === 'today' && (
          <section aria-labelledby="adm-today-h" className="adm-section">
            <h2 id="adm-today-h" className="adm-section__title">
              Jadwal hari ini
            </h2>
            <p className="adm-section__lede">
              Booking terkonfirmasi untuk {formatDateLabel(today)}.
            </p>
            {loadBookingsErr ? (
              <div className="adm-panel adm-panel--err" role="alert">
                <p className="adm-panel__title">Gagal memuat booking</p>
                <p className="adm-panel__text">{loadBookingsErr}</p>
                <button
                  type="button"
                  className="adm-panel__retry"
                  onClick={() => refreshBookings()}
                >
                  Coba lagi
                </button>
              </div>
            ) : null}
            {loadingBookings ? (
              <SkeletonCards />
            ) : !loadBookingsErr && todayList.length === 0 ? (
              <div className="adm-empty">
                <p className="adm-empty__title">Belum ada booking hari ini</p>
                <p className="adm-empty__text">
                  Booking baru muncul di sini setelah pelanggan konfirmasi online.
                </p>
              </div>
            ) : !loadBookingsErr ? (
              <div className="adm-card-list">
                {todayList.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onRequestCancel={openCancelDialog}
                    cancelling={cancellingId === String(b.id)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        )}

        {tab === 'upcoming' && (
          <section aria-labelledby="adm-up-h" className="adm-section">
            <h2 id="adm-up-h" className="adm-section__title">
              Yang akan datang
            </h2>
            <p className="adm-section__lede">Setelah hari ini, urut tanggal terdekat.</p>
            {loadBookingsErr ? (
              <div className="adm-panel adm-panel--err" role="alert">
                <p className="adm-panel__title">Gagal memuat booking</p>
                <p className="adm-panel__text">{loadBookingsErr}</p>
                <button
                  type="button"
                  className="adm-panel__retry"
                  onClick={() => refreshBookings()}
                >
                  Coba lagi
                </button>
              </div>
            ) : null}
            {loadingBookings ? (
              <SkeletonCards />
            ) : !loadBookingsErr && upcomingGrouped.size === 0 ? (
              <div className="adm-empty">
                <p className="adm-empty__title">Tidak ada booking mendatang</p>
                <p className="adm-empty__text">
                  Yang terjadwal ada di Hari ini, atau kalender kosong.
                </p>
              </div>
            ) : !loadBookingsErr ? (
              [...upcomingGrouped.entries()].map(([dateStr, list], idx) => (
                <div key={dateStr} className="adm-date-group">
                  {idx > 0 ? (
                    <p className="adm-group__dots" aria-hidden="true">
                      · · ·
                    </p>
                  ) : null}
                  <div className="adm-group__header">
                    <h3 className="adm-group__date">{formatDateHeadingId(dateStr)}</h3>
                    <span className="adm-group__rule" aria-hidden="true" />
                  </div>
                  <div className="adm-card-list">
                    {list.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        onRequestCancel={openCancelDialog}
                        cancelling={cancellingId === String(b.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : null}
          </section>
        )}

        {tab === 'blocked' && (
          <section aria-labelledby="adm-bl-h" className="adm-section">
            <h2 id="adm-bl-h" className="adm-section__title">
              Blok waktu
            </h2>
            <ul className="adm-section__bullets" aria-label="Cara pemblokiran">
              <li>Hanya Senin–Sabtu (jam sama seperti situs booking).</li>
              <li>
                Setelah 20:00 WITA, hari ini tidak bisa dipilih — mulai dari besok.
              </li>
              <li>Tidak ada slot 12:00 — jeda makan siang.</li>
            </ul>

            <form className="adm-block-form" onSubmit={submitBlock}>
              <div className="adm-field">
                <span className="adm-field__label">Yang diblokir</span>
                <div className="adm-seg" role="group" aria-label="Jenis blok">
                  <button
                    type="button"
                    className={`adm-seg__btn${blockMode === 'whole' ? ' adm-seg__btn--on' : ''}`}
                    onClick={() => setBlockModeAndCoerceDates('whole')}
                  >
                    Hari penuh
                  </button>
                  <button
                    type="button"
                    className={`adm-seg__btn${blockMode === 'slots' ? ' adm-seg__btn--on' : ''}`}
                    onClick={() => setBlockModeAndCoerceDates('slots')}
                  >
                    Pilih jam
                  </button>
                </div>
                <p className="adm-field__hint">
                  {blockMode === 'whole'
                    ? 'Hari penuh memblokir semua slot sekaligus.'
                    : 'Pilih jam: satu tanggal, lalu pilih jam untuk tanggal itu.'}
                </p>
              </div>
              <div className="adm-field adm-field--cal">
                <span className="adm-field__label">
                  {blockMode === 'slots'
                    ? 'Tanggal (ketuk hari)'
                    : 'Tanggal (ketuk untuk pilih / batalkan)'}
                </span>
                <BlockDateCalendar
                  minDate={minBlockDate}
                  selectedDates={selectedBlockDates}
                  onToggleDate={toggleBlockDate}
                  selectionMode={blockMode === 'slots' ? 'single' : 'multi'}
                />
              </div>
              {blockMode === 'slots' ? (
                <div className="adm-field">
                  <span className="adm-field__label">Jam untuk tanggal ini</span>
                  <p className="adm-field__hint adm-field__hint--above-slots">
                    Jam yang sudah diblokir tampak redup. Ganti tanggal akan mengosongkan
                    pilihan di sini.
                  </p>
                  <div className="adm-slot-grid" role="group" aria-label="Slot jam">
                    {SLOT_OPTIONS.map((t) => {
                      const already = blockedTimesForSelectedDate.has(t)
                      const pending = selectedSlots.includes(t)
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={already}
                          title={
                            already ? 'Sudah diblokir — buka blok di bawah' : undefined
                          }
                          className={`adm-slot-chip${pending ? ' adm-slot-chip--on' : ''}${already ? ' adm-slot-chip--blocked' : ''}`}
                          onClick={() => toggleSlot(t)}
                        >
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {blockFormErr ? (
                <p className="adm-err" role="alert">
                  {blockFormErr}
                </p>
              ) : null}
              <button
                type="submit"
                className="adm-block-form__submit"
                disabled={blockSubmitting}
              >
                {blockSubmitting
                  ? 'Menyimpan…'
                  : blockMode === 'whole'
                    ? 'Blokir hari penuh'
                    : 'Blokir jam terpilih'}
              </button>
            </form>

            {loadBlocksErr ? (
              <div className="adm-panel adm-panel--err" role="alert">
                <p className="adm-panel__title">Gagal memuat blok</p>
                <p className="adm-panel__text">{loadBlocksErr}</p>
                <button
                  type="button"
                  className="adm-panel__retry"
                  onClick={() => refreshBlocks()}
                >
                  Coba lagi
                </button>
              </div>
            ) : null}
            {loadingBlocks ? (
              <p className="adm-loading">Memuat blok…</p>
            ) : !loadBlocksErr && blocks.length === 0 ? (
              <div className="adm-empty">
                <p className="adm-empty__title">Belum ada blok</p>
                <p className="adm-empty__text">
                  Tambahkan tanggal di atas saat libur atau slot tidak dipakai.
                </p>
              </div>
            ) : !loadBlocksErr ? (
              <ul className="adm-block-list">
                {blocks.map((bl) => (
                  <li key={bl.id} className="adm-block-row">
                    <div className="adm-block-row__text">
                      <strong>{formatDateLabel(bl.block_date)}</strong>
                      {bl.block_time ? (
                        <span className="adm-block-row__time">
                          {' '}
                          · {bl.block_time}
                        </span>
                      ) : (
                        <span className="adm-block-row__allday"> · hari penuh</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="adm-block-row__un"
                      disabled={unblockingId === bl.id}
                      onClick={() => unblock(bl.id)}
                    >
                      {unblockingId === bl.id ? '…' : 'Buka blok'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}
      </main>

      {cancelDialog ? (
        <div className="adm-modal-root">
          <button
            type="button"
            className="adm-modal-backdrop"
            aria-label="Tutup dialog"
            onClick={() => setCancelDialog(null)}
          />
          <div
            className="adm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adm-cancel-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="adm-cancel-dialog-title" className="adm-modal__title">
              Batalkan booking ini?
            </h2>
            <p className="adm-modal__meta">
              <span className="adm-modal__name">{cancelDialog.customerName}</span>
              <span className="adm-modal__dot" aria-hidden="true">
                ·
              </span>
              <span>{cancelDialog.service}</span>
            </p>
            <p className="adm-modal__when">
              {cancelDialog.dateLabel ? (
                <>
                  <span className="adm-modal__date">{cancelDialog.dateLabel}</span>
                  <span className="adm-modal__dot" aria-hidden="true">
                    {' '}
                    ·{' '}
                  </span>
                </>
              ) : null}
              <span className="adm-modal__time">{cancelDialog.time}</span>
            </p>
            <p className="adm-modal__warn">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="adm-modal__actions">
              <button
                type="button"
                className="adm-modal__btn"
                autoFocus
                onClick={() => setCancelDialog(null)}
              >
                Tetap simpan booking
              </button>
              <button
                type="button"
                className="adm-modal__btn adm-modal__btn--danger"
                onClick={confirmCancelFromDialog}
              >
                Ya, batalkan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`adm-toast${toast.isError ? ' adm-toast--err' : ''}`}
          role={toast.isError ? 'alert' : 'status'}
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  )
}
