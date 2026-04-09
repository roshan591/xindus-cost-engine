import { ShipmentInput, NodeCost, EngineContext } from '@/types'
import { isDateInRange, round2, safeDiv, extractPartner } from '@/lib/utils'

// ─── 5.5 MIDDLE MILE ─────────────────────────────────────────────────────────
// MAWB-level: variable = rate × weight, fixed = per_mawb, total = variable + fixed
// per_kg = total / mawb_weight → allocated by gross_weight

export function computeMmCosts(
  shipments: ShipmentInput[],
  ctx: EngineContext
): Map<string, NodeCost> {
  const result = new Map<string, NodeCost>()

  type MawbMmGroup = { shipments: ShipmentInput[]; totalWeight: number; refDate: Date; originPort: string }
  const groups = new Map<string, MawbMmGroup>()

  for (const s of shipments) {
    const key = s.mawb ?? `NO_MAWB_${s.awb}`
    if (!groups.has(key)) {
      groups.set(key, {
        shipments: [],
        totalWeight: 0,
        refDate: s.mawb_date ? new Date(s.mawb_date) : new Date(s.pickup_date),
        originPort: s.port_of_origin ?? s.hub_name,
      })
    }
    const g = groups.get(key)!
    g.shipments.push(s)
    g.totalWeight += s.gross_weight
  }

  for (const [mawb, g] of groups) {
    const destPort = g.shipments[0].point_of_entry ?? ''
    const master = ctx.mmMasters.find(
      m =>
        m.origin_port === g.originPort &&
        (m.dest_port === destPort || !destPort) &&
        isDateInRange(g.refDate, m.start_date, m.end_date)
    )

    if (master && mawb !== `NO_MAWB_${g.shipments[0].awb}`) {
      const manifestCost = master.rate_per_kg * g.totalWeight + master.fixed_cost_per_mawb
      const perKg = safeDiv(manifestCost, g.totalWeight)
      for (const s of g.shipments) {
        const ov = ctx.overrides.get(s.awb)?.get('mm')
        if (ov?.override_flag && ov.override_cost != null) {
          result.set(s.awb, { cost: round2(ov.override_cost), source: 'override' })
        } else {
          result.set(s.awb, {
            cost: round2(perKg * s.gross_weight),
            source: 'calculated',
            detail: `MAWB=${mawb} | airline=${master.airline} | per_kg=${round2(perKg)}`,
          })
        }
      }
    } else {
      // Avg fallback
      for (const s of g.shipments) {
        const ov = ctx.overrides.get(s.awb)?.get('mm')
        if (ov?.override_flag && ov.override_cost != null) {
          result.set(s.awb, { cost: round2(ov.override_cost), source: 'override' })
          continue
        }
        const avg = ctx.mmAvg.find(
          a => a.origin_port === g.originPort && isDateInRange(g.refDate, a.start_date, a.end_date)
        )
        result.set(s.awb, avg
          ? { cost: round2(avg.avg_cost_per_kg * s.gross_weight), source: 'avg' }
          : { cost: 0, source: 'missing' }
        )
      }
    }
  }

  for (const s of shipments) {
    if (!result.has(s.awb)) result.set(s.awb, { cost: 0, source: 'missing' })
  }
  return result
}

// ─── 5.6 DESTINATION HANDLING ─────────────────────────────────────────────────
// Group by MAWB + dc_partner. Multi-charge: Per MAWB, Per KG, Per HAWB, Per Carton, Per Pallet
// Pallet = CEILING(mawb_weight / pallet_weight) × cost

export function computeDhCosts(
  shipments: ShipmentInput[],
  ctx: EngineContext
): Map<string, NodeCost> {
  const result = new Map<string, NodeCost>()

  type DhGroup = { shipments: ShipmentInput[]; totalWeight: number; totalHawbs: number; totalBoxes: number; refDate: Date; partner: string; clearanceType: string; pointOfEntry: string }
  const groups = new Map<string, DhGroup>()

  for (const s of shipments) {
    const partner = s.dc_partner ?? extractPartner(s.injection_port) ?? ''
    const key = `${s.mawb ?? 'NOMAWB'}|${partner}`
    if (!groups.has(key)) {
      groups.set(key, {
        shipments: [],
        totalWeight: 0,
        totalHawbs: 0,
        totalBoxes: 0,
        refDate: s.mawb_date ? new Date(s.mawb_date) : new Date(s.pickup_date),
        partner,
        clearanceType: s.dest_clearance_type ?? '',
        pointOfEntry: s.point_of_entry ?? '',
      })
    }
    const g = groups.get(key)!
    g.shipments.push(s)
    g.totalWeight += s.gross_weight
    g.totalHawbs += 1
    g.totalBoxes += s.n_packages
  }

  for (const [, g] of groups) {
    const charges = ctx.dhMasters.filter(
      m =>
        m.dc_partner === g.partner &&
        m.clearance_type === g.clearanceType &&
        isDateInRange(g.refDate, m.start_date, m.end_date)
    )

    if (charges.length === 0) {
      // Avg fallback
      for (const s of g.shipments) {
        const ov = ctx.overrides.get(s.awb)?.get('dh')
        if (ov?.override_flag && ov.override_cost != null) {
          result.set(s.awb, { cost: round2(ov.override_cost), source: 'override' })
          continue
        }
        const avg = ctx.dhAvg.find(
          a => a.clearance_type === g.clearanceType && a.point_of_entry === g.pointOfEntry
        )
        result.set(s.awb, avg
          ? { cost: round2(avg.avg_cost_per_kg * s.gross_weight), source: 'avg' }
          : { cost: 0, source: 'missing' }
        )
      }
      continue
    }

    // Sum all charge heads at MAWB+partner level
    let totalDhCost = 0
    for (const row of charges) {
      switch (row.charge_type) {
        case 'Per MAWB':
          totalDhCost += row.cost
          break
        case 'Per KG':
          totalDhCost += row.cost * g.totalWeight
          break
        case 'Per Shipment':
          totalDhCost += row.cost * g.totalHawbs
          break
        case 'Per Carton':
          totalDhCost += row.cost * g.totalBoxes
          break
        case 'Per Pallet': {
          const palletWeight = row.pallet_weight ?? 300
          const pallets = Math.ceil(g.totalWeight / palletWeight)
          totalDhCost += pallets * row.cost
          break
        }
      }
    }

    const perKg = safeDiv(totalDhCost, g.totalWeight)
    for (const s of g.shipments) {
      const ov = ctx.overrides.get(s.awb)?.get('dh')
      if (ov?.override_flag && ov.override_cost != null) {
        result.set(s.awb, { cost: round2(ov.override_cost), source: 'override' })
      } else {
        result.set(s.awb, {
          cost: round2(perKg * s.gross_weight),
          source: 'calculated',
          detail: `partner=${g.partner} | total_dh=${round2(totalDhCost)} | per_kg=${round2(perKg)}`,
        })
      }
    }
  }

  for (const s of shipments) {
    if (!result.has(s.awb)) result.set(s.awb, { cost: 0, source: 'missing' })
  }
  return result
}

// ─── 5.7 DESTINATION CLEARANCE ────────────────────────────────────────────────
// Commercial → HAWB-level calculation
// Courier (T86) → MAWB-level then allocate per kg
// Charge types: Per KG | Per Shipment | Per Line Item | Fixed Per MAWB | Max Per MAWB

export function computeDcClearanceCosts(
  shipments: ShipmentInput[],
  ctx: EngineContext
): Map<string, NodeCost> {
  const result = new Map<string, NodeCost>()

  const commercial = shipments.filter(s => (s.service_type ?? 'Courier') === 'Commercial')
  const courier = shipments.filter(s => (s.service_type ?? 'Courier') !== 'Commercial')

  // Commercial: per shipment
  for (const s of commercial) {
    const refDate = new Date(s.pickup_date)
    const ov = ctx.overrides.get(s.awb)?.get('dc_clearance')
    if (ov?.override_flag && ov.override_cost != null) {
      result.set(s.awb, { cost: round2(ov.override_cost), source: 'override' })
      continue
    }

    const charges = ctx.dcClearanceMasters.filter(
      m =>
        m.country === s.country &&
        m.clearance_type === s.dest_clearance_type &&
        isDateInRange(refDate, m.start_date, m.end_date)
    )

    if (charges.length === 0) {
      result.set(s.awb, applyDcAvg(s, refDate, ctx))
      continue
    }

    let shipmentCost = 0
    let maxCap: number | null = null

    for (const row of charges) {
      if (row.charge_type === 'Max Per MAWB') { maxCap = row.cost; continue }
      switch (row.charge_type) {
        case 'Per KG': shipmentCost += row.cost * s.gross_weight; break
        case 'Per Shipment': shipmentCost += row.cost; break
        case 'Per Line Item': shipmentCost += row.cost * s.line_items; break
        case 'Fixed Per MAWB': shipmentCost += row.cost; break
      }
    }
    if (maxCap !== null) shipmentCost = Math.min(shipmentCost, maxCap)

    result.set(s.awb, {
      cost: round2(shipmentCost),
      source: 'calculated',
      detail: `Commercial HAWB-level | country=${s.country}`,
    })
  }

  // Courier: MAWB-level
  type MawbDcGroup = { shipments: ShipmentInput[]; totalWeight: number; totalHawbs: number; totalLineItems: number; refDate: Date }
  const groups = new Map<string, MawbDcGroup>()

  for (const s of courier) {
    const key = s.mawb ?? `NOMAWB_${s.awb}`
    if (!groups.has(key)) {
      groups.set(key, { shipments: [], totalWeight: 0, totalHawbs: 0, totalLineItems: 0, refDate: s.mawb_date ? new Date(s.mawb_date) : new Date(s.pickup_date) })
    }
    const g = groups.get(key)!
    g.shipments.push(s)
    g.totalWeight += s.gross_weight
    g.totalHawbs += 1
    g.totalLineItems += s.line_items
  }

  for (const [, g] of groups) {
    const s0 = g.shipments[0]
    const charges = ctx.dcClearanceMasters.filter(
      m =>
        m.country === s0.country &&
        m.clearance_type === s0.dest_clearance_type &&
        isDateInRange(g.refDate, m.start_date, m.end_date)
    )

    if (charges.length === 0) {
      for (const s of g.shipments) {
        result.set(s.awb, applyDcAvg(s, g.refDate, ctx))
      }
      continue
    }

    let totalMawbCost = 0
    let maxCap: number | null = null

    for (const row of charges) {
      if (row.charge_type === 'Max Per MAWB') { maxCap = row.cost; continue }
      switch (row.charge_type) {
        case 'Per KG': totalMawbCost += row.cost * g.totalWeight; break
        case 'Per Shipment': totalMawbCost += row.cost * g.totalHawbs; break
        case 'Per Line Item': totalMawbCost += row.cost * g.totalLineItems; break
        case 'Fixed Per MAWB': totalMawbCost += row.cost; break
      }
    }
    if (maxCap !== null) totalMawbCost = Math.min(totalMawbCost, maxCap)

    const perKg = safeDiv(totalMawbCost, g.totalWeight)
    for (const s of g.shipments) {
      const ov = ctx.overrides.get(s.awb)?.get('dc_clearance')
      if (ov?.override_flag && ov.override_cost != null) {
        result.set(s.awb, { cost: round2(ov.override_cost), source: 'override' })
      } else {
        result.set(s.awb, {
          cost: round2(perKg * s.gross_weight),
          source: 'calculated',
          detail: `Courier MAWB-level | per_kg=${round2(perKg)}`,
        })
      }
    }
  }

  for (const s of shipments) {
    if (!result.has(s.awb)) result.set(s.awb, { cost: 0, source: 'missing' })
  }
  return result
}

function applyDcAvg(s: ShipmentInput, refDate: Date, ctx: EngineContext): NodeCost {
  const avg = ctx.dcClearanceAvg.find(
    a =>
      a.country === s.country &&
      a.clearance_type === s.dest_clearance_type &&
      isDateInRange(refDate, a.start_date, a.end_date)
  )
  return avg
    ? { cost: round2(avg.avg_cost_per_kg * s.gross_weight), source: 'avg' }
    : { cost: 0, source: 'missing' }
}

// ─── 5.8 DROP-OFF COST ────────────────────────────────────────────────────────
// Group by MAWB + partner
// fixed_cost is fully allocated to that partner (not shared)
// variable = cost_per_kg × partner_total_weight
// per_kg = (fixed + variable) / partner_total_weight → allocated by gross_weight

export function computeDropoffCosts(
  shipments: ShipmentInput[],
  ctx: EngineContext
): Map<string, NodeCost> {
  const result = new Map<string, NodeCost>()

  type DropGroup = { shipments: ShipmentInput[]; totalWeight: number; refDate: Date; partner: string; country: string }
  const groups = new Map<string, DropGroup>()

  for (const s of shipments) {
    const partner = s.lm_carrier ?? ''
    const key = `${s.mawb ?? 'NOMAWB'}|${partner}`
    if (!groups.has(key)) {
      groups.set(key, {
        shipments: [],
        totalWeight: 0,
        refDate: s.mawb_date ? new Date(s.mawb_date) : new Date(s.pickup_date),
        partner,
        country: s.country ?? '',
      })
    }
    const g = groups.get(key)!
    g.shipments.push(s)
    g.totalWeight += s.gross_weight
  }

  for (const [, g] of groups) {
    const master = ctx.dropoffMasters.find(
      m =>
        m.country === g.country &&
        m.partner === g.partner &&
        isDateInRange(g.refDate, m.start_date, m.end_date)
    )

    if (master) {
      const totalCost = master.fixed_cost_per_mawb + master.cost_per_kg * g.totalWeight
      const perKg = safeDiv(totalCost, g.totalWeight)

      for (const s of g.shipments) {
        const ov = ctx.overrides.get(s.awb)?.get('dropoff')
        if (ov?.override_flag && ov.override_cost != null) {
          result.set(s.awb, { cost: round2(ov.override_cost), source: 'override' })
        } else {
          result.set(s.awb, {
            cost: round2(perKg * s.gross_weight),
            source: 'calculated',
            detail: `partner=${g.partner} | per_kg=${round2(perKg)}`,
          })
        }
      }
    } else {
      for (const s of g.shipments) {
        const ov = ctx.overrides.get(s.awb)?.get('dropoff')
        if (ov?.override_flag && ov.override_cost != null) {
          result.set(s.awb, { cost: round2(ov.override_cost), source: 'override' })
          continue
        }
        const avg = ctx.dropoffAvg.find(
          a => a.country === g.country && a.partner === g.partner
        )
        result.set(s.awb, avg
          ? { cost: round2(avg.avg_cost_per_kg * s.gross_weight), source: 'avg' }
          : { cost: 0, source: 'missing' }
        )
      }
    }
  }

  for (const s of shipments) {
    if (!result.has(s.awb)) result.set(s.awb, { cost: 0, source: 'missing' })
  }
  return result
}
