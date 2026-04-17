import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shipments } from '@/db/schema'

export async function GET(req: NextRequest) {
  const manifestId = req.nextUrl.searchParams.get('id')
  const mawb       = req.nextUrl.searchParams.get('mawb')
  if (!manifestId && !mawb) return NextResponse.json({ error: 'Provide id or mawb' }, { status: 400 })

  const rows = await db.query.shipments.findMany({
    where: manifestId
      ? (t, { eq }) => eq(t.pc_to_hub, manifestId)
      : (t, { eq }) => eq(t.mawb, mawb!),
    with: { costs: true },
    orderBy: (t, { desc }) => [desc(t.gross_weight)],
  })
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const totalWeight = rows.reduce((a, s) => a + s.gross_weight, 0)
  const totalCost   = rows.reduce((a, s) => a + (s.costs?.total_cost ?? 0), 0)

  const nodes = ['pickup', 'fm', 'hub', 'oc', 'mm', 'dh', 'dc_clearance', 'dropoff', 'lm'] as const
  type NodeKey = (typeof nodes)[number]

  const getNodeCost = (c: NonNullable<(typeof rows)[number]['costs']>, node: NodeKey): number => {
    switch (node) {
      case 'pickup':       return c.pickup_cost
      case 'fm':           return c.fm_cost
      case 'hub':          return c.hub_cost
      case 'oc':           return c.oc_cost
      case 'mm':           return c.mm_cost
      case 'dh':           return c.dh_cost
      case 'dc_clearance': return c.dc_clearance_cost
      case 'dropoff':      return c.dropoff_cost
      case 'lm':           return c.lm_cost
    }
  }

  const nodeTotals = Object.fromEntries(nodes.map(node => [
    node, rows.reduce((a, s) => a + (s.costs ? getNodeCost(s.costs, node) : 0), 0),
  ]))

  return NextResponse.json({
    manifest_id: manifestId, mawb: mawb ?? rows[0].mawb,
    flight_no: manifestId ? rows[0].pc_to_hub_flight_no : undefined,
    origin_node: rows[0].service_node, hub: rows[0].hub_name,
    shipment_count: rows.length, total_weight: totalWeight,
    total_packages: rows.reduce((a, s) => a + s.n_packages, 0),
    total_cost: totalCost, cost_per_kg: totalWeight ? totalCost / totalWeight : 0,
    node_totals: nodeTotals,
    shipments: rows.map(s => ({
      awb: s.awb, pickup_date: s.pickup_date,
      gross_weight: s.gross_weight, pkg_type: s.pkg_type,
      n_packages: s.n_packages, total_cost: s.costs?.total_cost ?? 0,
      cost_share_pct: totalWeight ? ((s.gross_weight / totalWeight) * 100).toFixed(1) : '0',
    })),
  })
}
