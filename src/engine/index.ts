import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  shipmentCosts,
  pickupCostMasters, pickupAvgMasters,
  fmMasters, fmAvgMasters,
  hubCostMasters, holidays,
  ocMasters, ocAvgMasters,
  mmMasters, mmAvgMasters,
  dhMasters, dhAvgMasters,
  dcClearanceMasters, dcClearanceAvgMasters,
  dropoffMasters, dropoffAvgMasters,
  lmCarrierConfigs, lmZoneMappings, lmRateCards,
  lmDasMasters, lmSurchargeMasters, lmAvgMasters,
  costOverrides,
} from '@/db/schema'
import { ShipmentInput, ShipmentCostResult, EngineContext } from '@/types'
import { computePickupCosts } from './pickup'
import { computeFmCosts } from './firstMile'
import { computeHubCosts } from './hub'
import { computeOcCosts } from './originCustoms'
import { computeMmCosts, computeDhCosts, computeDcClearanceCosts, computeDropoffCosts } from './destNodes'
import { computeLmCosts } from './lastMile'
import { round2, extractPartner } from '@/lib/utils'

// ─── MASTER DATA LOADER ───────────────────────────────────────────────────────

export async function loadEngineContext(awbs?: string[]): Promise<EngineContext> {
  const [
    pickupMastersRows, pickupAvgRows,
    fmMastersRows, fmAvgRows,
    hubMastersRows, holidayRows,
    ocMastersRows, ocAvgRows,
    mmMastersRows, mmAvgRows,
    dhMastersRows, dhAvgRows,
    dcClearanceMastersRows, dcClearanceAvgRows,
    dropoffMastersRows, dropoffAvgRows,
    lmCarrierConfigRows, lmZoneMappingRows, lmRateCardRows,
    lmDasRows, lmSurchargeRows, lmAvgRows,
    overrideRows,
  ] = await Promise.all([
    db.select().from(pickupCostMasters),
    db.select().from(pickupAvgMasters),
    db.select().from(fmMasters),
    db.select().from(fmAvgMasters),
    db.select().from(hubCostMasters),
    db.select().from(holidays),
    db.select().from(ocMasters),
    db.select().from(ocAvgMasters),
    db.select().from(mmMasters),
    db.select().from(mmAvgMasters),
    db.select().from(dhMasters),
    db.select().from(dhAvgMasters),
    db.select().from(dcClearanceMasters),
    db.select().from(dcClearanceAvgMasters),
    db.select().from(dropoffMasters),
    db.select().from(dropoffAvgMasters),
    db.select().from(lmCarrierConfigs),
    db.select().from(lmZoneMappings),
    db.select().from(lmRateCards),
    db.select().from(lmDasMasters),
    db.select().from(lmSurchargeMasters),
    db.select().from(lmAvgMasters),
    awbs && awbs.length > 0
      ? db.select().from(costOverrides).where(inArray(costOverrides.awb, awbs))
      : db.select().from(costOverrides),
  ])

  const overridesMap = new Map<string, Map<string, { override_flag: boolean; override_cost: number | null }>>()
  for (const ov of overrideRows) {
    if (!overridesMap.has(ov.awb)) overridesMap.set(ov.awb, new Map())
    overridesMap.get(ov.awb)!.set(ov.node, {
      override_flag: ov.override_flag,
      override_cost: ov.override_cost ?? null,
    })
  }

  return {
    pickupMasters:       pickupMastersRows,
    pickupAvg:           pickupAvgRows,
    fmMasters:           fmMastersRows.map(m => ({ ...m, flight_no: m.flight_no ?? null })),
    fmAvg:               fmAvgRows,
    hubMasters:          hubMastersRows,
    holidays:            holidayRows.map(h => ({ date: h.date, hub_name: h.hub_name })),
    ocMasters:           ocMastersRows.map(m => ({ ...m, charge_type: m.charge_type as any })),
    ocAvg:               ocAvgRows,
    mmMasters:           mmMastersRows,
    mmAvg:               mmAvgRows,
    dhMasters:           dhMastersRows.map(m => ({ ...m, charge_type: m.charge_type as any })),
    dhAvg:               dhAvgRows,
    dcClearanceMasters:  dcClearanceMastersRows.map(m => ({ ...m, charge_type: m.charge_type as any })),
    dcClearanceAvg:      dcClearanceAvgRows,
    dropoffMasters:      dropoffMastersRows,
    dropoffAvg:          dropoffAvgRows,
    lmCarrierConfigs:    lmCarrierConfigRows.map(c => ({
      ...c,
      carrier_type: c.carrier_type as any,
      rate_type: c.rate_type as any,
    })),
    lmZoneMapping:       lmZoneMappingRows,
    lmRateCards:         lmRateCardRows.map(r => ({ ...r, unit: r.unit as any })),
    lmDas:               lmDasRows,
    lmSurcharges:        lmSurchargeRows,
    lmAvg:               lmAvgRows,
    overrides:           overridesMap,
  }
}

// ─── MAIN ENGINE RUNNER ────────────────────────────────────────────────────────

export async function runCostEngine(
  shipments: ShipmentInput[],
  ctx?: EngineContext
): Promise<ShipmentCostResult[]> {
  try {
    const enriched = shipments.map(s => ({
      ...s,
      dc_partner: s.dc_partner ?? extractPartner(s.injection_port),
    }))

    const context = ctx ?? await loadEngineContext(enriched.map(s => s.awb))

    const [
      pickupMap, fmMap, hubMap, ocMap, mmMap, dhMap, dcMap, dropoffMap, lmMap
    ] = await Promise.all([
      computePickupCosts(enriched, context),
      computeFmCosts(enriched, context),
      computeHubCosts(enriched, context),
      computeOcCosts(enriched, context),
      computeMmCosts(enriched, context),
      computeDhCosts(enriched, context),
      computeDcClearanceCosts(enriched, context),
      computeDropoffCosts(enriched, context),
      computeLmCosts(enriched, context),
    ])

    return enriched.map(s => {
      const pickup      = pickupMap.get(s.awb)      ?? { cost: 0, source: 'missing' as const }
      const fm          = fmMap.get(s.awb)          ?? { cost: 0, source: 'missing' as const }
      const hub         = hubMap.get(s.awb)         ?? { cost: 0, source: 'missing' as const }
      const oc          = ocMap.get(s.awb)          ?? { cost: 0, source: 'missing' as const }
      const mm          = mmMap.get(s.awb)          ?? { cost: 0, source: 'missing' as const }
      const dh          = dhMap.get(s.awb)          ?? { cost: 0, source: 'missing' as const }
      const dc_clearance = dcMap.get(s.awb)         ?? { cost: 0, source: 'missing' as const }
      const dropoff     = dropoffMap.get(s.awb)     ?? { cost: 0, source: 'missing' as const }
      const lm          = lmMap.get(s.awb)          ?? { cost: 0, source: 'missing' as const }

      const total = round2(
        pickup.cost + fm.cost + hub.cost + oc.cost + mm.cost +
        dh.cost + dc_clearance.cost + dropoff.cost + lm.cost
      )

      return { awb: s.awb, pickup, fm, hub, oc, mm, dh, dc_clearance, dropoff, lm, total }
    })
  } catch (err) {
    console.error('Cost engine failed:', err)
    throw err
  }
}

// ─── PERSIST COMPUTED COSTS ───────────────────────────────────────────────────

export async function persistCosts(results: ShipmentCostResult[]): Promise<void> {
  if (results.length === 0) return
  await Promise.all(
    results.map(r =>
      db.insert(shipmentCosts).values({
        awb:                r.awb,
        pickup_cost:        r.pickup.cost,
        pickup_source:      r.pickup.source,
        fm_cost:            r.fm.cost,
        fm_source:          r.fm.source,
        hub_cost:           r.hub.cost,
        hub_source:         r.hub.source,
        oc_cost:            r.oc.cost,
        oc_source:          r.oc.source,
        mm_cost:            r.mm.cost,
        mm_source:          r.mm.source,
        dh_cost:            r.dh.cost,
        dh_source:          r.dh.source,
        dc_clearance_cost:  r.dc_clearance.cost,
        dc_clearance_source: r.dc_clearance.source,
        dropoff_cost:       r.dropoff.cost,
        dropoff_source:     r.dropoff.source,
        lm_cost:            r.lm.cost,
        lm_source:          r.lm.source,
        total_cost:         r.total,
        computed_at:        new Date(),
      }).onConflictDoUpdate({
        target: shipmentCosts.awb,
        set: {
          pickup_cost:        r.pickup.cost,
          pickup_source:      r.pickup.source,
          fm_cost:            r.fm.cost,
          fm_source:          r.fm.source,
          hub_cost:           r.hub.cost,
          hub_source:         r.hub.source,
          oc_cost:            r.oc.cost,
          oc_source:          r.oc.source,
          mm_cost:            r.mm.cost,
          mm_source:          r.mm.source,
          dh_cost:            r.dh.cost,
          dh_source:          r.dh.source,
          dc_clearance_cost:  r.dc_clearance.cost,
          dc_clearance_source: r.dc_clearance.source,
          dropoff_cost:       r.dropoff.cost,
          dropoff_source:     r.dropoff.source,
          lm_cost:            r.lm.cost,
          lm_source:          r.lm.source,
          total_cost:         r.total,
          computed_at:        new Date(),
        },
      })
    )
  )
}

// ─── BACKWARD-COMPAT ALIASES ──────────────────────────────────────────────────

export const loadMasters    = loadEngineContext
export const runEngine      = runCostEngine
export const persistResults = persistCosts
