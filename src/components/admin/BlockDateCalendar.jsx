import { useState } from 'react'

const WEEKDAYS = ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb']

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** @param {string} iso YYYY-MM-DD */
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m: m - 1, d }
}

function ymFrom(iso) {
  const p = parseISO(iso)
  return { y: p.y, m: p.m }
}

/**
 * @param {{
 *   minDate: string,
 *   selectedDates: string[],
 *   onToggleDate: (iso: string) => void,
 *   className?: string,
 *   selectionMode?: 'single' | 'multi',
 * }} props
 *
 * `minDate` — earliest selectable calendar day (YYYY-MM-DD, WITA). Days before this
 * are disabled. Sundays are always disabled (Mon–Sat only, same as booking).
 * `selectionMode` — parent enforces single vs multi; affects hint only.
 */
export default function BlockDateCalendar({
  minDate,
  selectedDates,
  onToggleDate,
  className = '',
  selectionMode = 'multi',
}) {
  const base =
    selectedDates[0] && /^\d{4}-\d{2}-\d{2}$/.test(selectedDates[0])
      ? selectedDates[0]
      : minDate
  const [view, setView] = useState(() => ymFrom(base))

  const { y: vy, m: vm } = view

  const title = (() => {
    const dt = new Date(vy, vm, 1)
    return dt.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  })()

  const first = new Date(vy, vm, 1)
  const leadingBlanks = first.getDay()
  const dim = new Date(vy, vm + 1, 0).getDate()
  const cells = []
  for (let d = 1; d <= dim; d++) {
    const iso = `${vy}-${pad2(vm + 1)}-${pad2(d)}`
    cells.push({ d, iso })
  }

  const goMonth = (delta) => {
    setView((v) => {
      const t = new Date(v.y, v.m + delta, 1)
      return { y: t.getFullYear(), m: t.getMonth() }
    })
  }

  const sel = new Set(selectedDates)

  return (
    <div
      className={`adm-cal${selectionMode === 'single' ? ' adm-cal--single' : ''} ${className}`.trim()}
      data-selection={selectionMode}
    >
      <div className="adm-cal__head">
        <button
          type="button"
          className="adm-cal__nav"
          aria-label="Bulan sebelumnya"
          onClick={() => goMonth(-1)}
        >
          ‹
        </button>
        <h3 className="adm-cal__title">{title}</h3>
        <button
          type="button"
          className="adm-cal__nav"
          aria-label="Bulan berikutnya"
          onClick={() => goMonth(1)}
        >
          ›
        </button>
      </div>
      <div className="adm-cal__weekdays" role="row">
        {WEEKDAYS.map((w) => (
          <span key={w} className="adm-cal__wd">
            {w}
          </span>
        ))}
      </div>
      <div className="adm-cal__grid" role="grid">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`b${i}`} className="adm-cal__cell adm-cal__cell--pad" aria-hidden />
        ))}
        {cells.map(({ d, iso }) => {
          const dow = new Date(vy, vm, d).getDay()
          const sunday = dow === 0
          const beforeMin = iso < minDate
          const disabled = beforeMin || sunday
          const selected = sel.has(iso)
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              disabled={disabled}
              title={
                sunday
                  ? 'Tutup (Minggu)'
                  : beforeMin
                    ? 'Tidak tersedia'
                    : undefined
              }
              className={`adm-cal__cell${selected ? ' adm-cal__cell--selected' : ''}${beforeMin ? ' adm-cal__cell--past' : ''}${sunday ? ' adm-cal__cell--closed' : ''}`}
              onClick={() => {
                if (disabled) return
                onToggleDate(iso)
              }}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
