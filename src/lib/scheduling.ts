import type { BusinessSettings } from './types'

export interface OccupiedSlot {
  start: string
  end: string
  bay: number | null
}

export interface AvailableSlot {
  start: Date
  end: Date
  bay: number
}

const DAY_KEYS: (keyof BusinessSettings)[] = [
  'hours_sunday',
  'hours_monday',
  'hours_tuesday',
  'hours_wednesday',
  'hours_thursday',
  'hours_friday',
  'hours_saturday',
]

function parseHours(hoursStr: string): { open: number; close: number } | null {
  const trimmed = hoursStr.trim().toLowerCase()
  if (!trimmed || trimmed === 'closed' || trimmed === 'close') return null
  const match = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!match) return null
  const [, sh, sm, sap, eh, em, eap] = match
  const to24 = (h: string, m: string, ap: string | undefined): number => {
    let hour = parseInt(h, 10)
    const min = m ? parseInt(m, 10) : 0
    if (ap) {
      const ampm = ap.toLowerCase()
      if (ampm === 'pm' && hour !== 12) hour += 12
      if (ampm === 'am' && hour === 12) hour = 0
    }
    return hour * 60 + min
  }
  return { open: to24(sh, sm, sap), close: to24(eh, em, eap) }
}

export function getBusinessHours(date: Date, settings: BusinessSettings): { open: number; close: number } | null {
  const dayKey = DAY_KEYS[date.getDay()]
  return parseHours(settings[dayKey] as string)
}

export function computeAvailableSlots(
  date: Date,
  durationHours: number,
  settings: BusinessSettings,
  occupied: OccupiedSlot[],
): AvailableSlot[] {
  const hours = getBusinessHours(date, settings)
  if (!hours) return []

  const durationMin = Math.round(durationHours * 60)
  const buffer = settings.buffer_minutes || 0
  const slotInterval = 30
  const slots: AvailableSlot[] = []

  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const openMin = hours.open
  const closeMin = hours.close

  for (let t = openMin; t + durationMin <= closeMin; t += slotInterval) {
    const slotStart = new Date(dayStart)
    slotStart.setMinutes(t)
    const slotEnd = new Date(dayStart)
    slotEnd.setMinutes(t + durationMin)

    for (let bay = 1; bay <= settings.bays; bay++) {
      const conflicts = occupied.some((o) => {
        if (o.bay !== null && o.bay !== bay) return false
        const oStart = new Date(o.start)
        const oEnd = new Date(o.end)
        const bufferedEnd = new Date(oEnd.getTime() + buffer * 60000)
        const bufferedStart = new Date(oStart.getTime() - buffer * 60000)
        return slotStart < bufferedEnd && slotEnd > bufferedStart
      })
      if (!conflicts) {
        slots.push({ start: slotStart, end: slotEnd, bay })
      }
    }
  }

  const seen = new Set<string>()
  return slots.filter((s) => {
    const key = s.start.toISOString() + '-' + s.bay
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getDurationForAppt(appt: any, pricingRules: { service: string; duration: number }[]): number {
  const services = appt.services || []
  let total = 0
  for (const svc of services) {
    const rule = pricingRules.find((r) => r.service === svc.slug)
    if (rule) total = Math.max(total, rule.duration)
  }
  return total || 2
}
