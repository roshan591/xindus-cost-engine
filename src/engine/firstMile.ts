import { ShipmentInput, NodeCost, EngineContext, ManifestGroup } from '@/types'
import { isDateInRange, round2, safeDiv } from '@/lib/utils'

// ─── 5.2 FIRST MILE COST CALCULATION ─────────────────────────────────────────
// Logic per PRD §5.2:
//   - Group by Pc_to_hub (manifest) + service_node + flight_no + pc_to_hub_created_on
//   - variable_cost = cost_per_kg × manifest_total_weight
//   - fixed_cost = fixed_cost from master
//   - final_manifest_cost = MAX(variable_cost, fixed_cost)
//   - per_kg_cost = final_manifest_cost / manifest_total_weight
//   - fm_cost = per_kg_cost × gross_weight
//   - If Pc_to_hub NULL or cost=0 → fallback avg master

export function computeFmCosts(
  shipments: ShipmentInput[],
  ctx: EngineContext
): Map<string, NodeCost> {
  const result = new Map<string, NodeCost>()

  // 1. Separate manifest-linked vs no-manifest
  const withManifest: ShipmentInput[] = []
  const noManifest: ShipmentInput[] = []

  for (const s of shipments) {
    if (s.pc_to_hub) withManifest.push(s)
    else noManifest.push(s)
  }

  // 2. Group by manifest key
  const manifests = new Map<string, ManifestGroup>()

  for (const s of withManifest) {
    const key = `${s.pc_to_hub}|${s.service_node}|${s.pc_to_hub_flight_no ?? ''}`
    if (!manifests.has(key)) {
      manifests.set(key, {
        manifest_id: s.pc_to_hub!,
        flight_no: s.pc_to_hub_flight_no ?? undefined,
        created_on: s.pc_to_hub_created_on ? new Date(s.pc_to_hub_created_on) : undefined,
        origin_node: s.service_node,
        shipments: [],
        total_weight: 0,
      })
    }
    const g = manifests.get(key)!
    g.shipments.push(s)
    g.total_weight += s.gross_weight
  }

  // 3. Compute cost per manifest
  for (const [, g] of manifests) {
    const refDate = g.created_on ?? new Date(g.shipments[0].pickup_date)
    const destNode = g.shipments[0].hub_name

    // Lookup by flight_no first (specific manifest), then by origin+dest
    const master =
      findFmMasterByFlight(g.flight_no, refDate, ctx.fmMasters) ??
      findFmMasterByRoute(g.origin_node, destNode, refDate, ctx.fmMasters)

    if (master) {
      const variableCost = master.cost_per_kg * g.total_weight
      const fixedCost = master.fixed_cost
      const manifestCost = Math.max(variableCost, fixedCost)
      const perKg = safeDiv(manifestCost, g.total_weight)

      for (const s of g.shipments) {
        const override = ctx.overrides.get(s.awb)?.get('fm')
        if (override?.override_flag && override.override_cost != null) {
          result.set(s.awb, { cost: round2(override.override_cost), source: 'override' })
        } else {
          result.set(s.awb, {
            cost: round2(perKg * s.gross_weight),
            source: 'calculated',
            detail: `manifest=${g.manifest_id} | mode=${master.mode_of_transport} | per_kg=₹${round2(perKg)}`,
          })
        }
      }
    } else {
      // No manifest master → fallback avg
      for (const s of g.shipments) {
        applyFmAvgFallback(s, refDate, ctx, result)
      }
    }
  }

  // 4. No-manifest shipments → fallback avg
  for (const s of noManifest) {
    const refDate = new Date(s.pickup_date)
    applyFmAvgFallback(s, refDate, ctx, result)
  }

  // Guard
  for (const s of shipments) {
    if (!result.has(s.awb)) {
      result.set(s.awb, { cost: 0, source: 'missing' })
    }
  }

  return result
}

function applyFmAvgFallback(
  s: ShipmentInput,
  refDate: Date,
  ctx: EngineContext,
  result: Map<string, NodeCost>
) {
  const override = ctx.overrides.get(s.awb)?.get('fm')
  if (override?.override_flag && override.override_cost != null) {
    result.set(s.awb, { cost: round2(override.override_cost), source: 'override' })
    return
  }
  const avg = ctx.fmAvg.find(
    a => a.service_node === s.service_node && isDateInRange(refDate, a.start_date, a.end_date)
  )
  if (avg) {
    result.set(s.awb, {
      cost: round2(avg.avg_cost_per_kg * s.gross_weight),
      source: 'avg',
      detail: `avg master | node=${s.service_node}`,
    })
  } else {
    result.set(s.awb, { cost: 0, source: 'missing', detail: 'no FM master or avg' })
  }
}

function findFmMasterByFlight(
  flightNo: string | undefined,
  date: Date,
  masters: EngineContext['fmMasters']
) {
  if (!flightNo) return undefined
  return masters.find(
    m => m.flight_no === flightNo && isDateInRange(date, m.start_date, m.end_date)
  )
}

function findFmMasterByRoute(
  originNode: string,
  deliveryNode: string,
  date: Date,
  masters: EngineContext['fmMasters']
) {
  return masters.find(
    m =>
      m.origin_node === originNode &&
      m.delivery_node === deliveryNode &&
      isDateInRange(date, m.start_date, m.end_date)
  )
}
