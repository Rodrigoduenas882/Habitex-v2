/**
 * A calendar-month boundary, expressed as a `[from, toExclusive)` range of
 * plain 'YYYY-MM-DD' date strings - the same shape ChargeRepository.
 * listByAdministration expects. No date library anywhere in this codebase
 * (and none is added here) - every computation below is plain `Date`
 * arithmetic, always in local time, never UTC (the same principle this
 * codebase already applies when parsing a plain-date column via
 * `${value}T00:00:00` - avoids an off-by-one day near midnight depending on
 * the viewer's timezone).
 */
export interface MonthRange {
  label: string
  /** 'YYYY-MM-DD', inclusive. */
  from: string
  /** 'YYYY-MM-DD', exclusive. */
  toExclusive: string
}

/**
 * es-CO short month abbreviations, matching dashboard-mock-data.ts's own
 * existing labels exactly ('Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep') -
 * Intl.DateTimeFormat('es-CO', { month: 'short' }) does not produce this
 * shape (it returns lowercase, trailing-dot forms like 'abr.'/'sept.'), so a
 * fixed table is used instead of relying on Intl.
 */
const MONTH_LABELS_ES_CO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const

function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

/** Formats a local-time year/monthIndex(0-based)/day into 'YYYY-MM-DD'. */
function formatDate(year: number, monthIndex: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

/**
 * Builds the `[from, toExclusive)` range + label for the calendar month at
 * `year`/`monthIndex` (0-based, may be outside 0-11 - `new Date(year,
 * monthIndex, 1)` normalizes month rollover/underflow correctly, e.g.
 * monthIndex -1 becomes December of the previous year).
 */
function monthRangeFor(year: number, monthIndex: number): MonthRange {
  const from = new Date(year, monthIndex, 1)
  const toExclusive = new Date(year, monthIndex + 1, 1)
  const label = MONTH_LABELS_ES_CO[((from.getMonth() % 12) + 12) % 12]

  if (!label) {
    // Unreachable - the modulo above always yields an index in [0, 11].
    throw new Error('month-range: impossible month index')
  }

  return {
    label,
    from: formatDate(from.getFullYear(), from.getMonth(), from.getDate()),
    toExclusive: formatDate(toExclusive.getFullYear(), toExclusive.getMonth(), toExclusive.getDate()),
  }
}

/**
 * The current calendar month, in local time - never UTC. `now` defaults to
 * `new Date()` but accepts an explicit value for deterministic testing.
 */
export function currentMonthRange(now: Date = new Date()): MonthRange {
  return monthRangeFor(now.getFullYear(), now.getMonth())
}

/**
 * The last `count` calendar months ending with the current one, oldest
 * first. Correctly crosses a year boundary (e.g. `now` in February with
 * count=6 reaches back into the prior August-January) because
 * `monthRangeFor`'s underlying `new Date(year, monthIndex, ...)` normalizes
 * a negative `monthIndex` instead of requiring manual year-rollover math.
 */
export function lastNMonthRanges(count: number, now: Date = new Date()): MonthRange[] {
  const currentYear = now.getFullYear()
  const currentMonthIndex = now.getMonth()

  const ranges: MonthRange[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    ranges.push(monthRangeFor(currentYear, currentMonthIndex - offset))
  }
  return ranges
}
