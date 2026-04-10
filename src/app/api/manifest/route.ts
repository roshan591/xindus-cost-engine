import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const manifestId = req.nextUrl.searchParams.get('id')
  const mawb = req.nextUrl.searchParams.get('mawb')
  if (!manifestId && !mawb) return NextResponse.json({ error: 'Provide id or mawb' }, { status: 400 })
  const where = manifestId ? { pc_to_hub: manifestId } : { mawb: mawb! }
  const shipments = await prisma.shipment.findMany({ where, include: { costs: true }, orderBy: { gross_weight: 'desc' } })
  if (!shipments.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const totalWeight = shipments.reduce((a, s) => a + s.gross_weight, 0)
  const totalCost   = shipments.reduce((a, s) => a + (s.costs?.total_cost ?? 0), 0)
  const nodes = ['pickup', 'fm', 'hub', 'oc', 'mm', 'dh', 'dc_clearance', 'dropoff', 'lm'] as const
  type NodeKey = (typeof nodes)[number]
  const getNodeCost = (costs: NonNullable<(typeof shipments)[number]['costs']>, node: NodeKey) => {
    switch (node) {
      case 'pickup': return costs.pickup_cost
      case 'fm': return costs.fm_cost
      case 'hub': return costs.hub_cost
      case 'oc': return costs.oc_cost
      case 'mm': return costs.mm_cost
      case 'dh': return costs.dh_cost
      case 'dc_clearance': return costs.dc_clearance_cost
      case 'dropoff': return costs.dropoff_cost
      case 'lm': return costs.lm_cost
    }
  }
  const nodeTotals = Object.fromEntries(nodes.map((node) => [
    node,
    shipments.reduce((a, s) => a + (s.costs ? getNodeCost(s.costs, node) : 0), 0),
  ]))
  return NextResponse.json({
    manifest_id: manifestId, mawb: mawb ?? shipments[0].mawb,
    flight_no: manifestId ? shipments[0].pc_to_hub_flight_no : undefined,
    origin_node: shipments[0].service_node, hub: shipments[0].hub_name,
    shipment_count: shipments.length, total_weight: totalWeight,
    total_packages: shipments.reduce((a, s) => a + s.n_packages, 0),
    total_cost: totalCost, cost_per_kg: totalWeight ? totalCost / totalWeight : 0,
    node_totals: nodeTotals,
    shipments: shipments.map(s => ({
      awb: s.awb, pickup_date: s.pickup_date,
      gross_weight: s.gross_weight, pkg_type: s.pkg_type,
      n_packages: s.n_packages, total_cost: s.costs?.total_cost ?? 0,
      cost_share_pct: totalWeight ? ((s.gross_weight / totalWeight) * 100).toFixed(1) : '0',
    })),
  })
}
