import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const d = (s: string) => new Date(s)
function err(e: unknown) { return NextResponse.json({ error: String(e) }, { status: 500 }) }

// ── 5.1 PICKUP ────────────────────────────────────────────────────────────────
export async function GET_pickup() {
  const [masters, avg] = await Promise.all([
    prisma.pickupCostMaster.findMany({ orderBy: [{ pickup_node: 'asc' }, { start_date: 'desc' }] }),
    prisma.pickupAvgMaster.findMany({ orderBy: { start_date: 'desc' } }),
  ])
  return NextResponse.json({ masters, avg })
}
export async function POST_pickup(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.pickupAvgMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
    return NextResponse.json(await prisma.pickupCostMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function PUT_pickup(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.pickupAvgMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
    return NextResponse.json(await prisma.pickupCostMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function DELETE_pickup(req: NextRequest) {
  const { id } = await req.json()
  await prisma.pickupCostMaster.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

// ── 5.2 FIRST MILE ───────────────────────────────────────────────────────────
export async function GET_fm() {
  const [masters, avg] = await Promise.all([
    prisma.fmMaster.findMany({ orderBy: [{ origin_node: 'asc' }, { start_date: 'desc' }] }),
    prisma.fmAvgMaster.findMany({ orderBy: { start_date: 'desc' } }),
  ])
  return NextResponse.json({ masters, avg })
}
export async function POST_fm(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.fmAvgMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
    return NextResponse.json(await prisma.fmMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function PUT_fm(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.fmAvgMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
    return NextResponse.json(await prisma.fmMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function DELETE_fm(req: NextRequest) {
  const { id } = await req.json(); await prisma.fmMaster.delete({ where: { id } }); return NextResponse.json({ success: true })
}

// ── 5.3 HUB ──────────────────────────────────────────────────────────────────
export async function GET_hub() {
  const [masters, holidays] = await Promise.all([
    prisma.hubCostMaster.findMany({ orderBy: [{ hub_name: 'asc' }, { start_date: 'desc' }] }),
    prisma.holiday.findMany({ orderBy: { date: 'desc' } }),
  ])
  return NextResponse.json({ masters, holidays })
}
export async function POST_hub(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'holiday') return NextResponse.json(await prisma.holiday.create({ data: { ...data, date: d(data.date) } }))
    return NextResponse.json(await prisma.hubCostMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function PUT_hub(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'holiday') return NextResponse.json(await prisma.holiday.update({ where: { id }, data: { ...data, date: d(data.date) } }))
    return NextResponse.json(await prisma.hubCostMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function DELETE_hub(req: NextRequest) {
  const { type, id } = await req.json()
  if (type === 'holiday') { await prisma.holiday.delete({ where: { id } }); return NextResponse.json({ success: true }) }
  await prisma.hubCostMaster.delete({ where: { id } }); return NextResponse.json({ success: true })
}

// ── 5.4 OC ───────────────────────────────────────────────────────────────────
export async function GET_oc() {
  const [masters, avg] = await Promise.all([
    prisma.ocMaster.findMany({ orderBy: [{ vendor_name: 'asc' }, { charge_type: 'asc' }] }),
    prisma.ocAvgMaster.findMany(),
  ])
  return NextResponse.json({ masters, avg })
}
export async function POST_oc(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.ocAvgMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
    return NextResponse.json(await prisma.ocMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function PUT_oc(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.ocAvgMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
    return NextResponse.json(await prisma.ocMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function DELETE_oc(req: NextRequest) {
  const { id } = await req.json(); await prisma.ocMaster.delete({ where: { id } }); return NextResponse.json({ success: true })
}

// ── 5.5 MM ───────────────────────────────────────────────────────────────────
export async function GET_mm() {
  const [masters, avg] = await Promise.all([
    prisma.mmMaster.findMany({ orderBy: [{ origin_port: 'asc' }, { start_date: 'desc' }] }),
    prisma.mmAvgMaster.findMany({ orderBy: { start_date: 'desc' } }),
  ])
  return NextResponse.json({ masters, avg })
}
export async function POST_mm(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.mmAvgMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
    return NextResponse.json(await prisma.mmMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function PUT_mm(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.mmAvgMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
    return NextResponse.json(await prisma.mmMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function DELETE_mm(req: NextRequest) {
  const { id } = await req.json(); await prisma.mmMaster.delete({ where: { id } }); return NextResponse.json({ success: true })
}

// ── 5.6 DH ───────────────────────────────────────────────────────────────────
export async function GET_dh() {
  const [masters, avg] = await Promise.all([
    prisma.dhMaster.findMany({ orderBy: [{ dc_partner: 'asc' }, { cost_head_name: 'asc' }] }),
    prisma.dhAvgMaster.findMany(),
  ])
  return NextResponse.json({ masters, avg })
}
export async function POST_dh(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.dhAvgMaster.create({ data }))
    return NextResponse.json(await prisma.dhMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function PUT_dh(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.dhAvgMaster.update({ where: { id }, data }))
    return NextResponse.json(await prisma.dhMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function DELETE_dh(req: NextRequest) {
  const { id } = await req.json(); await prisma.dhMaster.delete({ where: { id } }); return NextResponse.json({ success: true })
}

// ── 5.7 DC ───────────────────────────────────────────────────────────────────
export async function GET_dc() {
  const [masters, avg] = await Promise.all([
    prisma.dcClearanceMaster.findMany({ orderBy: [{ country: 'asc' }, { charge_type: 'asc' }] }),
    prisma.dcClearanceAvgMaster.findMany(),
  ])
  return NextResponse.json({ masters, avg })
}
export async function POST_dc(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.dcClearanceAvgMaster.create({ data }))
    return NextResponse.json(await prisma.dcClearanceMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function PUT_dc(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.dcClearanceAvgMaster.update({ where: { id }, data }))
    return NextResponse.json(await prisma.dcClearanceMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function DELETE_dc(req: NextRequest) {
  const { id } = await req.json(); await prisma.dcClearanceMaster.delete({ where: { id } }); return NextResponse.json({ success: true })
}

// ── 5.8 DROPOFF ───────────────────────────────────────────────────────────────
export async function GET_dropoff() {
  const [masters, avg] = await Promise.all([
    prisma.dropoffMaster.findMany({ orderBy: [{ country: 'asc' }, { partner: 'asc' }] }),
    prisma.dropoffAvgMaster.findMany(),
  ])
  return NextResponse.json({ masters, avg })
}
export async function POST_dropoff(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.dropoffAvgMaster.create({ data }))
    return NextResponse.json(await prisma.dropoffMaster.create({ data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function PUT_dropoff(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') return NextResponse.json(await prisma.dropoffAvgMaster.update({ where: { id }, data }))
    return NextResponse.json(await prisma.dropoffMaster.update({ where: { id }, data: { ...data, start_date: d(data.start_date), end_date: d(data.end_date) } }))
  } catch (e) { return err(e) }
}
export async function DELETE_dropoff(req: NextRequest) {
  const { id } = await req.json(); await prisma.dropoffMaster.delete({ where: { id } }); return NextResponse.json({ success: true })
}

// ── 5.9 LM ───────────────────────────────────────────────────────────────────
export async function GET_lm() {
  const [configs, zones, rates, das, surcharges, avg] = await Promise.all([
    prisma.lmCarrierConfig.findMany({ orderBy: [{ carrier_name: 'asc' }] }),
    prisma.lmZoneMapping.findMany({ orderBy: [{ carrier_name: 'asc' }, { destination_key: 'asc' }] }),
    prisma.lmRateCard.findMany({ orderBy: [{ carrier_name: 'asc' }, { zone: 'asc' }, { unit_value: 'asc' }] }),
    prisma.lmDasMaster.findMany({ orderBy: [{ carrier_name: 'asc' }, { zipcode: 'asc' }] }),
    prisma.lmSurchargeMaster.findMany({ orderBy: [{ carrier_name: 'asc' }] }),
    prisma.lmAvgMaster.findMany(),
  ])
  return NextResponse.json({ configs, zones, rates, das, surcharges, avg })
}
export async function POST_lm(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    const df = (s: string) => new Date(s)
    switch (type) {
      case 'config': return NextResponse.json(await prisma.lmCarrierConfig.create({ data: { ...data, start_date: df(data.start_date), end_date: df(data.end_date) } }))
      case 'zone':
        if (Array.isArray(data)) { await prisma.lmZoneMapping.createMany({ data: data.map((r: any) => ({ ...r, start_date: df(r.start_date), end_date: df(r.end_date) })), skipDuplicates: true }); return NextResponse.json({ created: data.length }) }
        return NextResponse.json(await prisma.lmZoneMapping.create({ data: { ...data, start_date: df(data.start_date), end_date: df(data.end_date) } }))
      case 'rate':
        if (Array.isArray(data)) { await prisma.lmRateCard.createMany({ data: data.map((r: any) => ({ ...r, start_date: df(r.start_date), end_date: df(r.end_date), unit_value: Number(r.unit_value), rate: Number(r.rate) })), skipDuplicates: true }); return NextResponse.json({ created: data.length }) }
        return NextResponse.json(await prisma.lmRateCard.create({ data: { ...data, start_date: df(data.start_date), end_date: df(data.end_date) } }))
      case 'das':
        if (Array.isArray(data)) { await prisma.lmDasMaster.createMany({ data: data.map((r: any) => ({ ...r, start_date: df(r.start_date), end_date: df(r.end_date), surcharge_amount: Number(r.surcharge_amount) })), skipDuplicates: true }); return NextResponse.json({ created: data.length }) }
        return NextResponse.json(await prisma.lmDasMaster.create({ data: { ...data, start_date: df(data.start_date), end_date: df(data.end_date) } }))
      case 'surcharge': return NextResponse.json(await prisma.lmSurchargeMaster.create({ data: { ...data, start_date: df(data.start_date), end_date: df(data.end_date) } }))
      case 'avg': return NextResponse.json(await prisma.lmAvgMaster.create({ data: { ...data, start_date: df(data.start_date), end_date: df(data.end_date) } }))
      default: return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
  } catch (e) { return err(e) }
}
export async function PUT_lm(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    const df = (s: string) => new Date(s)
    switch (type) {
      case 'config': return NextResponse.json(await prisma.lmCarrierConfig.update({ where: { id }, data: { ...data, start_date: df(data.start_date), end_date: df(data.end_date) } }))
      case 'rate':   return NextResponse.json(await prisma.lmRateCard.update({ where: { id }, data: { ...data, start_date: df(data.start_date), end_date: df(data.end_date) } }))
      case 'das':    return NextResponse.json(await prisma.lmDasMaster.update({ where: { id }, data: { ...data, start_date: df(data.start_date), end_date: df(data.end_date) } }))
      default: return NextResponse.json({ error: 'Cannot update' }, { status: 400 })
    }
  } catch (e) { return err(e) }
}
export async function DELETE_lm(req: NextRequest) {
  const { type, id } = await req.json()
  const modelMap: Record<string, string> = { config: 'lmCarrierConfig', zone: 'lmZoneMapping', rate: 'lmRateCard', das: 'lmDasMaster', surcharge: 'lmSurchargeMaster', avg: 'lmAvgMaster' }
  const model = modelMap[type]
  if (!model) return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  await (prisma as any)[model].delete({ where: { id } })
  return NextResponse.json({ success: true })
}
