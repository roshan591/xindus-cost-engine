import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { runCostEngine, loadEngineContext, persistCosts } from '@/engine'
import { ShipmentInput } from '@/types'

const OverrideSchema = z.object({
  node: z.enum(['pickup','fm','hub','oc','mm','dh','dc_clearance','dropoff','lm']),
  override_flag:   z.boolean(),
  override_cost:   z.number().min(0).optional(),
  override_reason: z.string().optional(),
  updated_by:      z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { awb: string } }) {
  const overrides = await prisma.costOverride.findMany({
    where: { awb: params.awb },
    orderBy: { updated_at: 'desc' },
  })
  return NextResponse.json({ overrides })
}

export async function PATCH(req: NextRequest, { params }: { params: { awb: string } }) {
  try {
    const body = await req.json()
    const { node, override_flag, override_cost, override_reason, updated_by } = OverrideSchema.parse(body)

    // Capture previous cost for audit trail
    const current = await prisma.shipmentCost.findUnique({ where: { awb: params.awb } })
    const prevCost = current ? (current as Record<string, unknown>)[`${node}_cost`] as number | null : null

    // Upsert override
    const existing = await prisma.costOverride.findFirst({ where: { awb: params.awb, node } })
    if (existing) {
      await prisma.costOverride.update({
        where: { id: existing.id },
        data: { override_flag, override_cost: override_cost ?? null, prev_cost: prevCost, override_reason: override_reason ?? null, updated_by: updated_by ?? null, updated_at: new Date() },
      })
    } else {
      await prisma.costOverride.create({
        data: { awb: params.awb, node, override_flag, override_cost: override_cost ?? null, prev_cost: prevCost, override_reason: override_reason ?? null, updated_by: updated_by ?? null },
      })
    }

    // Recompute this shipment immediately
    const s = await prisma.shipment.findUnique({ where: { awb: params.awb } })
    if (s) {
      const input: ShipmentInput = {
        awb: s.awb, pickup_date: s.pickup_date.toISOString(),
        service_node: s.service_node, hub_name: s.hub_name,
        pc_to_hub: s.pc_to_hub ?? undefined, pc_to_hub_created_on: s.pc_to_hub_created_on?.toISOString(),
        pc_to_hub_flight_no: s.pc_to_hub_flight_no ?? undefined,
        mawb: s.mawb ?? undefined, mawb_date: s.mawb_date?.toISOString(),
        port_of_origin: s.port_of_origin ?? undefined, clearance_type_oc: s.clearance_type_oc ?? undefined,
        oc_vendor: s.oc_vendor ?? undefined, dest_clearance_type: s.dest_clearance_type ?? undefined,
        service_type: s.service_type ?? undefined, point_of_entry: s.point_of_entry ?? undefined,
        injection_port: s.injection_port ?? undefined, dc_partner: s.dc_partner ?? undefined,
        country: s.country ?? undefined, pkg_type: s.pkg_type as 'box'|'flyer',
        n_packages: s.n_packages, length_cm: s.length_cm, width_cm: s.width_cm, height_cm: s.height_cm,
        gross_weight: s.gross_weight, line_items: s.line_items,
        lm_carrier: s.lm_carrier ?? undefined, lm_shipping_method: s.lm_shipping_method ?? undefined,
        dest_zip: s.dest_zip ?? undefined,
      }
      const ctx = await loadEngineContext([params.awb])
      const results = await runCostEngine([input], ctx)
      await persistCosts(results)
    }

    return NextResponse.json({ success: true, node, override_flag })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation', details: err.errors }, { status: 400 })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE — remove all overrides for a shipment+node
export async function DELETE(req: NextRequest, { params }: { params: { awb: string } }) {
  const { searchParams } = req.nextUrl
  const node = searchParams.get('node')
  await prisma.costOverride.deleteMany({
    where: { awb: params.awb, ...(node ? { node } : {}) },
  })
  return NextResponse.json({ success: true })
}
