import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runCostEngine, loadEngineContext, persistCosts } from '@/engine'
import { ShipmentInput } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const awbs: string[] | undefined = body.awbs

    const dbShipments = await prisma.shipment.findMany({
      where: awbs ? { awb: { in: awbs } } : undefined,
      orderBy: { pickup_date: 'asc' },
    })

    if (dbShipments.length === 0) {
      return NextResponse.json({ message: 'No shipments found', count: 0 })
    }

    const inputs: ShipmentInput[] = dbShipments.map(s => ({
      awb: s.awb,
      pickup_date: s.pickup_date.toISOString(),
      service_node: s.service_node,
      hub_name: s.hub_name,
      pc_to_hub: s.pc_to_hub ?? undefined,
      pc_to_hub_created_on: s.pc_to_hub_created_on?.toISOString(),
      pc_to_hub_flight_no: s.pc_to_hub_flight_no ?? undefined,
      mawb: s.mawb ?? undefined,
      mawb_date: s.mawb_date?.toISOString(),
      port_of_origin: s.port_of_origin ?? undefined,
      clearance_type_oc: s.clearance_type_oc ?? undefined,
      oc_vendor: s.oc_vendor ?? undefined,
      dest_clearance_type: s.dest_clearance_type ?? undefined,
      service_type: s.service_type ?? undefined,
      point_of_entry: s.point_of_entry ?? undefined,
      injection_port: s.injection_port ?? undefined,
      dc_partner: s.dc_partner ?? undefined,
      country: s.country ?? undefined,
      pkg_type: s.pkg_type as 'box' | 'flyer',
      n_packages: s.n_packages,
      length_cm: s.length_cm,
      width_cm: s.width_cm,
      height_cm: s.height_cm,
      gross_weight: s.gross_weight,
      line_items: s.line_items,
      lm_carrier: s.lm_carrier ?? undefined,
      lm_shipping_method: s.lm_shipping_method ?? undefined,
      dest_zip: s.dest_zip ?? undefined,
    }))

    const ctx = await loadEngineContext(inputs.map(i => i.awb))
    const results = await runCostEngine(inputs, ctx)
    await persistCosts(results)

    const total = results.reduce((a, r) => a + r.total, 0)

    return NextResponse.json({
      message: 'Costs computed and saved',
      count: results.length,
      summary: {
        total,
        byNode: {
          pickup:      results.reduce((a, r) => a + r.pickup.cost, 0),
          fm:          results.reduce((a, r) => a + r.fm.cost, 0),
          hub:         results.reduce((a, r) => a + r.hub.cost, 0),
          oc:          results.reduce((a, r) => a + r.oc.cost, 0),
          mm:          results.reduce((a, r) => a + r.mm.cost, 0),
          dh:          results.reduce((a, r) => a + r.dh.cost, 0),
          dc_clearance:results.reduce((a, r) => a + r.dc_clearance.cost, 0),
          dropoff:     results.reduce((a, r) => a + r.dropoff.cost, 0),
          lm:          results.reduce((a, r) => a + r.lm.cost, 0),
        },
      },
    })
  } catch (err) {
    console.error('Compute error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
