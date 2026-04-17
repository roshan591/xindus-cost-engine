import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { shipments } from '@/db/schema'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const week    = searchParams.get('week')
    const month   = searchParams.get('month')
    const hub     = searchParams.get('hub')
    const carrier = searchParams.get('carrier')
    const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit   = Math.min(parseInt(searchParams.get('limit') ?? '200'), 500)

    const filters = []
    if (hub)     filters.push(eq(shipments.hub_name, hub))
    if (carrier) filters.push(eq(shipments.lm_carrier, carrier))

    if (week) {
      const [y, w] = week.split('-W').map(Number)
      const jan1  = new Date(y, 0, 1)
      const start = new Date(jan1); start.setDate(jan1.getDate() + (w - 1) * 7)
      const end   = new Date(start); end.setDate(start.getDate() + 7)
      filters.push(gte(shipments.pickup_date, start), lt(shipments.pickup_date, end))
    } else if (month) {
      const [y, m] = month.split('-').map(Number)
      filters.push(
        gte(shipments.pickup_date, new Date(y, m - 1, 1)),
        lt(shipments.pickup_date, new Date(y, m, 1))
      )
    }

    const where = filters.length > 0 ? and(...filters) : undefined

    const [rows, [{ count }]] = await Promise.all([
      db.query.shipments.findMany({
        where: where ? () => where : undefined,
        with: { costs: true },
        orderBy: (t, { desc }) => [desc(t.pickup_date)],
        offset: (page - 1) * limit,
        limit,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(shipments)
        .where(where),
    ])

    return NextResponse.json({ shipments: rows, total: count, page, limit })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load shipments', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
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
    const body     = await req.json()
    const inputs   = Array.isArray(body) ? body : [body]
    const validated = inputs.map(i => ShipSchema.parse(i))

    const toRow = (data: z.infer<typeof ShipSchema>) => ({
      awb:                  data.awb,
      pickup_date:          new Date(data.pickup_date),
      service_node:         data.service_node,
      hub_name:             data.hub_name,
      pc_to_hub:            data.pc_to_hub ?? null,
      pc_to_hub_created_on: data.pc_to_hub_created_on ? new Date(data.pc_to_hub_created_on) : null,
      pc_to_hub_flight_no:  data.pc_to_hub_flight_no ?? null,
      mawb:                 data.mawb ?? null,
      mawb_date:            data.mawb_date ? new Date(data.mawb_date) : null,
      port_of_origin:       data.port_of_origin ?? null,
      clearance_type_oc:    data.clearance_type_oc ?? null,
      oc_vendor:            data.oc_vendor ?? null,
      dest_clearance_type:  data.dest_clearance_type ?? null,
      service_type:         data.service_type ?? null,
      point_of_entry:       data.point_of_entry ?? null,
      injection_port:       data.injection_port ?? null,
      dc_partner:           data.dc_partner ?? null,
      country:              data.country ?? null,
      pkg_type:             data.pkg_type,
      n_packages:           data.n_packages,
      length_cm:            data.length_cm,
      width_cm:             data.width_cm,
      height_cm:            data.height_cm,
      gross_weight:         data.gross_weight,
      line_items:           data.line_items,
      lm_carrier:           data.lm_carrier ?? null,
      lm_shipping_method:   data.lm_shipping_method ?? null,
      dest_zip:             data.dest_zip ?? null,
    })

    const BATCH = 50
    for (let i = 0; i < validated.length; i += BATCH) {
      const batch = validated.slice(i, i + BATCH)
      await db.transaction(async (tx) => {
        for (const data of batch) {
          const row = toRow(data)
          await tx.insert(shipments).values(row).onConflictDoUpdate({
            target: shipments.awb,
            set: { ...row, updated_at: new Date() },
          })
        }
      })
    }

    const created = await db.query.shipments.findMany({
      where: (t, { inArray }) => inArray(t.awb, validated.map(v => v.awb)),
    })

    return NextResponse.json({ created: created.length, awbs: created.map(s => s.awb) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
