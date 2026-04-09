import { ShipmentInput, NodeCost, PickupMaster, EngineContext } from '@/types'
import {
  getWeekLabel, getMonthKey, weeksInMonth,
  isDateInRange, workingDaysInWeek, dateStr, round2, safeDiv
} from '@/lib/utils'

interface WeekGroup {
  weekLabel: string
  monthKey: string
  pickupNode: string
  deliveryNode: string
  shipments: ShipmentInput[]
  totalWeight: number
  activeDates: Set<string>
}

// ─── 5.1 PICKUP COST CALCULATION ─────────────────────────────────────────────
// Logic per PRD §5.1:
//   - Group by pickup_node + delivery_node + week(pickup_date)
//   - weekly_fixed_cost = monthly_fixed_charge / weeks_in_month
//   - Using working days (not 4.33 fixed): weekly_fixed_cost / working_days → daily_cost
//   - If weekly_total_load > threshold_weight → per_kg = cost_per_kg_above_threshold
//   - Else → per_kg = weekly_fixed_cost / weekly_total_load
//   - pickup_cost = per_kg × gross_weight
//   - Fallback → avg_cost_per_kg × gross_weight

export function computePickupCosts(
  shipments: ShipmentInput[],
  ctx: EngineContext
): Map<string, NodeCost> {
  const result = new Map<string, NodeCost>()

  // 1. Group by pickup_node + delivery_node + week
  const groups = new Map<string, WeekGroup>()

  for (const s of shipments) {
    const weekLabel = getWeekLabel(s.pickup_date)
    const monthKey = getMonthKey(s.pickup_date)
    const key = `${s.service_node}|${s.hub_name}|${weekLabel}`

    if (!groups.has(key)) {
      groups.set(key, {
        weekLabel,
        monthKey,
        pickupNode: s.service_node,
        deliveryNode: s.hub_name,
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

  // 2. For each group, compute per-kg cost
  for (const [, g] of groups) {
    const refDate = new Date(g.shipments[0].pickup_date)

    // Find applicable master rate
    const master = findPickupMaster(
      g.pickupNode, g.deliveryNode, refDate, ctx.pickupMasters
    )

    let perKgCost: number
    let source: NodeCost['source'] = 'calculated'

    if (master) {
      const wksInMonth = weeksInMonth(refDate)
      const weeklyFixed = master.monthly_fixed_charge / wksInMonth

      // Working-days allocation (§5.3.6 applies to pickup too)
      const wDays = workingDaysInWeek(
        g.weekLabel, g.activeDates, ctx.holidays, g.pickupNode
      )
      const _dailyCost = weeklyFixed / wDays // for reference if needed

      if (master.threshold_weight > 0 && g.totalWeight > master.threshold_weight) {
        // Threshold exceeded → use per-kg rate
        perKgCost = master.cost_per_kg_above_threshold
      } else {
        // Below threshold → distribute fixed cost proportionally
        perKgCost = safeDiv(weeklyFixed, g.totalWeight)
      }
    } else {
      // Fallback: average master
      const avg = ctx.pickupAvg.find(
        a => a.service_node === g.pickupNode && isDateInRange(refDate, a.start_date, a.end_date)
      )
      if (avg) {
        perKgCost = avg.avg_cost_per_kg
        source = 'avg'
      } else {
        perKgCost = 0
        source = 'missing'
      }
    }

    // 3. Allocate to each shipment
    for (const s of g.shipments) {
      const override = ctx.overrides.get(s.awb)?.get('pickup')
      if (override?.override_flag && override.override_cost != null) {
        result.set(s.awb, { cost: round2(override.override_cost), source: 'override' })
      } else {
        result.set(s.awb, {
          cost: round2(perKgCost * s.gross_weight),
          source,
          detail: master
            ? `${g.pickupNode}→${g.deliveryNode} | week=${g.weekLabel} | per_kg=₹${round2(perKgCost)}`
            : `fallback avg`,
        })
      }
    }
  }

  // Handle any shipment not in a group (shouldn't happen, but guard)
  for (const s of shipments) {
    if (!result.has(s.awb)) {
      result.set(s.awb, { cost: 0, source: 'missing', detail: 'no pickup node match' })
    }
  }

  return result
}

function findPickupMaster(
  pickupNode: string,
  deliveryNode: string,
  date: Date,
  masters: PickupMaster[]
): PickupMaster | undefined {
  return masters.find(
    m =>
      m.pickup_node === pickupNode &&
      m.delivery_node === deliveryNode &&
      isDateInRange(date, m.start_date, m.end_date)
  )
}
