import { ShipmentInput, NodeCost, EngineContext, MawbGroup } from '@/types'
import { isDateInRange, round2, safeDiv } from '@/lib/utils'

// ─── 5.4 ORIGIN CLEARANCE COST CALCULATION ───────────────────────────────────
// Logic per PRD §5.4:
//   - Group shipments by MAWB
//   - MAWB-level charges: Per MAWB (fixed) + Per Shipment + Per Box + Per KG
//   - Threshold logic: if mawb_weight > threshold → use threshold_per_kg_cost for KG charges
//   - total_oc_cost = SUM of all charge heads
//   - per_kg = total_oc_cost / mawb_weight
//   - oc_cost = per_kg × gross_weight
//   - Fallback → avg_cost_per_kg if MAWB missing

export function computeOcCosts(
  shipments: ShipmentInput[],
  ctx: EngineContext
): Map<string, NodeCost> {
  const result = new Map<string, NodeCost>()

  // 1. Group by MAWB
  const mawbGroups = new Map<string, MawbGroup>()
  const noMawb: ShipmentInput[] = []

  for (const s of shipments) {
    if (!s.mawb) { noMawb.push(s); continue }

    if (!mawbGroups.has(s.mawb)) {
      mawbGroups.set(s.mawb, {
        mawb: s.mawb,
        mawb_date: s.mawb_date ? new Date(s.mawb_date) : undefined,
        port_of_origin: s.port_of_origin ?? undefined,
        oc_vendor: s.oc_vendor ?? undefined,
        clearance_type_oc: s.clearance_type_oc ?? undefined,
        shipments: [],
        total_weight: 0,
        total_hawbs: 0,
        total_boxes: 0,
      })
    }
    const g = mawbGroups.get(s.mawb)!
    g.shipments.push(s)
    g.total_weight += s.gross_weight
    g.total_hawbs += 1
    g.total_boxes += s.n_packages
  }

  // 2. Compute per MAWB
  for (const [, g] of mawbGroups) {
    const refDate = g.mawb_date ?? new Date(g.shipments[0].pickup_date)

    // Fetch applicable charge rows for this vendor+port+clearance_type
    const chargeRows = ctx.ocMasters.filter(
      m =>
        m.vendor_name === g.oc_vendor &&
        m.port_of_origin === g.port_of_origin &&
        m.clearance_type === g.clearance_type_oc &&
        isDateInRange(refDate, m.start_date, m.end_date)
    )

    if (chargeRows.length === 0) {
      // Fallback to avg
      for (const s of g.shipments) applyOcAvg(s, refDate, g, ctx, result)
      continue
    }

    // Sum all charge heads
    let totalOcCost = 0

    for (const row of chargeRows) {
      switch (row.charge_type) {
        case 'Per MAWB':
          totalOcCost += row.cost
          break
        case 'Per Shipment':
          totalOcCost += row.cost * g.total_hawbs
          break
        case 'Per Box':
          totalOcCost += row.cost * g.total_boxes
          break
        case 'Per KG': {
          // Threshold check
          const effectiveRate =
            row.threshold_mawb_weight > 0 && g.total_weight > row.threshold_mawb_weight
              ? row.threshold_per_kg_cost
              : row.cost
          totalOcCost += effectiveRate * g.total_weight
          break
        }
      }
    }

    const perKg = safeDiv(totalOcCost, g.total_weight)

    for (const s of g.shipments) {
      const override = ctx.overrides.get(s.awb)?.get('oc')
      if (override?.override_flag && override.override_cost != null) {
        result.set(s.awb, { cost: round2(override.override_cost), source: 'override' })
      } else {
        result.set(s.awb, {
          cost: round2(perKg * s.gross_weight),
          source: 'calculated',
          detail: `MAWB=${g.mawb} | total_oc=₹${round2(totalOcCost)} | per_kg=₹${round2(perKg)}`,
        })
      }
    }
  }

  // 3. No-MAWB shipments → avg fallback
  for (const s of noMawb) {
    const refDate = new Date(s.pickup_date)
    applyOcAvg(
      s, refDate,
      { total_weight: s.gross_weight, total_hawbs: 1, total_boxes: s.n_packages } as MawbGroup,
      ctx, result
    )
  }

  // Guard
  for (const s of shipments) {
    if (!result.has(s.awb)) result.set(s.awb, { cost: 0, source: 'missing' })
  }

  return result
}

function applyOcAvg(
  s: ShipmentInput,
  refDate: Date,
  g: Partial<MawbGroup>,
  ctx: EngineContext,
  result: Map<string, NodeCost>
) {
  const override = ctx.overrides.get(s.awb)?.get('oc')
  if (override?.override_flag && override.override_cost != null) {
    result.set(s.awb, { cost: round2(override.override_cost), source: 'override' })
    return
  }
  const avg = ctx.ocAvg.find(
    a =>
      a.vendor_name === s.oc_vendor &&
      a.clearance_type === s.clearance_type_oc &&
      isDateInRange(refDate, a.start_date, a.end_date)
  )
  if (avg) {
    result.set(s.awb, {
      cost: round2(avg.avg_cost_per_kg * s.gross_weight),
      source: 'avg',
    })
  } else {
    result.set(s.awb, { cost: 0, source: 'missing', detail: 'no OC master or avg' })
  }
}
