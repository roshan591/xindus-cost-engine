import { ShipmentInput, NodeCost, EngineContext } from '@/types'
import {
  getWeekLabel, getMonthKey, weeksInMonth,
  isDateInRange, workingDaysInWeek, dateStr, round2, safeDiv
} from '@/lib/utils'

// ─── 5.3 HUB HANDLING COST CALCULATION ───────────────────────────────────────
// Logic per PRD §5.3:
//   - Group by hub_name + week
//   - weekly_fixed_cost = monthly_fixed_cost / weeks_in_month
//   - working_days = active days excluding Sundays + holidays + zero-activity days
//   - daily_cost = weekly_fixed_cost / working_days
//   - If weekly_total_weight > threshold → per_kg = threshold_per_kg_cost
//   - Else → per_kg = weekly_fixed_cost / weekly_total_weight
//   - hub_cost = per_kg × gross_weight

export function computeHubCosts(
  shipments: ShipmentInput[],
  ctx: EngineContext
): Map<string, NodeCost> {
  const result = new Map<string, NodeCost>()

  // 1. Group by hub + week
  type HubWeekGroup = {
    weekLabel: string
    monthKey: string
    hubName: string
    shipments: ShipmentInput[]
    totalWeight: number
    activeDates: Set<string>
  }

  const groups = new Map<string, HubWeekGroup>()

  for (const s of shipments) {
    const weekLabel = getWeekLabel(s.pickup_date)
    const monthKey = getMonthKey(s.pickup_date)
    const key = `${s.hub_name}|${weekLabel}`

    if (!groups.has(key)) {
      groups.set(key, {
        weekLabel,
        monthKey,
        hubName: s.hub_name,
        shipments: [],
        totalWeight: 0,
        activeDates: new Set(),
      })
    }
    const g = groups.get(key)!
    g.shipments.push(s)
    g.totalWeight += s.gross_weight
    g.activeDates.add(dateStr(new Date(s.pickup_date)))
  }

  // 2. Compute per-kg for each group
  for (const [, g] of groups) {
    const refDate = new Date(g.shipments[0].pickup_date)

    const master = ctx.hubMasters.find(
      m => m.hub_name === g.hubName && isDateInRange(refDate, m.start_date, m.end_date)
    )

    if (!master) {
      for (const s of g.shipments) {
        result.set(s.awb, { cost: 0, source: 'missing', detail: `no hub master for ${g.hubName}` })
      }
      continue
    }

    const wksInMonth = weeksInMonth(refDate)
    const weeklyFixed = master.monthly_fixed_cost / wksInMonth

    // Working days (active days this week, excl. Sundays & holidays)
    const wDays = workingDaysInWeek(g.weekLabel, g.activeDates, ctx.holidays, g.hubName)

    // Monthly threshold → weekly equivalent
    const weeklyThreshold = master.monthly_threshold_weight / wksInMonth

    let perKgCost: number

    if (master.monthly_threshold_weight > 0 && g.totalWeight > weeklyThreshold) {
      // Threshold exceeded
      perKgCost = master.threshold_per_kg_cost
    } else {
      // Time-based allocation
      perKgCost = safeDiv(weeklyFixed, g.totalWeight)
    }

    for (const s of g.shipments) {
      const override = ctx.overrides.get(s.awb)?.get('hub')
      if (override?.override_flag && override.override_cost != null) {
        result.set(s.awb, { cost: round2(override.override_cost), source: 'override' })
      } else {
        result.set(s.awb, {
          cost: round2(perKgCost * s.gross_weight),
          source: 'calculated',
          detail: `hub=${g.hubName} | wk=${g.weekLabel} | wDays=${wDays} | per_kg=₹${round2(perKgCost)}`,
        })
      }
    }
  }

  // Guard
  for (const s of shipments) {
    if (!result.has(s.awb)) {
      result.set(s.awb, { cost: 0, source: 'missing' })
    }
  }

  return result
}
