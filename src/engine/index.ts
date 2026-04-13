import { PrismaClient } from '@prisma/client'
import { ShipmentInput, ShipmentCostResult, EngineContext } from '@/types'
import { computePickupCosts } from './pickup'
import { computeFmCosts } from './firstMile'
import { computeHubCosts } from './hub'
import { computeOcCosts } from './originCustoms'
import { computeMmCosts, computeDhCosts, computeDcClearanceCosts, computeDropoffCosts } from './destNodes'
import { computeLmCosts } from './lastMile'
import { round2, extractPartner } from '@/lib/utils'

// ✅ Prisma Singleton (important for Vercel / Next.js)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// ─── MASTER DATA LOADER ───────────────────────────────────────────────────────

export async function loadEngineContext(awbs?: string[]): Promise<EngineContext> {
  const [
    pickupMasters, pickupAvg,
    fmMasters, fmAvg,
    hubMasters, holidays,
    ocMasters, ocAvg,
    mmMasters, mmAvg,
    dhMasters, dhAvg,
    dcClearanceMasters, dcClearanceAvg,
    dropoffMasters, dropoffAvg,
    lmCarrierConfigs, lmZoneMapping, lmRateCards, lmDas, lmSurcharges, lmAvg,
    overrideRows,
  ] = await Promise.all([
    prisma.pickupCostMaster.findMany(),
    prisma.pickupAvgMaster.findMany(),
    prisma.fmMaster.findMany(),
    prisma.fmAvgMaster.findMany(),
    prisma.hubCostMaster.findMany(),
    prisma.holiday.findMany(),
    prisma.ocMaster.findMany(),
    prisma.ocAvgMaster.findMany(),
    prisma.mmMaster.findMany(),
    prisma.mmAvgMaster.findMany(),
    prisma.dhMaster.findMany(),
    prisma.dhAvgMaster.findMany(),
    prisma.dcClearanceMaster.findMany(),
    prisma.dcClearanceAvgMaster.findMany(),
    prisma.dropoffMaster.findMany(),
    prisma.dropoffAvgMaster.findMany(),
    prisma.lmCarrierConfig.findMany(),
    prisma.lmZoneMapping.findMany(),
    prisma.lmRateCard.findMany(),
    prisma.lmDasMaster.findMany(),
    prisma.lmSurchargeMaster.findMany(),
    prisma.lmAvgMaster.findMany(),
    prisma.costOverride.findMany({
      where: awbs ? { awb: { in: awbs } } : undefined,
    }),
  ])

  // Build override map
  const overrides = new Map<
    string,
    Map<string, { override_flag: boolean; override_cost: number | null }>
  >()

  for (const ov of overrideRows) {
    if (!overrides.has(ov.awb)) {
      overrides.set(ov.awb, new Map())
    }

    overrides.get(ov.awb)!.set(ov.node, {
      override_flag: ov.override_flag,
      override_cost: ov.override_cost,
    })
  }

  return {
    pickupMasters, pickupAvg,
    fmMasters: fmMasters.map(m => ({ ...m, flight_no: m.flight_no ?? null })),
    fmAvg,
    hubMasters,
    holidays: holidays.map(h => ({ date: h.date, hub_name: h.hub_name })),
    ocMasters: ocMasters.map(m => ({ ...m, charge_type: m.charge_type as any })),
    ocAvg,
    mmMasters,
    mmAvg,
    dhMasters: dhMasters.map(m => ({ ...m, charge_type: m.charge_type as any })),
    dhAvg,
    dcClearanceMasters: dcClearanceMasters.map(m => ({ ...m, charge_type: m.charge_type as any })),
    dcClearanceAvg,
    dropoffMasters,
    dropoffAvg,
    lmCarrierConfigs: lmCarrierConfigs.map(c => ({
      ...c,
      carrier_type: c.carrier_type as any,
      rate_type: c.rate_type as any,
    })),
    lmZoneMapping,
    lmRateCards: lmRateCards.map(r => ({ ...r, unit: r.unit as any })),
    lmDas,
    lmSurcharges,
    lmAvg,
    overrides,
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
      const pickup = pickupMap.get(s.awb) ?? { cost: 0, source: 'missing' as const }
      const fm = fmMap.get(s.awb) ?? { cost: 0, source: 'missing' as const }
      const hub = hubMap.get(s.awb) ?? { cost: 0, source: 'missing' as const }
      const oc = ocMap.get(s.awb) ?? { cost: 0, source: 'missing' as const }
      const mm = mmMap.get(s.awb) ?? { cost: 0, source: 'missing' as const }
      const dh = dhMap.get(s.awb) ?? { cost: 0, source: 'missing' as const }
      const dc_clearance = dcMap.get(s.awb) ?? { cost: 0, source: 'missing' as const }
      const dropoff = dropoffMap.get(s.awb) ?? { cost: 0, source: 'missing' as const }
      const lm = lmMap.get(s.awb) ?? { cost: 0, source: 'missing' as const }

      const total = round2(
        pickup.cost + fm.cost + hub.cost + oc.cost + mm.cost +
        dh.cost + dc_clearance.cost + dropoff.cost + lm.cost
      )

      return {
        awb: s.awb,
        pickup, fm, hub, oc, mm, dh, dc_clearance, dropoff, lm, total
      }
    })

  } catch (err) {
    console.error('Cost engine failed:', err)
    throw err
  }
}

// ─── PERSIST COMPUTED COSTS ───────────────────────────────────────────────────

export async function persistCosts(results: ShipmentCostResult[]): Promise<void> {
  await Promise.all(
    results.map(r =>
      prisma.shipmentCost.upsert({
        where: { awb: r.awb },
        create: {
          awb: r.awb,
          pickup_cost: r.pickup.cost,
          pickup_source: r.pickup.source,
          fm_cost: r.fm.cost,
          fm_source: r.fm.source,
          hub_cost: r.hub.cost,
          hub_source: r.hub.source,
          oc_cost: r.oc.cost,
          oc_source: r.oc.source,
          mm_cost: r.mm.cost,
          mm_source: r.mm.source,
          dh_cost: r.dh.cost,
          dh_source: r.dh.source,
          dc_clearance_cost: r.dc_clearance.cost,
          dc_clearance_source: r.dc_clearance.source,
          dropoff_cost: r.dropoff.cost,
          dropoff_source: r.dropoff.source,
          lm_cost: r.lm.cost,
          lm_source: r.lm.source,
          total_cost: r.total,
          computed_at: new Date(),
        },
        update: {
          pickup_cost: r.pickup.cost,
          pickup_source: r.pickup.source,
          fm_cost: r.fm.cost,
          fm_source: r.fm.source,
          hub_cost: r.hub.cost,
          hub_source: r.hub.source,
          oc_cost: r.oc.cost,
          oc_source: r.oc.source,
          mm_cost: r.mm.cost,
          mm_source: r.mm.source,
          dh_cost: r.dh.cost,
          dh_source: r.dh.source,
          dc_clearance_cost: r.dc_clearance.cost,
          dc_clearance_source: r.dc_clearance.source,
          dropoff_cost: r.dropoff.cost,
          dropoff_source: r.dropoff.source,
          lm_cost: r.lm.cost,
          lm_source: r.lm.source,
          total_cost: r.total,
          computed_at: new Date(),
        },
      })
    )
  )
}

// ─── BACKWARD-COMPAT EXPORTS (CLEAN VERSION) ──────────────────────────────────

export const loadMasters = loadEngineContext
export const runEngine = runCostEngine
export const persistResults = persistCosts
