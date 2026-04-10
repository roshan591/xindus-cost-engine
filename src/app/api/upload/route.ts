import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runCostEngine, loadEngineContext, persistCosts } from '@/engine'
import { ShipmentInput } from '@/types'
import * as XLSX from 'xlsx'

// ─── COLUMN MAP ───────────────────────────────────────────────────────────────
// Maps every known raw column header (lower-cased, trimmed) to ShipmentInput key
const COL_MAP: Record<string, keyof ShipmentInput> = {
  // Core identity
  'awb': 'awb', 'name': 'awb', 'shipment no': 'awb', 'shipment number': 'awb',

  // Dates
  'pickup_date': 'pickup_date', 'pickup date': 'pickup_date',
  'created_date': 'pickup_date',  // fallback when no pickup date
  'pc_to_hub_crated_on': 'pc_to_hub_created_on',  // intentional typo in source data
  'pc_to_hub_created_on': 'pc_to_hub_created_on',
  'manifest date': 'pc_to_hub_created_on',
  'mm_created_date': 'mawb_date',

  // Nodes
  'service_node': 'service_node', 'service node': 'service_node',
  'shipper_city': 'service_node',  // fallback
  'hub name': 'hub_name', 'hub_name': 'hub_name', 'hub': 'hub_name',

  // Manifest / FM
  'pc_to_hub': 'pc_to_hub', 'manifest no': 'pc_to_hub', 'manifest_no': 'pc_to_hub',
  'pc_to_hub_flight_no': 'pc_to_hub_flight_no',
  'port_to_port_flightno': 'pc_to_hub_flight_no', 'flight no': 'pc_to_hub_flight_no',
  'fm_partner': 'service_node',   // first mile origin node identifier
  'fm_carrier': 'lm_carrier',    // may double as LM

  // MAWB / MM
  'mawb': 'mawb',
  'port_to_port_mm_new': 'mawb',  // alternate mawb column

  // OC fields
  'oc clearance type': 'clearance_type_oc', 'oc_clearance_type': 'clearance_type_oc',
  'final_type': 'clearance_type_oc',          // CSB V / CSB VI etc.
  'type': 'clearance_type_oc',
  'oc vendor': 'oc_vendor', 'oc_vendor': 'oc_vendor',

  // Destination / DC
  'destination_clearance': 'dest_clearance_type',
  'dest clearance type': 'dest_clearance_type',
  'dest_clearance_type': 'dest_clearance_type',
  'point_of_entry': 'point_of_entry', 'point of entry': 'point_of_entry',
  'injection port': 'injection_port', 'injection_port': 'injection_port',
  'dc_partner': 'dc_partner',

  // Country
  'reciever country': 'country', 'receiver country': 'country',
  'country': 'country',

  // Package
  'package type': 'pkg_type', 'pkg_type': 'pkg_type', 'package_type': 'pkg_type',
  'no of packages': 'n_packages', 'n_packages': 'n_packages',
  'boxes': 'n_packages',          // real file header
  'no_of_items': 'line_items', 'line_items': 'line_items', 'line items': 'line_items',

  // Weight
  'gross weight': 'gross_weight', 'gross_weight': 'gross_weight',
  'net_weight': 'gross_weight',   // fallback if no gross weight

  // Dimensions (handle both upper/lowercase variants from real file)
  'length cm': 'length_cm', 'length_cm': 'length_cm',
  'length': 'length_cm', 'length (cm)': 'length_cm',
  'breadth cm': 'width_cm', 'width_cm': 'width_cm',
  'width': 'width_cm', 'width (cm)': 'width_cm',
  'height cm': 'height_cm', 'height_cm': 'height_cm',
  'height': 'height_cm', 'height (cm)': 'height_cm',

  // LM
  'lm_carrier': 'lm_carrier', 'lm carrier': 'lm_carrier',
  'lmcarrier': 'lm_carrier', 'lm_carrier_new': 'lm_carrier',
  'carrier': 'lm_carrier', 'service': 'lm_carrier',
  'lmshippingmethod': 'lm_shipping_method', 'lm_shipping_method': 'lm_shipping_method',
  'shipping method': 'lm_shipping_method', 'shippingmethod': 'lm_shipping_method',

  // ZIP (delivery)
  'dest zip': 'dest_zip', 'dest_zip': 'dest_zip',
  'reciever postal code': 'dest_zip', 'receiver postal code': 'dest_zip',
  'reciever_postal_code': 'dest_zip', 'receiver_postal_code': 'dest_zip',
  'shipperzip': 'dest_zip',         // or shipper zip for origin - use receiver
}

// ─── DATE PARSER ─────────────────────────────────────────────────────────────
function parseDate(val: unknown): string | undefined {
  if (!val) return undefined
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  if (!s) return undefined
  // Try various formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const parts = s.split(/[\/\-\.]/)
  if (parts.length === 3) {
    let [a, b, c] = parts
    // Detect year position
    if (c.length === 4) { // DD/MM/YYYY or MM/DD/YYYY
      const day = parseInt(a), month = parseInt(b), year = parseInt(c)
      if (month > 12) return new Date(year, day - 1, month).toISOString().slice(0, 10) // swap
      return new Date(year, month - 1, day).toISOString().slice(0, 10)
    }
    if (a.length === 4) { // YYYY-MM-DD
      return new Date(parseInt(a), parseInt(b) - 1, parseInt(c)).toISOString().slice(0, 10)
    }
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

// ─── SHIPMENT-LEVEL AGGREGATION ───────────────────────────────────────────────
// Box-level data: multiple rows per AWB → aggregate to one shipment record
interface BoxRow extends Record<string, unknown> {
  awb: string
}

function aggregateBoxes(boxes: BoxRow[]): Record<string, unknown> {
  // Helper: first non-null string value across all boxes
  const first = (key: string) => boxes.map(b => b[key]).find(v => v != null && v !== '') ?? undefined

  // Gross weight: SUM across boxes
  const grossWeight = boxes.reduce((sum, b) => {
    const w = parseFloat(String(b.gross_weight ?? b.net_weight ?? 0))
    return sum + (isNaN(w) ? 0 : w)
  }, 0)

  // Dimensions: take the MAXIMUM across boxes (for oversize surcharge calculation)
  const maxDim = (key: string) => boxes.reduce((mx, b) => {
    const v = parseFloat(String(b[key] ?? 0))
    return isNaN(v) ? mx : Math.max(mx, v)
  }, 0)

  // Packages: SUM of boxes column, or COUNT of rows
  const nPackages = boxes.reduce((sum, b) => {
    const v = parseInt(String(b.n_packages ?? 1))
    return sum + (isNaN(v) ? 1 : v)
  }, 0) || boxes.length

  // Line items: SUM
  const lineItems = boxes.reduce((sum, b) => {
    const v = parseInt(String(b.line_items ?? 1))
    return sum + (isNaN(v) ? 1 : v)
  }, 0) || boxes.length

  return {
    awb: first('awb'),
    pickup_date: first('pickup_date'),
    service_node: first('service_node'),
    hub_name: first('hub_name'),
    pc_to_hub: first('pc_to_hub'),
    pc_to_hub_created_on: first('pc_to_hub_created_on'),
    pc_to_hub_flight_no: first('pc_to_hub_flight_no'),
    mawb: first('mawb'),
    mawb_date: first('mawb_date'),
    port_of_origin: first('port_of_origin'),
    clearance_type_oc: first('clearance_type_oc'),
    oc_vendor: first('oc_vendor'),
    dest_clearance_type: first('dest_clearance_type'),
    service_type: first('service_type'),
    point_of_entry: first('point_of_entry'),
    injection_port: first('injection_port'),
    dc_partner: first('dc_partner'),
    country: first('country'),
    pkg_type: first('pkg_type'),
    lm_carrier: first('lm_carrier'),
    lm_shipping_method: first('lm_shipping_method'),
    dest_zip: first('dest_zip'),
    gross_weight: grossWeight,
    length_cm: maxDim('length_cm'),
    width_cm: maxDim('width_cm'),
    height_cm: maxDim('height_cm'),
    n_packages: nPackages,
    line_items: lineItems,
  }
}

// ─── HUB DERIVATION FROM DB ───────────────────────────────────────────────────
// If hub_name is missing from the file, look it up from PickupCostMaster
// by matching pickup_node (service_node) → delivery_node (hub)
async function deriveHubName(
  serviceNode: string,
  pickupDate: string,
  hubCache: Map<string, string>
): Promise<string | undefined> {
  if (hubCache.has(serviceNode)) return hubCache.get(serviceNode)

  const master = await prisma.pickupCostMaster.findFirst({
    where: {
      pickup_node: serviceNode,
      start_date: { lte: new Date(pickupDate) },
      end_date: { gte: new Date(pickupDate) },
    },
    orderBy: { start_date: 'desc' },
  })

  if (master?.delivery_node) {
    hubCache.set(serviceNode, master.delivery_node)
    return master.delivery_node
  }

  // Also try FM master
  const fm = await prisma.fmMaster.findFirst({
    where: { origin_node: serviceNode },
    orderBy: { start_date: 'desc' },
  })
  if (fm?.delivery_node) {
    hubCache.set(serviceNode, fm.delivery_node)
    return fm.delivery_node
  }

  return undefined
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false })

    if (!rawRows.length) return NextResponse.json({ error: 'Empty file' }, { status: 400 })

    // ── Step 1: Map raw columns → ShipmentInput keys ──────────────────────────
    // Track duplicate columns (e.g. two 'chargeableweight', two 'type' columns)
    // xlsx gives them as 'chargeableweight', 'chargeableweight_1' etc — handle both
    const mappedRows: BoxRow[] = rawRows.map((row, idx) => {
      const out: Record<string, unknown> = {}
      for (const [col, val] of Object.entries(row)) {
        // Normalise: lowercase, trim, collapse whitespace, strip _1 /_2 suffixes from dupes
        const norm = col.toLowerCase().trim().replace(/\s+/g, ' ').replace(/_\d+$/, '')
        const key = COL_MAP[norm]
        if (key && out[key] == null) out[key] = val  // first non-null wins for dupes
      }
      return out as BoxRow
    })

    // ── Step 2: Filter out rows with no AWB ───────────────────────────────────
    const withAwb = mappedRows.filter(r => r.awb && String(r.awb).trim() !== '')
    if (!withAwb.length) {
      return NextResponse.json({ error: "No rows with 'awb' / 'name' column found. Check column headers." }, { status: 400 })
    }

    // ── Step 3: Group box-level rows by AWB ───────────────────────────────────
    const awbGroups = new Map<string, BoxRow[]>()
    for (const row of withAwb) {
      const awb = String(row.awb).trim().toUpperCase()
      if (!awbGroups.has(awb)) awbGroups.set(awb, [])
      awbGroups.get(awb)!.push({ ...row, awb })
    }

    const totalBoxRows = withAwb.length
    const totalShipments = awbGroups.size

    // ── Step 4: Aggregate boxes → shipment record ─────────────────────────────
    const hubCache = new Map<string, string>()
    const errors: string[] = []
    const inputs: ShipmentInput[] = []

    for (const [awb, boxes] of awbGroups) {
      const agg = aggregateBoxes(boxes)

      // Parse dates
      const pickupDate = parseDate(agg.pickup_date)
      if (!pickupDate) {
        errors.push(`AWB ${awb}: could not parse pickup_date (raw: ${agg.pickup_date}) — skipped`)
        continue
      }

      // Service node is required
      const serviceNode = agg.service_node ? String(agg.service_node).trim() : undefined
      if (!serviceNode) {
        errors.push(`AWB ${awb}: missing service_node — skipped`)
        continue
      }

      // Derive hub_name from DB if not in file
      let hubName = agg.hub_name ? String(agg.hub_name).trim() : undefined
      if (!hubName) {
        hubName = await deriveHubName(serviceNode, pickupDate, hubCache)
        if (!hubName) {
          errors.push(`AWB ${awb}: no hub_name found and could not derive from Pickup master for node "${serviceNode}" — defaulting to service_node`)
          hubName = serviceNode  // last resort
        }
      }

      // Gross weight validation
      const grossWeight = typeof agg.gross_weight === 'number' ? agg.gross_weight : parseFloat(String(agg.gross_weight ?? 0))
      if (!grossWeight || isNaN(grossWeight)) {
        errors.push(`AWB ${awb}: gross_weight is 0 or missing — skipped`)
        continue
      }

      // Derive pkg_type
      const pkgTypeRaw = String(agg.pkg_type ?? '').toLowerCase()
      const pkgType: 'box' | 'flyer' = pkgTypeRaw.includes('flyer') || pkgTypeRaw.includes('poly') ? 'flyer' : 'box'

      // Derive clearance_type_oc from final_type / type
      let clearanceTypeOc = agg.clearance_type_oc ? String(agg.clearance_type_oc).trim() : undefined

      // Derive dest_clearance_type from destination_clearance
      const destClearanceType = agg.dest_clearance_type ? String(agg.dest_clearance_type).trim() : undefined

      // Derive service_type from clearance_type (T86 = Courier, Formal/Informal = Commercial)
      let serviceType = agg.service_type ? String(agg.service_type).trim() : undefined
      if (!serviceType && destClearanceType) {
        serviceType = destClearanceType === 'T86' ? 'Courier' : 'Commercial'
      }

      inputs.push({
        awb,
        pickup_date: pickupDate,
        service_node: serviceNode,
        hub_name: hubName,
        pc_to_hub: agg.pc_to_hub ? String(agg.pc_to_hub).trim() : undefined,
        pc_to_hub_created_on: parseDate(agg.pc_to_hub_created_on),
        pc_to_hub_flight_no: agg.pc_to_hub_flight_no ? String(agg.pc_to_hub_flight_no).trim() : undefined,
        mawb: agg.mawb ? String(agg.mawb).trim() : undefined,
        mawb_date: parseDate(agg.mawb_date),
        port_of_origin: agg.port_of_origin ? String(agg.port_of_origin).trim() : undefined,
        clearance_type_oc: clearanceTypeOc,
        oc_vendor: agg.oc_vendor ? String(agg.oc_vendor).trim() : undefined,
        dest_clearance_type: destClearanceType,
        service_type: serviceType,
        point_of_entry: agg.point_of_entry ? String(agg.point_of_entry).trim() : undefined,
        injection_port: agg.injection_port ? String(agg.injection_port).trim() : undefined,
        dc_partner: agg.dc_partner ? String(agg.dc_partner).trim() : undefined,
        country: agg.country ? String(agg.country).trim() : undefined,
        pkg_type: pkgType,
        n_packages: typeof agg.n_packages === 'number' ? agg.n_packages : parseInt(String(agg.n_packages ?? boxes.length)),
        length_cm: typeof agg.length_cm === 'number' ? agg.length_cm : parseFloat(String(agg.length_cm ?? 0)) || 1,
        width_cm: typeof agg.width_cm === 'number' ? agg.width_cm : parseFloat(String(agg.width_cm ?? 0)) || 1,
        height_cm: typeof agg.height_cm === 'number' ? agg.height_cm : parseFloat(String(agg.height_cm ?? 0)) || 1,
        gross_weight: grossWeight,
        line_items: typeof agg.line_items === 'number' ? agg.line_items : parseInt(String(agg.line_items ?? 1)) || 1,
        lm_carrier: agg.lm_carrier ? String(agg.lm_carrier).trim() : undefined,
        lm_shipping_method: agg.lm_shipping_method ? String(agg.lm_shipping_method).trim() : undefined,
        dest_zip: agg.dest_zip ? String(agg.dest_zip).trim() : undefined,
      })
    }

    if (!inputs.length) {
      return NextResponse.json({ error: 'No valid shipments after aggregation', parse_errors: errors }, { status: 400 })
    }

    // ── Step 5: Upsert shipments ──────────────────────────────────────────────
    const BATCH = 50  // Prisma transaction batch size
    for (let i = 0; i < inputs.length; i += BATCH) {
      const batch = inputs.slice(i, i + BATCH)
      await prisma.$transaction(
        batch.map(data => prisma.shipment.upsert({
          where: { awb: data.awb },
          create: {
            awb: data.awb,
            pickup_date: new Date(data.pickup_date),
            service_node: data.service_node,
            hub_name: data.hub_name,
            pc_to_hub: data.pc_to_hub,
            pc_to_hub_created_on: data.pc_to_hub_created_on ? new Date(data.pc_to_hub_created_on) : undefined,
            pc_to_hub_flight_no: data.pc_to_hub_flight_no,
            mawb: data.mawb,
            mawb_date: data.mawb_date ? new Date(data.mawb_date) : undefined,
            port_of_origin: data.port_of_origin,
            clearance_type_oc: data.clearance_type_oc,
            oc_vendor: data.oc_vendor,
            dest_clearance_type: data.dest_clearance_type,
            service_type: data.service_type,
            point_of_entry: data.point_of_entry,
            injection_port: data.injection_port,
            dc_partner: data.dc_partner,
            country: data.country,
            pkg_type: data.pkg_type,
            n_packages: data.n_packages,
            length_cm: data.length_cm,
            width_cm: data.width_cm,
            height_cm: data.height_cm,
            gross_weight: data.gross_weight,
            line_items: data.line_items,
            lm_carrier: data.lm_carrier,
            lm_shipping_method: data.lm_shipping_method,
            dest_zip: data.dest_zip,
          },
          update: {
            pickup_date: new Date(data.pickup_date),
            service_node: data.service_node,
            hub_name: data.hub_name,
            pc_to_hub: data.pc_to_hub,
            pc_to_hub_created_on: data.pc_to_hub_created_on ? new Date(data.pc_to_hub_created_on) : undefined,
            pc_to_hub_flight_no: data.pc_to_hub_flight_no,
            mawb: data.mawb,
            mawb_date: data.mawb_date ? new Date(data.mawb_date) : undefined,
            port_of_origin: data.port_of_origin,
            clearance_type_oc: data.clearance_type_oc,
            oc_vendor: data.oc_vendor,
            dest_clearance_type: data.dest_clearance_type,
            service_type: data.service_type,
            point_of_entry: data.point_of_entry,
            injection_port: data.injection_port,
            dc_partner: data.dc_partner,
            country: data.country,
            pkg_type: data.pkg_type,
            n_packages: data.n_packages,
            length_cm: data.length_cm,
            width_cm: data.width_cm,
            height_cm: data.height_cm,
            gross_weight: data.gross_weight,
            line_items: data.line_items,
            lm_carrier: data.lm_carrier,
            lm_shipping_method: data.lm_shipping_method,
            dest_zip: data.dest_zip,
          },
        }))
      )
    }

    // ── Step 6: Run cost engine ───────────────────────────────────────────────
    const ctx = await loadEngineContext(inputs.map(i => i.awb))
    const results = await runCostEngine(inputs, ctx)
    await persistCosts(results)

    return NextResponse.json({
      uploaded_box_rows: totalBoxRows,
      shipments_created: totalShipments,
      costs_computed: results.length,
      total_cost: results.reduce((a, r) => a + r.total, 0),
      avg_cost_per_shipment: results.length ? results.reduce((a, r) => a + r.total, 0) / results.length : 0,
      parse_errors: errors,
      column_sample: Object.keys(rawRows[0] ?? {}).slice(0, 8),  // show what was detected
    })

  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
