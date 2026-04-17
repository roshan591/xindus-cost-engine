import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gte, lt, or } from 'drizzle-orm'
import { db } from '@/db'
import { holidays } from '@/db/schema'

export async function GET(req: NextRequest) {
  const hub  = req.nextUrl.searchParams.get('hub')
  const year = parseInt(req.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()))
  const start = new Date(year, 0, 1)
  const end   = new Date(year + 1, 0, 1)

  const rows = await db.query.holidays.findMany({
    where: (t, { and, gte, lt, or, eq }) => and(
      gte(t.date, start),
      lt(t.date, end),
      hub ? or(eq(t.hub_name, hub), eq(t.hub_name, 'ALL')) : undefined
    ),
    orderBy: (t, { asc }) => [asc(t.date)],
  })
  return NextResponse.json({ holidays: rows, count: rows.length })
}

export async function POST(req: NextRequest) {
  const body   = await req.json()
  const inputs = Array.isArray(body) ? body : [body]
  let count = 0
  await db.transaction(async (tx) => {
    for (const h of inputs as { date: string; hub_name?: string; reason?: string }[]) {
      await tx.insert(holidays)
        .values({ date: new Date(h.date), hub_name: h.hub_name ?? 'ALL', reason: h.reason ?? null })
        .onConflictDoUpdate({
          target: [holidays.date, holidays.hub_name],
          set: { reason: h.reason ?? null },
        })
      count++
    }
  })
  return NextResponse.json({ created: count })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.delete(holidays).where(eq(holidays.id, id))
  return NextResponse.json({ deleted: true })
}
