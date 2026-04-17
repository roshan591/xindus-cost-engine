import { NextRequest, NextResponse } from 'next/server'
import { and, eq, lte, gte, desc } from 'drizzle-orm'
import { db } from '@/db'
import { shipments, pickupCostMasters, fmMasters } from '@/db/schema'
import { runCostEngine, loadEngineContext, persistCosts } from '@/engine'
import { ShipmentInput } from '@/types'
import * as XLSX from 'xlsx'

const COL_MAP: Record<string, keyof ShipmentInput> = {
  'awb': 'awb', 'name': 'awb', 'shipment no': 'awb', 'shipment number': 'awb',
  'pickup_date': 'pickup_date', 'pickup date': 'pickup_date', 'created_date': 'pickup_date',
  'pc_to_hub_crated_on': 'pc_to_hub_created_on', 'pc_to_hub_created_on': 'pc_to_hub_created_on',
  'manifest date': 'pc_to_hub_created_on', 'mm_created_date': 'mawb_date',
  'service_node': 'service_node', 'service node': 'service_node', 'shipper_city': 'service_node',
  'hub name': 'hub_name', 'hub_name': 'hub_name', 'hub': 'hub_name',
  'pc_to_hub': 'pc_to_hub', 'manifest no': 'pc_to_hub', 'manifest_no': 'pc_to_hub',
  'pc_to_hub_flight_no': 'pc_to_hub_flight_no', 'port_to_port_flightno': 'pc_to_hub_flight_no', 'flight no': 'pc_to_hub_flight_no',
  'fm_partner': 'service_node', 'fm_carrier': 'lm_carrier',
  'mawb': 'mawb', 'port_to_port_mm_new': 'mawb',
  'oc clearance type': 'clearance_type_oc', 'oc_clearance_type': 'clearance_type_oc',
  'final_type': 'clearance_type_oc', 'type': 'clearance_type_oc',
  'oc vendor': 'oc_vendor', 'oc_vendor': 'oc_vendor',
  'destination_clearance': 'dest_clearance_type', 'dest clearance type': 'dest_clearance_type', 'dest_clearance_type': 'dest_clearance_type',
  'point_of_entry': 'point_of_entry', 'point of entry': 'point_of_entry',
  'injection port': 'injection_port', 'injection_port': 'injection_port',
  'dc_partner': 'dc_partner',
  'reciever country': 'country', 'receiver country': 'country', 'country': 'country',
  'package type': 'pkg_type', 'pkg_type': 'pkg_type', 'package_type': 'pkg_type',
  'no of packages': 'n_packages', 'n_packages': 'n_packages', 'boxes': 'n_packages',
  'no_of_items': 'line_items', 'line_items': 'line_items', 'line items': 'line_items',
  'gross weight': 'gross_weight', 'gross_weight': 'gross_weight', 'net_weight': 'gross_weight',
  'length cm': 'length_cm', 'length_cm': 'length_cm', 'length': 'length_cm', 'length (cm)': 'length_cm',
  'breadth cm': 'width_cm', 'width_cm': 'width_cm', 'width': 'width_cm', 'width (cm)': 'width_cm',
  'height cm': 'height_cm', 'height_cm': 'height_cm', 'height': 'height_cm', 'height (cm)': 'height_cm',
  'lm_carrier': 'lm_carrier', 'lm carrier': 'lm_carrier', 'lmcarrier': 'lm_carrier', 'lm_carrier_new': 'lm_carrier',
  'carrier': 'lm_carrier', 'service': 'lm_carrier',
  'lmshippingmethod': 'lm_shipping_method', 'lm_shipping_method': 'lm_shipping_method', 'shipping method': 'lm_shipping_method', 'shippingmethod': 'lm_shipping_method',
  'dest zip': 'dest_zip', 'dest_zip': 'dest_zip',
  'reciever postal code': 'dest_zip', 'receiver postal code': 'dest_zip',
  'reciever_postal_code': 'dest_zip', 'receiver_postal_code': 'dest_zip', 'shipperzip': 'dest_zip',
}

function parseDate(val: unknown): string | undefined {
  if (!val) return undefined
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  if (!s) return undefined
  const parts = s.split(/[\/\-\.]/)
  if (parts.length === 3) {
    const [a, b, c] = parts
    if (c.length === 4) {
      const day = parseInt(a), month = parseInt(b), year = parseInt(c)
      if (month > 12) return new Date(year, day - 1, month).toISOString().slice(0, 10)
      return new Date(year, month - 1, day).toISOString().slice(0, 10)
    }
    if (a.length === 4) return new Date(parseInt(a), parseInt(b) - 1, parseInt(c)).toISOString().slice(0, 10)
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

interface BoxRow extends Record<string, unknown> { awb: string }

function aggregateBoxes(boxes: BoxRow[]): Record<string, unknown> {
  const first = (key: string) => boxes.map(b => b[key]).find(v => v != null && v !== '') ?? undefined
  const grossWeight = boxes.reduce((sum, b) => { const w = parseFloat(String(b.gross_weight ?? b.net_weight ?? 0)); return sum + (isNaN(w) ? 0 : w) }, 0)
  const maxDim = (key: string) => boxes.reduce((mx, b) => { const v = parseFloat(String(b[key] ?? 0)); return isNaN(v) ? mx : Math.max(mx, v) }, 0)
  const nPackages = boxes.reduce((sum, b) => { const v = parseInt(String(b.n_packages ?? 1)); return sum + (isNaN(v) ? 1 : v) }, 0) || boxes.length
  const lineItems = boxes.reduce((sum, b) => { const v = parseInt(String(b.line_items ?? 1)); return sum + (isNaN(v) ? 1 : v) }, 0) || boxes.length
  return {
    awb: first('awb'), pickup_date: first('pickup_date'), service_node: first('service_node'),
    hub_name: first('hub_name'), pc_to_hub: first('pc_to_hub'), pc_to_hub_created_on: first('pc_to_hub_created_on'),
    pc_to_hub_flight_no: first('pc_to_hub_flight_no'), mawb: first('mawb'), mawb_date: first('mawb_date'),
    port_of_origin: first('port_of_origin'), clearance_type_oc: first('clearance_type_oc'),
    oc_vendor: first('oc_vendor'), dest_clearance_type: first('dest_clearance_type'),
    service_type: first('service_type'), point_of_entry: first('point_of_entry'),
    injection_port: first('injection_port'), dc_partner: first('dc_partner'), country: first('country'),
    pkg_type: first('pkg_type'), lm_carrier: first('lm_carrier'), lm_shipping_method: first('lm_shipping_method'),
    dest_zip: first('dest_zip'), gross_weight: grossWeight,
    length_cm: maxDim('length_cm'), width_cm: maxDim('width_cm'), height_cm: maxDim('height_cm'),
    n_packages: nPackages, line_items: lineItems,
  }
}

async function deriveHubName(serviceNode: string, pickupDate: string, cache: Map<string, string>): Promise<string | undefined> {
  if (cache.has(serviceNode)) return cache.get(serviceNode)
  const pd = new Date(pickupDate)

  const [pickupMaster] = await db.select().from(pickupCostMasters)
    .where(and(eq(pickupCostMasters.pickup_node, serviceNode), lte(pickupCostMasters.start_date, pd), gte(pickupCostMasters.end_date, pd)))
    .orderBy(desc(pickupCostMasters.start_date))
    .limit(1)

  if (pickupMaster?.delivery_node) {
    cache.set(serviceNode, pickupMaster.delivery_node)
    return pickupMaster.delivery_node
  }

  const [fm] = await db.select().from(fmMasters)
    .where(eq(fmMasters.origin_node, serviceNode))
    .orderBy(desc(fmMasters.start_date))
    .limit(1)

  if (fm?.delivery_node) {
    cache.set(serviceNode, fm.delivery_node)
    return fm.delivery_node
  }
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer  = Buffer.from(await file.arrayBuffer())
    const wb      = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheet   = wb.Sheets[wb.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false })
    if (!rawRows.length) return NextResponse.json({ error: 'Empty file' }, { status: 400 })

    const mappedRows: BoxRow[] = rawRows.map(row => {
      const out: Record<string, unknown> = {}
      for (const [col, val] of Object.entries(row)) {
        const norm = col.toLowerCase().trim().replace(/\s+/g, ' ').replace(/_\d+$/, '')
        const key  = COL_MAP[norm]
        if (key && out[key] == null) out[key] = val
      }
      return out as BoxRow
    })

    const withAwb = mappedRows.filter(r => r.awb && String(r.awb).trim() !== '')
    if (!withAwb.length) return NextResponse.json({ error: "No rows with 'awb' / 'name' column found." }, { status: 400 })

    const awbGroups = new Map<string, BoxRow[]>()
    for (const row of withAwb) {
      const awb = String(row.awb).trim().toUpperCase()
      if (!awbGroups.has(awb)) awbGroups.set(awb, [])
      awbGroups.get(awb)!.push({ ...row, awb })
    }

    const totalBoxRows    = withAwb.length
    const totalShipments  = awbGroups.size
    const hubCache        = new Map<string, string>()
    const errors: string[] = []
    const inputs: ShipmentInput[] = []

    for (const [awb, boxes] of awbGroups) {
      const agg       = aggregateBoxes(boxes)
      const pickupDate = parseDate(agg.pickup_date)
      if (!pickupDate) { errors.push(`AWB ${awb}: could not parse pickup_date — skipped`); continue }

      const serviceNode = agg.service_node ? String(agg.service_node).trim() : undefined
      if (!serviceNode) { errors.push(`AWB ${awb}: missing service_node — skipped`); continue }

      let hubName = agg.hub_name ? String(agg.hub_name).trim() : undefined
      if (!hubName) {
        hubName = await deriveHubName(serviceNode, pickupDate, hubCache)
        if (!hubName) { errors.push(`AWB ${awb}: no hub_name — defaulting to service_node`); hubName = serviceNode }
      }

      const grossWeight = typeof agg.gross_weight === 'number' ? agg.gross_weight : parseFloat(String(agg.gross_weight ?? 0))
      if (!grossWeight || isNaN(grossWeight)) { errors.push(`AWB ${awb}: gross_weight missing — skipped`); continue }

      const pkgTypeRaw = String(agg.pkg_type ?? '').toLowerCase()
      const pkgType: 'box' | 'flyer' = pkgTypeRaw.includes('flyer') || pkgTypeRaw.includes('poly') ? 'flyer' : 'box'
      const destClearanceType = agg.dest_clearance_type ? String(agg.dest_clearance_type).trim() : undefined
      let serviceType = agg.service_type ? String(agg.service_type).trim() : undefined
      if (!serviceType && destClearanceType) serviceType = destClearanceType === 'T86' ? 'Courier' : 'Commercial'

      inputs.push({
        awb, pickup_date: pickupDate, service_node: serviceNode, hub_name: hubName,
        pc_to_hub: agg.pc_to_hub ? String(agg.pc_to_hub).trim() : undefined,
        pc_to_hub_created_on: parseDate(agg.pc_to_hub_created_on),
        pc_to_hub_flight_no: agg.pc_to_hub_flight_no ? String(agg.pc_to_hub_flight_no).trim() : undefined,
        mawb: agg.mawb ? String(agg.mawb).trim() : undefined,
        mawb_date: parseDate(agg.mawb_date),
        port_of_origin: agg.port_of_origin ? String(agg.port_of_origin).trim() : undefined,
        clearance_type_oc: agg.clearance_type_oc ? String(agg.clearance_type_oc).trim() : undefined,
        oc_vendor: agg.oc_vendor ? String(agg.oc_vendor).trim() : undefined,
        dest_clearance_type: destClearanceType, service_type: serviceType,
        point_of_entry: agg.point_of_entry ? String(agg.point_of_entry).trim() : undefined,
        injection_port: agg.injection_port ? String(agg.injection_port).trim() : undefined,
        dc_partner: agg.dc_partner ? String(agg.dc_partner).trim() : undefined,
        country: agg.country ? String(agg.country).trim() : undefined,
        pkg_type: pkgType,
        n_packages: typeof agg.n_packages === 'number' ? agg.n_packages : parseInt(String(agg.n_packages ?? boxes.length)),
        length_cm: typeof agg.length_cm === 'number' ? agg.length_cm : parseFloat(String(agg.length_cm ?? 0)) || 1,
        width_cm:  typeof agg.width_cm  === 'number' ? agg.width_cm  : parseFloat(String(agg.width_cm  ?? 0)) || 1,
        height_cm: typeof agg.height_cm === 'number' ? agg.height_cm : parseFloat(String(agg.height_cm ?? 0)) || 1,
        gross_weight: grossWeight,
        line_items: typeof agg.line_items === 'number' ? agg.line_items : parseInt(String(agg.line_items ?? 1)) || 1,
        lm_carrier: agg.lm_carrier ? String(agg.lm_carrier).trim() : undefined,
        lm_shipping_method: agg.lm_shipping_method ? String(agg.lm_shipping_method).trim() : undefined,
        dest_zip: agg.dest_zip ? String(agg.dest_zip).trim() : undefined,
      })
    }

    if (!inputs.length) return NextResponse.json({ error: 'No valid shipments', parse_errors: errors }, { status: 400 })

    const BATCH = 50
    for (let i = 0; i < inputs.length; i += BATCH) {
      const batch = inputs.slice(i, i + BATCH)
      await db.transaction(async (tx) => {
        for (const data of batch) {
          const row = {
            awb: data.awb, pickup_date: new Date(data.pickup_date),
            service_node: data.service_node, hub_name: data.hub_name,
            pc_to_hub: data.pc_to_hub ?? null,
            pc_to_hub_created_on: data.pc_to_hub_created_on ? new Date(data.pc_to_hub_created_on) : null,
            pc_to_hub_flight_no: data.pc_to_hub_flight_no ?? null,
            mawb: data.mawb ?? null,
            mawb_date: data.mawb_date ? new Date(data.mawb_date) : null,
            port_of_origin: data.port_of_origin ?? null, clearance_type_oc: data.clearance_type_oc ?? null,
            oc_vendor: data.oc_vendor ?? null, dest_clearance_type: data.dest_clearance_type ?? null,
            service_type: data.service_type ?? null, point_of_entry: data.point_of_entry ?? null,
            injection_port: data.injection_port ?? null, dc_partner: data.dc_partner ?? null,
            country: data.country ?? null, pkg_type: data.pkg_type,
            n_packages: data.n_packages, length_cm: data.length_cm, width_cm: data.width_cm,
            height_cm: data.height_cm, gross_weight: data.gross_weight, line_items: data.line_items,
            lm_carrier: data.lm_carrier ?? null, lm_shipping_method: data.lm_shipping_method ?? null,
            dest_zip: data.dest_zip ?? null,
          }
          await tx.insert(shipments).values(row).onConflictDoUpdate({
            target: shipments.awb,
            set: { ...row, updated_at: new Date() },
          })
        }
      })
    }

    const ctx     = await loadEngineContext(inputs.map(i => i.awb))
    const results = await runCostEngine(inputs, ctx)
    await persistCosts(results)

    return NextResponse.json({
      uploaded_box_rows: totalBoxRows, shipments_created: totalShipments,
      costs_computed: results.length, total_cost: results.reduce((a, r) => a + r.total, 0),
      avg_cost_per_shipment: results.length ? results.reduce((a, r) => a + r.total, 0) / results.length : 0,
      parse_errors: errors, column_sample: Object.keys(rawRows[0] ?? {}).slice(0, 8),
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
