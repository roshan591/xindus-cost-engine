import { NextRequest, NextResponse } from 'next/server'
import { eq, asc, desc } from 'drizzle-orm'
import { db } from '@/db'
import {
  pickupCostMasters, pickupAvgMasters,
  fmMasters, fmAvgMasters,
  hubCostMasters, holidays,
  ocMasters, ocAvgMasters,
  mmMasters, mmAvgMasters,
  dhMasters, dhAvgMasters,
  dcClearanceMasters, dcClearanceAvgMasters,
  dropoffMasters, dropoffAvgMasters,
  lmCarrierConfigs, lmZoneMappings, lmRateCards,
  lmDasMasters, lmSurchargeMasters, lmAvgMasters,
} from '@/db/schema'

const d = (s: string) => new Date(s)
function err(e: unknown) {
  const detail = e instanceof Error
    ? { name: e.constructor.name, message: e.message, code: (e as any).code, detail: (e as any).detail, stack: e.stack?.slice(0, 300) }
    : String(e)
  console.error('[master-api-error]', JSON.stringify(detail))
  return NextResponse.json({ error: detail }, { status: 500 })
}

// ── 5.1 PICKUP ────────────────────────────────────────────────────────────────
export async function GET_pickup() {
  try {
    const [masters, avg] = await Promise.all([
      db.select().from(pickupCostMasters).orderBy(asc(pickupCostMasters.pickup_node), desc(pickupCostMasters.start_date)),
      db.select().from(pickupAvgMasters).orderBy(desc(pickupAvgMasters.start_date)),
    ])
    return NextResponse.json({ masters, avg })
  } catch (e) { return err(e) }
}
export async function POST_pickup(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.insert(pickupAvgMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.insert(pickupCostMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function PUT_pickup(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.update(pickupAvgMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(pickupAvgMasters.id, id)).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.update(pickupCostMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(pickupCostMasters.id, id)).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function DELETE_pickup(req: NextRequest) {
  const { id } = await req.json()
  await db.delete(pickupCostMasters).where(eq(pickupCostMasters.id, id))
  return NextResponse.json({ success: true })
}

// ── 5.2 FIRST MILE ───────────────────────────────────────────────────────────
export async function GET_fm() {
  try {
    const [masters, avg] = await Promise.all([
      db.select().from(fmMasters).orderBy(asc(fmMasters.origin_node), desc(fmMasters.start_date)),
      db.select().from(fmAvgMasters).orderBy(desc(fmAvgMasters.start_date)),
    ])
    return NextResponse.json({ masters, avg })
  } catch (e) { return err(e) }
}
export async function POST_fm(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.insert(fmAvgMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.insert(fmMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function PUT_fm(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.update(fmAvgMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(fmAvgMasters.id, id)).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.update(fmMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(fmMasters.id, id)).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function DELETE_fm(req: NextRequest) {
  const { id } = await req.json()
  await db.delete(fmMasters).where(eq(fmMasters.id, id))
  return NextResponse.json({ success: true })
}

// ── 5.3 HUB ──────────────────────────────────────────────────────────────────
export async function GET_hub() {
  try {
    const [masters, holidayRows] = await Promise.all([
      db.select().from(hubCostMasters).orderBy(asc(hubCostMasters.hub_name), desc(hubCostMasters.start_date)),
      db.select().from(holidays).orderBy(desc(holidays.date)),
    ])
    return NextResponse.json({ masters, holidays: holidayRows })
  } catch (e) { return err(e) }
}
export async function POST_hub(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'holiday') {
      const [row] = await db.insert(holidays).values({ ...data, date: d(data.date) }).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.insert(hubCostMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function PUT_hub(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'holiday') {
      const [row] = await db.update(holidays).set({ ...data, date: d(data.date) }).where(eq(holidays.id, id)).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.update(hubCostMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(hubCostMasters.id, id)).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function DELETE_hub(req: NextRequest) {
  const { type, id } = await req.json()
  if (type === 'holiday') { await db.delete(holidays).where(eq(holidays.id, id)); return NextResponse.json({ success: true }) }
  await db.delete(hubCostMasters).where(eq(hubCostMasters.id, id))
  return NextResponse.json({ success: true })
}

// ── 5.4 OC ───────────────────────────────────────────────────────────────────
export async function GET_oc() {
  try {
    const [masters, avg] = await Promise.all([
      db.select().from(ocMasters).orderBy(asc(ocMasters.vendor_name), asc(ocMasters.charge_type)),
      db.select().from(ocAvgMasters),
    ])
    return NextResponse.json({ masters, avg })
  } catch (e) { return err(e) }
}
export async function POST_oc(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.insert(ocAvgMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.insert(ocMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function PUT_oc(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.update(ocAvgMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(ocAvgMasters.id, id)).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.update(ocMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(ocMasters.id, id)).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function DELETE_oc(req: NextRequest) {
  const { id } = await req.json()
  await db.delete(ocMasters).where(eq(ocMasters.id, id))
  return NextResponse.json({ success: true })
}

// ── 5.5 MM ───────────────────────────────────────────────────────────────────
export async function GET_mm() {
  try {
    const [masters, avg] = await Promise.all([
      db.select().from(mmMasters).orderBy(asc(mmMasters.origin_port), desc(mmMasters.start_date)),
      db.select().from(mmAvgMasters).orderBy(desc(mmAvgMasters.start_date)),
    ])
    return NextResponse.json({ masters, avg })
  } catch (e) { return err(e) }
}
export async function POST_mm(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.insert(mmAvgMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.insert(mmMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function PUT_mm(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.update(mmAvgMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(mmAvgMasters.id, id)).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.update(mmMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(mmMasters.id, id)).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function DELETE_mm(req: NextRequest) {
  const { id } = await req.json()
  await db.delete(mmMasters).where(eq(mmMasters.id, id))
  return NextResponse.json({ success: true })
}

// ── 5.6 DH ───────────────────────────────────────────────────────────────────
export async function GET_dh() {
  try {
    const [masters, avg] = await Promise.all([
      db.select().from(dhMasters).orderBy(asc(dhMasters.dc_partner), asc(dhMasters.cost_head_name)),
      db.select().from(dhAvgMasters),
    ])
    return NextResponse.json({ masters, avg })
  } catch (e) { return err(e) }
}
export async function POST_dh(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.insert(dhAvgMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.insert(dhMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function PUT_dh(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.update(dhAvgMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(dhAvgMasters.id, id)).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.update(dhMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(dhMasters.id, id)).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function DELETE_dh(req: NextRequest) {
  const { id } = await req.json()
  await db.delete(dhMasters).where(eq(dhMasters.id, id))
  return NextResponse.json({ success: true })
}

// ── 5.7 DC ───────────────────────────────────────────────────────────────────
export async function GET_dc() {
  try {
    const [masters, avg] = await Promise.all([
      db.select().from(dcClearanceMasters).orderBy(asc(dcClearanceMasters.country), asc(dcClearanceMasters.charge_type)),
      db.select().from(dcClearanceAvgMasters),
    ])
    return NextResponse.json({ masters, avg })
  } catch (e) { return err(e) }
}
export async function POST_dc(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.insert(dcClearanceAvgMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.insert(dcClearanceMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function PUT_dc(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.update(dcClearanceAvgMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(dcClearanceAvgMasters.id, id)).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.update(dcClearanceMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(dcClearanceMasters.id, id)).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function DELETE_dc(req: NextRequest) {
  const { id } = await req.json()
  await db.delete(dcClearanceMasters).where(eq(dcClearanceMasters.id, id))
  return NextResponse.json({ success: true })
}

// ── 5.8 DROPOFF ──────────────────────────────────────────────────────────────
export async function GET_dropoff() {
  try {
    const [masters, avg] = await Promise.all([
      db.select().from(dropoffMasters).orderBy(asc(dropoffMasters.country), asc(dropoffMasters.partner)),
      db.select().from(dropoffAvgMasters),
    ])
    return NextResponse.json({ masters, avg })
  } catch (e) { return err(e) }
}
export async function POST_dropoff(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.insert(dropoffAvgMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.insert(dropoffMasters).values({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function PUT_dropoff(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    if (type === 'avg') {
      const [row] = await db.update(dropoffAvgMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(dropoffAvgMasters.id, id)).returning()
      return NextResponse.json(row)
    }
    const [row] = await db.update(dropoffMasters).set({ ...data, start_date: d(data.start_date), end_date: d(data.end_date) }).where(eq(dropoffMasters.id, id)).returning()
    return NextResponse.json(row)
  } catch (e) { return err(e) }
}
export async function DELETE_dropoff(req: NextRequest) {
  const { id } = await req.json()
  await db.delete(dropoffMasters).where(eq(dropoffMasters.id, id))
  return NextResponse.json({ success: true })
}

// ── 5.9 LM ───────────────────────────────────────────────────────────────────
export async function GET_lm() {
  try {
    const [configs, zones, rates, das, surcharges, avg] = await Promise.all([
      db.select().from(lmCarrierConfigs).orderBy(asc(lmCarrierConfigs.carrier_name)),
      db.select().from(lmZoneMappings).orderBy(asc(lmZoneMappings.carrier_name), asc(lmZoneMappings.destination_key)),
      db.select().from(lmRateCards).orderBy(asc(lmRateCards.carrier_name), asc(lmRateCards.zone), asc(lmRateCards.unit_value)),
      db.select().from(lmDasMasters).orderBy(asc(lmDasMasters.carrier_name), asc(lmDasMasters.zipcode)),
      db.select().from(lmSurchargeMasters).orderBy(asc(lmSurchargeMasters.carrier_name)),
      db.select().from(lmAvgMasters),
    ])
    return NextResponse.json({ configs, zones, rates, das, surcharges, avg })
  } catch (e) { return err(e) }
}
export async function POST_lm(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    const df = (s: string) => new Date(s)
    switch (type) {
      case 'config': {
        const [row] = await db.insert(lmCarrierConfigs).values({ ...data, start_date: df(data.start_date), end_date: df(data.end_date) }).returning()
        return NextResponse.json(row)
      }
      case 'zone':
        if (Array.isArray(data)) {
          await db.insert(lmZoneMappings).values(data.map((r: any) => ({ ...r, start_date: df(r.start_date), end_date: df(r.end_date) }))).onConflictDoNothing()
          return NextResponse.json({ created: data.length })
        } else {
          const [row] = await db.insert(lmZoneMappings).values({ ...data, start_date: df(data.start_date), end_date: df(data.end_date) }).returning()
          return NextResponse.json(row)
        }
      case 'rate':
        if (Array.isArray(data)) {
          await db.insert(lmRateCards).values(data.map((r: any) => ({ ...r, start_date: df(r.start_date), end_date: df(r.end_date), unit_value: Number(r.unit_value), rate: Number(r.rate) }))).onConflictDoNothing()
          return NextResponse.json({ created: data.length })
        } else {
          const [row] = await db.insert(lmRateCards).values({ ...data, start_date: df(data.start_date), end_date: df(data.end_date) }).returning()
          return NextResponse.json(row)
        }
      case 'das':
        if (Array.isArray(data)) {
          await db.insert(lmDasMasters).values(data.map((r: any) => ({ ...r, start_date: df(r.start_date), end_date: df(r.end_date), surcharge_amount: Number(r.surcharge_amount) }))).onConflictDoNothing()
          return NextResponse.json({ created: data.length })
        } else {
          const [row] = await db.insert(lmDasMasters).values({ ...data, start_date: df(data.start_date), end_date: df(data.end_date) }).returning()
          return NextResponse.json(row)
        }
      case 'surcharge': {
        const [row] = await db.insert(lmSurchargeMasters).values({ ...data, start_date: df(data.start_date), end_date: df(data.end_date) }).returning()
        return NextResponse.json(row)
      }
      case 'avg': {
        const [row] = await db.insert(lmAvgMasters).values({ ...data, start_date: df(data.start_date), end_date: df(data.end_date) }).returning()
        return NextResponse.json(row)
      }
      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
  } catch (e) { return err(e) }
}
export async function PUT_lm(req: NextRequest) {
  try {
    const { type, id, data } = await req.json()
    const df = (s: string) => new Date(s)
    switch (type) {
      case 'config': {
        const [row] = await db.update(lmCarrierConfigs).set({ ...data, start_date: df(data.start_date), end_date: df(data.end_date) }).where(eq(lmCarrierConfigs.id, id)).returning()
        return NextResponse.json(row)
      }
      case 'rate': {
        const [row] = await db.update(lmRateCards).set({ ...data, start_date: df(data.start_date), end_date: df(data.end_date) }).where(eq(lmRateCards.id, id)).returning()
        return NextResponse.json(row)
      }
      case 'das': {
        const [row] = await db.update(lmDasMasters).set({ ...data, start_date: df(data.start_date), end_date: df(data.end_date) }).where(eq(lmDasMasters.id, id)).returning()
        return NextResponse.json(row)
      }
      default:
        return NextResponse.json({ error: 'Cannot update' }, { status: 400 })
    }
  } catch (e) { return err(e) }
}
export async function DELETE_lm(req: NextRequest) {
  const { type, id } = await req.json()
  switch (type) {
    case 'config':    await db.delete(lmCarrierConfigs).where(eq(lmCarrierConfigs.id, id)); break
    case 'zone':      await db.delete(lmZoneMappings).where(eq(lmZoneMappings.id, id)); break
    case 'rate':      await db.delete(lmRateCards).where(eq(lmRateCards.id, id)); break
    case 'das':       await db.delete(lmDasMasters).where(eq(lmDasMasters.id, id)); break
    case 'surcharge': await db.delete(lmSurchargeMasters).where(eq(lmSurchargeMasters.id, id)); break
    case 'avg':       await db.delete(lmAvgMasters).where(eq(lmAvgMasters.id, id)); break
    default:          return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
