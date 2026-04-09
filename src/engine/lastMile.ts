import { ShipmentInput, NodeCost, EngineContext } from '@/types'
import { isDateInRange, volumetricWeight, chargeableWeight, kgToLbs, kgToOz, round2 } from '@/lib/utils'

// ─── 5.9 LAST MILE COST CALCULATION (USA) ────────────────────────────────────
// Masters: Carrier Config → Zone Mapping → Rate Card → DAS → Surcharges → Avg Fallback
// Steps:
//   1. chargeable_weight = MAX(gross_weight, vol_weight = L×W×H / vol_factor)
//   2. Convert to LBS or OZ per carrier config
//   3. ZIP → SCF → Zone lookup
//   4. Slab rate lookup (unit_value upper bounds in rate card)
//   5. DAS surcharge if ZIP in DAS master
//   6. Additional surcharges (residential, overweight, large pkg, peak)
//   7. Fuel surcharge % on base
//   8. Partner margin %

export function computeLmCosts(
  shipments: ShipmentInput[],
  ctx: EngineContext
): Map<string, NodeCost> {
  const result = new Map<string, NodeCost>()

  for (const s of shipments) {
    const refDate = new Date(s.pickup_date)

    // Check override first
    const ov = ctx.overrides.get(s.awb)?.get('lm')
    if (ov?.override_flag && ov.override_cost != null) {
      result.set(s.awb, { cost: round2(ov.override_cost), source: 'override' })
      continue
    }

    if (!s.lm_carrier || !s.lm_shipping_method) {
      result.set(s.awb, { cost: 0, source: 'missing', detail: 'no LM carrier assigned' })
      continue
    }

    // ── Step 1: Carrier config ──────────────────────────────────────────────
    const config = ctx.lmCarrierConfigs.find(
      c =>
        c.carrier_name === s.lm_carrier &&
        c.shipping_method === s.lm_shipping_method &&
        c.country === (s.country ?? 'USA') &&
        isDateInRange(refDate, c.start_date, c.end_date)
    )

    if (!config) {
      result.set(s.awb, applyLmAvg(s, refDate, ctx))
      continue
    }

    // ── Step 2: Chargeable weight ───────────────────────────────────────────
    const volWtKg = volumetricWeight(s.length_cm, s.width_cm, s.height_cm, config.vol_factor)
    const chargeWtKg = chargeableWeight(s.gross_weight, volWtKg)

    // ── Step 3: Zone lookup ─────────────────────────────────────────────────
    const zone = lookupZone(s.dest_zip, s.hub_name, s.lm_carrier, s.lm_shipping_method, refDate, ctx)

    if (!zone) {
      result.set(s.awb, applyLmAvg(s, refDate, ctx, `zone not found for ZIP=${s.dest_zip}`))
      continue
    }

    // ── Step 4: Rate slab lookup ────────────────────────────────────────────
    const rateRows = ctx.lmRateCards.filter(
      r =>
        r.carrier_name === s.lm_carrier &&
        r.shipping_method === s.lm_shipping_method &&
        r.zone === zone &&
        r.injection_port === s.hub_name
    ).sort((a, b) => a.unit_value - b.unit_value)

    if (rateRows.length === 0) {
      result.set(s.awb, applyLmAvg(s, refDate, ctx, `no rate card rows`))
      continue
    }

    // Convert weight to carrier's unit
    const unit = rateRows[0].unit
    const shipWt = unit === 'OZ' ? kgToOz(chargeWtKg) : kgToLbs(chargeWtKg)

    // Find slab (first row where unit_value >= shipWt)
    const slab = rateRows.find(r => r.unit_value >= shipWt) ?? rateRows[rateRows.length - 1]
    let baseCost = slab.rate

    // ── Step 5: DAS surcharge ───────────────────────────────────────────────
    if (s.dest_zip) {
      const das = ctx.lmDas.find(
        d =>
          d.carrier_name === s.lm_carrier &&
          d.zipcode === s.dest_zip &&
          isDateInRange(refDate, d.start_date, d.end_date)
      )
      if (das) baseCost += das.surcharge_amount
    }

    // ── Step 6: Surcharges ──────────────────────────────────────────────────
    const surcharges = ctx.lmSurcharges.filter(
      sur => sur.carrier_name === s.lm_carrier && isDateInRange(refDate, sur.start_date, sur.end_date)
    )

    let surchargeTotal = 0

    for (const sur of surcharges) {
      switch (sur.surcharge_type) {
        case 'Residential':
          // Apply if always, or if weight below threshold
          if (!sur.condition_type || sur.condition_type === 'Always') {
            surchargeTotal += sur.charge_type === 'Fixed' ? sur.value : (baseCost * sur.value) / 100
          } else if (sur.condition_type === 'Weight' && sur.condition_value && shipWt < sur.condition_value) {
            surchargeTotal += sur.value
          }
          break

        case 'Additional Handling':
          // Triggered by weight or dimension
          if (sur.condition_type === 'Weight' && sur.condition_value && shipWt > sur.condition_value) {
            surchargeTotal += sur.value
          } else if (sur.condition_type === 'Dimension' && sur.condition_value) {
            const maxDim = Math.max(s.length_cm, s.width_cm, s.height_cm) / 2.54 // to inches
            if (maxDim > sur.condition_value) surchargeTotal += sur.value
          }
          break

        case 'Large Package':
          if (sur.condition_type === 'Dimension' && sur.condition_value) {
            const maxDim = Math.max(s.length_cm, s.width_cm, s.height_cm) / 2.54
            if (maxDim > sur.condition_value) surchargeTotal += sur.value
          }
          break

        case 'Peak':
          // Always apply during configured date range (already filtered by date)
          surchargeTotal += sur.value
          break

        case 'Address Correction':
          // Manual flag only — skip in auto compute
          break
      }
    }

    baseCost += surchargeTotal

    // ── Step 7: Fuel surcharge ──────────────────────────────────────────────
    baseCost = baseCost * (1 + config.fuel_surcharge_pct / 100)

    // ── Step 8: Partner margin ──────────────────────────────────────────────
    const finalCost = baseCost * (1 + config.partner_margin_pct / 100)

    result.set(s.awb, {
      cost: round2(finalCost),
      source: 'calculated',
      detail: `carrier=${s.lm_carrier} | zone=${zone} | slab=${slab.unit_value}${unit} | base=${round2(slab.rate)} | fuel=${config.fuel_surcharge_pct}%`,
    })
  }

  for (const s of shipments) {
    if (!result.has(s.awb)) result.set(s.awb, { cost: 0, source: 'missing' })
  }
  return result
}

// ─── ZONE LOOKUP ─────────────────────────────────────────────────────────────
// National carriers: SCF (first 3 digits of ZIP) → zone
// Regional carriers: full ZIP → zone

function lookupZone(
  destZip: string | undefined,
  injectionPort: string,
  carrier: string,
  method: string,
  date: Date,
  ctx: EngineContext
): string | undefined {
  if (!destZip) return undefined

  const activeRows = ctx.lmZoneMapping.filter(
    z =>
      z.carrier_name === carrier &&
      z.shipping_method === method &&
      z.injection_port === injectionPort &&
      isDateInRange(date, z.start_date, z.end_date)
  )

  // Try full ZIP first
  let row = activeRows.find(z => z.destination_key === destZip)
  if (row) return row.zone

  // Try SCF (first 3 digits)
  const scf = destZip.slice(0, 3)
  row = activeRows.find(z => z.destination_key === scf)
  return row?.zone
}

// ─── AVG FALLBACK ─────────────────────────────────────────────────────────────

function applyLmAvg(
  s: ShipmentInput,
  refDate: Date,
  ctx: EngineContext,
  detail?: string
): NodeCost {
  const avg = ctx.lmAvg.find(
    a =>
      a.carrier_name === s.lm_carrier &&
      a.shipping_method === s.lm_shipping_method &&
      isDateInRange(refDate, a.start_date, a.end_date)
  )
  if (avg) {
    return {
      cost: round2(avg.avg_cost_per_kg * s.gross_weight),
      source: 'avg',
      detail: detail ?? 'avg fallback',
    }
  }
  return { cost: 0, source: 'missing', detail: detail ?? 'no LM rate or avg' }
}
