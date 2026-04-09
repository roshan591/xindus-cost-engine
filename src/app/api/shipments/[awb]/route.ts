import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { awb: string } }) {
  const shipment = await prisma.shipment.findUnique({
    where: { awb: params.awb },
    include: { costs: true, overrides: { orderBy: { updated_at: 'desc' } } },
  })
  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const c = shipment.costs
  const nodeCosts = c ? {
    pickup:       { cost: c.pickup_cost,       source: c.pickup_source       },
    fm:           { cost: c.fm_cost,           source: c.fm_source           },
    hub:          { cost: c.hub_cost,          source: c.hub_source          },
    oc:           { cost: c.oc_cost,           source: c.oc_source           },
    mm:           { cost: c.mm_cost,           source: c.mm_source           },
    dh:           { cost: c.dh_cost,           source: c.dh_source           },
    dc_clearance: { cost: c.dc_clearance_cost, source: c.dc_clearance_source },
    dropoff:      { cost: c.dropoff_cost,      source: c.dropoff_source      },
    lm:           { cost: c.lm_cost,           source: c.lm_source           },
    total:        c.total_cost,
    cost_per_kg:  shipment.gross_weight ? c.total_cost / shipment.gross_weight : 0,
    computed_at:  c.computed_at,
  } : null
  return NextResponse.json({ shipment, nodeCosts })
}

export async function DELETE(_req: NextRequest, { params }: { params: { awb: string } }) {
  await prisma.shipment.delete({ where: { awb: params.awb } })
  return NextResponse.json({ deleted: true, awb: params.awb })
}
