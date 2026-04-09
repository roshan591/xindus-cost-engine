import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const hub = req.nextUrl.searchParams.get('hub')
  const year = parseInt(req.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()))
  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lt: end }, ...(hub ? { hub_name: { in: [hub, 'ALL'] } } : {}) },
    orderBy: { date: 'asc' },
  })
  return NextResponse.json({ holidays, count: holidays.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const inputs = Array.isArray(body) ? body : [body]
  const created = await prisma.$transaction(inputs.map((h: { date: string; hub_name?: string; reason?: string }) =>
    prisma.holiday.upsert({
      where: { date_hub_name: { date: new Date(h.date), hub_name: h.hub_name ?? 'ALL' } },
      create: { date: new Date(h.date), hub_name: h.hub_name ?? 'ALL', reason: h.reason },
      update: { reason: h.reason },
    })
  ))
  return NextResponse.json({ created: created.length })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.holiday.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
