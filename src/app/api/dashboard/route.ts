import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const weeks = Math.min(parseInt(searchParams.get('weeks') ?? '8'), 16)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - weeks * 7)

  const shipments = await prisma.shipment.findMany({
    where: { pickup_date: { gte: cutoff } },
    include: { costs: true },
    orderBy: { pickup_date: 'asc' },
  })

  // KPIs
  const totalCost   = shipments.reduce((a, s) => a + (s.costs?.total_cost ?? 0), 0)
  const totalWeight = shipments.reduce((a, s) => a + s.gross_weight, 0)
  const count       = shipments.length

  // Weekly rollup
  const nodes = ['pickup', 'fm', 'hub', 'oc', 'mm', 'dh', 'dc_clearance', 'dropoff', 'lm'] as const
  type NodeKey = (typeof nodes)[number]
  type Bucket = { week: string; count: number; weight: number; total: number } & Record<NodeKey, number>
  const weekMap = new Map<string, Bucket>()

  for (const s of shipments) {
    const d = s.pickup_date
    const startOfYear = new Date(d.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + 1) / 7)
    const label = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`

    if (!weekMap.has(label)) {
      const nodeDefaults = Object.fromEntries(nodes.map((node) => [node, 0])) as Record<NodeKey, number>
      const b: Bucket = { week: label, count: 0, weight: 0, total: 0, ...nodeDefaults }
      weekMap.set(label, b)
    }
    const b = weekMap.get(label)!
    b.count++; b.weight += s.gross_weight
    if (s.costs) {
      b.total          += s.costs.total_cost
      b.pickup         += s.costs.pickup_cost
      b.fm             += s.costs.fm_cost
      b.hub            += s.costs.hub_cost
      b.oc             += s.costs.oc_cost
      b.mm             += s.costs.mm_cost
      b.dh             += s.costs.dh_cost
      b.dc_clearance   += s.costs.dc_clearance_cost
      b.dropoff        += s.costs.dropoff_cost
      b.lm             += s.costs.lm_cost
    }
  }

  const weekly = Array.from(weekMap.values()).sort((a, b) => a.week.localeCompare(b.week))

  // Node distribution
  const distribution = [
    { node: 'Pickup',          key: 'pickup' },
    { node: 'First Mile',      key: 'fm' },
    { node: 'Hub',             key: 'hub' },
    { node: 'Origin Customs',  key: 'oc' },
    { node: 'Middle Mile',     key: 'mm' },
    { node: 'Dest. Handling',  key: 'dh' },
    { node: 'Dest. Clearance', key: 'dc_clearance' },
    { node: 'Drop-Off',        key: 'dropoff' },
    { node: 'Last Mile',       key: 'lm' },
  ].map(({ node, key }) => ({
    node,
    cost: shipments.reduce((a, s) => a + ((s.costs as Record<string, number> | null)?.[`${key}_cost`] ?? 0), 0),
  }))

  // Top 10
  const top10 = [...shipments]
    .sort((a, b) => (b.costs?.total_cost ?? 0) - (a.costs?.total_cost ?? 0))
    .slice(0, 10)
    .map(s => ({
      awb:         s.awb,
      pickup_date: s.pickup_date,
      hub_name:    s.hub_name,
      lm_carrier:  s.lm_carrier,
      gross_weight:s.gross_weight,
      total_cost:  s.costs?.total_cost ?? 0,
    }))

  // Source breakdown
  const sourceMap: Record<string, number> = {}
  for (const s of shipments) {
    if (!s.costs) continue
    for (const src of [
      s.costs.pickup_source, s.costs.fm_source, s.costs.hub_source,
      s.costs.oc_source, s.costs.mm_source, s.costs.dh_source,
      s.costs.dc_clearance_source, s.costs.dropoff_source, s.costs.lm_source,
    ]) {
      sourceMap[src] = (sourceMap[src] ?? 0) + 1
    }
  }

  // Hub breakdown
  const hubMap: Record<string, number> = {}
  for (const s of shipments) {
    hubMap[s.hub_name] = (hubMap[s.hub_name] ?? 0) + (s.costs?.total_cost ?? 0)
  }

  return NextResponse.json({
    kpis: {
      totalCost,
      totalWeight,
      count,
      avgCostPerShipment: count ? totalCost / count : 0,
      avgCostPerKg:       totalWeight ? totalCost / totalWeight : 0,
      weekCount:          weekMap.size,
    },
    weekly,
    distribution,
    top10,
    sourceBreakdown: sourceMap,
    hubBreakdown:    Object.entries(hubMap).map(([hub, cost]) => ({ hub, cost })).sort((a, b) => b.cost - a.cost),
  })
}
