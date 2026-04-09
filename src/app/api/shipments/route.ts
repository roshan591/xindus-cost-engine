import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const week  = searchParams.get('week')
  const month = searchParams.get('month')
  const hub   = searchParams.get('hub')
  const carrier = searchParams.get('carrier')
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200'), 500)

  const where: Record<string, unknown> = {}
  if (hub)     where.hub_name   = hub
  if (carrier) where.lm_carrier = carrier

  if (week) {
    const [y, w] = week.split('-W').map(Number)
    const jan1 = new Date(y, 0, 1)
    const start = new Date(jan1); start.setDate(jan1.getDate() + (w - 1) * 7)
    const end   = new Date(start); end.setDate(start.getDate() + 7)
    where.pickup_date = { gte: start, lt: end }
  } else if (month) {
    const [y, m] = month.split('-').map(Number)
    where.pickup_date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) }
  }

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: { costs: true },
      orderBy: { pickup_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.shipment.count({ where }),
  ])

  return NextResponse.json({ shipments, total, page, limit })
}

const ShipSchema = z.object({
  awb:                   z.string().min(1),
  pickup_date:           z.string(),
  service_node:          z.string(),
  hub_name:              z.string(),
  pc_to_hub:             z.string().optional(),
  pc_to_hub_created_on:  z.string().optional(),
  pc_to_hub_flight_no:   z.string().optional(),
  mawb:                  z.string().optional(),
  mawb_date:             z.string().optional(),
  port_of_origin:        z.string().optional(),
  clearance_type_oc:     z.string().optional(),
  oc_vendor:             z.string().optional(),
  dest_clearance_type:   z.string().optional(),
  service_type:          z.string().optional(),
  point_of_entry:        z.string().optional(),
  injection_port:        z.string().optional(),
  dc_partner:            z.string().optional(),
  country:               z.string().optional(),
  pkg_type:              z.enum(['box', 'flyer']),
  n_packages:            z.number().int().min(1),
  length_cm:             z.number().positive(),
  width_cm:              z.number().positive(),
  height_cm:             z.number().positive(),
  gross_weight:          z.number().positive(),
  line_items:            z.number().int().min(1).default(1),
  lm_carrier:            z.string().optional(),
  lm_shipping_method:    z.string().optional(),
  dest_zip:              z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const inputs = Array.isArray(body) ? body : [body]
    const validated = inputs.map(i => ShipSchema.parse(i))

    const toDb = (data: z.infer<typeof ShipSchema>) => ({
      awb:                  data.awb,
      pickup_date:          new Date(data.pickup_date),
      service_node:         data.service_node,
      hub_name:             data.hub_name,
      pc_to_hub:            data.pc_to_hub,
      pc_to_hub_created_on: data.pc_to_hub_created_on ? new Date(data.pc_to_hub_created_on) : undefined,
      pc_to_hub_flight_no:  data.pc_to_hub_flight_no,
      mawb:                 data.mawb,
      mawb_date:            data.mawb_date ? new Date(data.mawb_date) : undefined,
      port_of_origin:       data.port_of_origin,
      clearance_type_oc:    data.clearance_type_oc,
      oc_vendor:            data.oc_vendor,
      dest_clearance_type:  data.dest_clearance_type,
      service_type:         data.service_type,
      point_of_entry:       data.point_of_entry,
      injection_port:       data.injection_port,
      dc_partner:           data.dc_partner,
      country:              data.country,
      pkg_type:             data.pkg_type,
      n_packages:           data.n_packages,
      length_cm:            data.length_cm,
      width_cm:             data.width_cm,
      height_cm:            data.height_cm,
      gross_weight:         data.gross_weight,
      line_items:           data.line_items,
      lm_carrier:           data.lm_carrier,
      lm_shipping_method:   data.lm_shipping_method,
      dest_zip:             data.dest_zip,
    })

    const created = await prisma.$transaction(
      validated.map(data =>
        prisma.shipment.upsert({
          where:  { awb: data.awb },
          create: toDb(data),
          update: toDb(data),
        })
      )
    )

    return NextResponse.json({ created: created.length, awbs: created.map(s => s.awb) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
