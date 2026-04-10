import { NextRequest, NextResponse } from 'next/server'
import { prisma as db } from '@/lib/prisma'
import { runEngine, persistResults, loadMasters } from '@/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const awbs: string[] | undefined = body.awbs

    const ships = await db.shipment.findMany({
      where: awbs ? { awb: { in: awbs } } : undefined,
      orderBy: { pickup_date: 'asc' },
    })

    if (!ships.length) return NextResponse.json({ message: 'No shipments', count: 0 })

    const inputs = ships.map(s => ({
      awb: s.awb, pickup_date: s.pickup_date.toISOString(),
      service_node: s.service_node, hub_name: s.hub_name,
      pc_to_hub: s.pc_to_hub ?? undefined,
      pc_to_hub_created_on: s.pc_to_hub_created_on?.toISOString(),
      pc_to_hub_flight_no: s.pc_to_hub_flight_no ?? undefined,
      mawb: s.mawb ?? undefined, mawb_date: s.mawb_date?.toISOString(),
      port_of_origin: s.port_of_origin ?? undefined,
      clearance_type_oc: s.clearance_type_oc ?? undefined,
      oc_vendor: s.oc_vendor ?? undefined,
      dest_clearance_type: s.dest_clearance_type ?? undefined,
      service_type: s.service_type ?? undefined,
      point_of_entry: s.point_of_entry ?? undefined,
      injection_port: s.injection_port ?? undefined,
      dc_partner: s.dc_partner ?? undefined,
      country: s.country ?? undefined,
      pkg_type: s.pkg_type,
      n_packages: s.n_packages, length_cm: s.length_cm,
      width_cm: s.width_cm, height_cm: s.height_cm,
      gross_weight: s.gross_weight, line_items: s.line_items,
      lm_carrier: s.lm_carrier ?? undefined,
      lm_shipping_method: s.lm_shipping_method ?? undefined,
      dest_zip: s.dest_zip ?? undefined,
    }))

    const masters = await loadMasters(inputs.map(i => i.awb))
    const results = await runEngine(inputs, masters)
    await persistResults(results)

    return NextResponse.json({
      count: results.length,
      total: results.reduce((a, r) => a + r.total, 0),
    })
  } catch (e) {
    console.error('Compute error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
