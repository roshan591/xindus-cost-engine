import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const week = searchParams.get('week')
  const month = searchParams.get('month')
  const where: Record<string, unknown> = {}

  if (week) {
    const [yearStr, weekStr] = week.split('-W')
    const jan1 = new Date(parseInt(yearStr), 0, 1)
    const start = new Date(jan1); start.setDate(jan1.getDate() + (parseInt(weekStr) - 1) * 7)
    const end = new Date(start); end.setDate(start.getDate() + 7)
    where.pickup_date = { gte: start, lt: end }
  } else if (month) {
    const [y, m] = month.split('-')
    where.pickup_date = { gte: new Date(parseInt(y), parseInt(m) - 1, 1), lt: new Date(parseInt(y), parseInt(m), 1) }
  }

  const shipments = await prisma.shipment.findMany({ where, include: { costs: true }, orderBy: { pickup_date: 'asc' } })
  if (!shipments.length) return NextResponse.json({ error: 'No shipments found' }, { status: 404 })

  const wb = XLSX.utils.book_new()

  // Sheet 1: Full breakdown
  const rows = shipments.map(s => ({
    'AWB': s.awb, 'Pickup Date': s.pickup_date.toISOString().slice(0,10),
    'Service Node': s.service_node, 'Hub': s.hub_name,
    'Manifest': s.pc_to_hub ?? '', 'Flight No': s.pc_to_hub_flight_no ?? '',
    'MAWB': s.mawb ?? '', 'Port of Origin': s.port_of_origin ?? '',
    'OC Type': s.clearance_type_oc ?? '', 'OC Vendor': s.oc_vendor ?? '',
    'Entry Port': s.point_of_entry ?? '', 'DC Type': s.dest_clearance_type ?? '',
    'Service Type': s.service_type ?? '', 'DC Partner': s.dc_partner ?? '',
    'Country': s.country ?? '', 'Pkg Type': s.pkg_type,
    'Packages': s.n_packages, 'L cm': s.length_cm, 'W cm': s.width_cm, 'H cm': s.height_cm,
    'Gross Wt kg': s.gross_weight, 'LM Carrier': s.lm_carrier ?? '',
    'Shipping Method': s.lm_shipping_method ?? '', 'Dest ZIP': s.dest_zip ?? '',
    'Pickup ₹': s.costs?.pickup_cost ?? 0, 'Pickup Src': s.costs?.pickup_source ?? '',
    'First Mile ₹': s.costs?.fm_cost ?? 0, 'FM Src': s.costs?.fm_source ?? '',
    'Hub ₹': s.costs?.hub_cost ?? 0, 'Hub Src': s.costs?.hub_source ?? '',
    'Origin Customs ₹': s.costs?.oc_cost ?? 0, 'OC Src': s.costs?.oc_source ?? '',
    'Middle Mile ₹': s.costs?.mm_cost ?? 0, 'MM Src': s.costs?.mm_source ?? '',
    'Dest Handling ₹': s.costs?.dh_cost ?? 0, 'DH Src': s.costs?.dh_source ?? '',
    'Dest Clearance ₹': s.costs?.dc_clearance_cost ?? 0, 'DC Src': s.costs?.dc_clearance_source ?? '',
    'Drop-Off ₹': s.costs?.dropoff_cost ?? 0, 'Dropoff Src': s.costs?.dropoff_source ?? '',
    'Last Mile ₹': s.costs?.lm_cost ?? 0, 'LM Src': s.costs?.lm_source ?? '',
    'Total ₹': s.costs?.total_cost ?? 0,
    '₹/kg': s.costs && s.gross_weight ? +(s.costs.total_cost / s.gross_weight).toFixed(2) : 0,
    'Computed At': s.costs?.computed_at.toISOString().slice(0,19) ?? '',
  }))

  const ws1 = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws1, 'Cost Breakdown')

  // Sheet 2: Weekly summary
  const nodes = ['pickup', 'fm', 'hub', 'oc', 'mm', 'dh', 'dc_clearance', 'dropoff', 'lm'] as const
  type NodeKey = (typeof nodes)[number]
  type WS = { week: string; count: number; weight: number; total: number } & Record<NodeKey, number>
  const wm = new Map<string, WS>()

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
  for (const s of shipments) {
    const d = s.pickup_date
    const wk = Math.ceil(((d.getTime() - new Date(d.getFullYear(),0,1).getTime()) / 86400000 + 1) / 7)
    const lbl = `${d.getFullYear()}-W${String(wk).padStart(2,'0')}`
    if (!wm.has(lbl)) {
      const nodeDefaults = Object.fromEntries(nodes.map((node) => [node, 0])) as Record<NodeKey, number>
      wm.set(lbl, { week: lbl, count: 0, weight: 0, total: 0, ...nodeDefaults })
    }
    const w = wm.get(lbl)!
    w.count++; w.weight += s.gross_weight
    if (s.costs) {
      const costs = s.costs
      w.total += costs.total_cost
      nodes.forEach((node) => { w[node] += getNodeCost(costs, node) })
    }
  }
  const wrows = Array.from(wm.values()).sort((a,b)=>a.week.localeCompare(b.week)).map(w => ({
    'Week': w.week, 'Shipments': w.count, 'Weight kg': +w.weight.toFixed(2),
    'Pickup ₹': +w.pickup.toFixed(2), 'First Mile ₹': +w.fm.toFixed(2),
    'Hub ₹': +w.hub.toFixed(2), 'Origin Customs ₹': +w.oc.toFixed(2),
    'Middle Mile ₹': +w.mm.toFixed(2), 'Dest Handling ₹': +w.dh.toFixed(2),
    'Dest Clearance ₹': +w.dc_clearance.toFixed(2), 'Drop-Off ₹': +w.dropoff.toFixed(2),
    'Last Mile ₹': +w.lm.toFixed(2), 'Total ₹': +w.total.toFixed(2),
    '₹/kg': w.weight ? +(w.total/w.weight).toFixed(2) : 0,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wrows), 'Weekly Summary')

  // Sheet 3: Node distribution
  const nodeLabels: [NodeKey, string][] = [
    ['pickup','Pickup'],['fm','First Mile'],['hub','Hub'],['oc','Origin Customs'],
    ['mm','Middle Mile'],['dh','Dest. Handling'],['dc_clearance','Dest. Clearance'],
    ['dropoff','Drop-Off'],['lm','Last Mile'],
  ]
  const grand = shipments.reduce((a,s)=>a+(s.costs?.total_cost??0),0)
  const drows = nodeLabels.map(([k,l])=>{
    const c = shipments.reduce((a, s) => a + (s.costs ? getNodeCost(s.costs, k) : 0), 0)
    return { 'Node': l, 'Total ₹': +c.toFixed(2), '% of Total': grand ? +(c/grand*100).toFixed(1) : 0 }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(drows), 'Node Distribution')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `xindus-cost-${week ?? month ?? 'all'}.xlsx`
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
