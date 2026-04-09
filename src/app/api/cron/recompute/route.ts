import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runCostEngine, loadEngineContext, persistCosts } from '@/engine'
import { ShipmentInput } from '@/types'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 70)
  const dbShipments = await prisma.shipment.findMany({
    where: { pickup_date: { gte: cutoff } },
    orderBy: { pickup_date: 'asc' },
  })
  if (dbShipments.length === 0) return NextResponse.json({ message: 'No shipments', count: 0 })
  const inputs: ShipmentInput[] = dbShipments.map(s => ({
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
    pkg_type: s.pkg_type as 'box' | 'flyer',
    n_packages: s.n_packages, length_cm: s.length_cm,
    width_cm: s.width_cm, height_cm: s.height_cm,
    gross_weight: s.gross_weight, line_items: s.line_items,
    lm_carrier: s.lm_carrier ?? undefined,
    lm_shipping_method: s.lm_shipping_method ?? undefined,
    dest_zip: s.dest_zip ?? undefined,
  }))
  const ctx = await loadEngineContext()
  const results = await runCostEngine(inputs, ctx)
  await persistCosts(results)
  return NextResponse.json({
    success: true, recomputed: results.length,
    total_cost: results.reduce((a, r) => a + r.total, 0),
    ran_at: new Date().toISOString(),
  })
}
