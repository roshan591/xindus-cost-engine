import { WeekKey } from '@/types'

// ─── WEEK HELPERS ─────────────────────────────────────────────────────────────

export function getWeekKey(date: Date | string): WeekKey {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000) + 1
  const week = Math.ceil(dayOfYear / 7)
  return {
    year: d.getFullYear(),
    week,
    label: `${d.getFullYear()}-W${String(week).padStart(2, '0')}`,
  }
}

export function getWeekLabel(date: Date | string): string {
  return getWeekKey(date).label
}

export function getMonthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Number of weeks in a month (average = 4.33)
export function weeksInMonth(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return daysInMonth / 7
}

// Get all calendar dates within a ISO-week label
export function datesInWeek(weekLabel: string): Date[] {
  const parts = weekLabel.split('-W')
  if (parts.length !== 2) return []
  const year = parseInt(parts[0])
  const week = parseInt(parts[1])
  if (isNaN(year) || isNaN(week)) return []
  const startOfYear = new Date(year, 0, 1)
  const dayOffset = (week - 1) * 7
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfYear)
    d.setDate(startOfYear.getDate() + dayOffset + i)
    if (d.getFullYear() === year) dates.push(d)
  }
  return dates
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

export function dateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// ─── WORKING DAYS IN A WEEK ───────────────────────────────────────────────────
// Active days = dates with shipment activity, excluding Sundays & holidays
export function workingDaysInWeek(
  weekLabel: string,
  activeDates: Set<string>,      // dates that have shipments (YYYY-MM-DD)
  holidays: { date: Date; hub_name: string }[],
  hubName: string
): number {
  const dates = datesInWeek(weekLabel)
  const holidaySet = new Set(
    holidays
      .filter(h => h.hub_name === hubName || h.hub_name === 'ALL')
      .map(h => dateStr(h.date))
  )
  let count = 0
  for (const d of dates) {
    if (isSunday(d)) continue
    const ds = dateStr(d)
    if (holidaySet.has(ds)) continue
    if (activeDates.has(ds)) count++
  }
  return Math.max(count, 1) // at least 1 to avoid division by zero
}

// ─── DATE RANGE CHECK ─────────────────────────────────────────────────────────

export function isDateInRange(date: Date | string, start: Date, end: Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d >= start && d <= end
}

// ─── PARTNER EXTRACTION ───────────────────────────────────────────────────────
// injection_port = "JFK-Shipbae-WC" → partner = "WC"
export function extractPartner(injectionPort?: string | null): string | undefined {
  if (!injectionPort) return undefined
  const parts = injectionPort.split('-')
  return parts.length >= 3 ? parts[parts.length - 1] : undefined
}

// ─── WEIGHT HELPERS ───────────────────────────────────────────────────────────

export function volumetricWeight(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  divisor: number
): number {
  return (lengthCm * widthCm * heightCm) / divisor
}

export function chargeableWeight(grossKg: number, volKg: number): number {
  return Math.max(grossKg, volKg)
}

export function kgToLbs(kg: number): number {
  return kg * 2.20462
}

export function kgToOz(kg: number): number {
  return kg * 35.274
}

// ─── FORMAT HELPERS ───────────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : num / den
}
