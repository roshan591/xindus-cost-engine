import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Sample data using REAL column headers from the Xindus export
  const sample = [
    {
      'awb': 'XD-2503-001',
      'Created_date': '2025-03-10',
      'Pickup_date': '2025-03-10',
      'service_node': 'Jaipur PC',
      'Pc_to_hub': 'MF-JP-001',
      'pc_to_hub_crated_on': '2025-03-10',
      'Pc_to_hub_flight_no': 'AI302',
      'mawb': 'MAWB-2503-001',
      'mm_created_date': '2025-03-11',
      'port_to_port_MM_New': 'MAWB-2503-001',
      'point_of_entry': 'JFK',
      'Injection Port': 'JFK-Shipbae-WC',
      'lmcarrier': 'UPS',
      'lm_carrier_new': 'UPS',
      'Lmshippingmethod': 'Ground',
      'shippingmethod': 'Ground',
      'destination_clearance': 'T86',
      'final_type': 'CSB V',
      'type': 'CSB V',
      'Reciever country': 'USA',
      'Reciever State': 'NY',
      'Reciever Postal Code': '10001',
      'shipper_city': 'Jaipur',
      'receiver_city': 'New York',
      'Gross Weight': 12.5,
      'net_weight': 11.8,
      'Volumetric Weight': 8.0,
      'chargeableweight': 12.5,
      'final_chargeable_weight': 12.5,
      'Length': 40,
      'Width': 30,
      'height': 20,
      'boxes': 3,
      'no_of_items': 3,
      'invoicetotal': 150,
      'shippingcurrency': 'USD',
      'customer_id': 'CUST001',
      'status': 'Delivered',
      'batch_awb': 'BATCH-001',
    },
    {
      'awb': 'XD-2503-001',  // Second box of same shipment
      'Created_date': '2025-03-10',
      'Pickup_date': '2025-03-10',
      'service_node': 'Jaipur PC',
      'Pc_to_hub': 'MF-JP-001',
      'pc_to_hub_crated_on': '2025-03-10',
      'Pc_to_hub_flight_no': 'AI302',
      'mawb': 'MAWB-2503-001',
      'point_of_entry': 'JFK',
      'Injection Port': 'JFK-Shipbae-WC',
      'lmcarrier': 'UPS',
      'Lmshippingmethod': 'Ground',
      'destination_clearance': 'T86',
      'final_type': 'CSB V',
      'Reciever country': 'USA',
      'Reciever Postal Code': '10001',
      'Gross Weight': 8.2,
      'Length': 35,
      'Width': 25,
      'height': 15,
      'boxes': 2,
      'no_of_items': 2,
    },
    {
      'awb': 'XD-2503-002',
      'Created_date': '2025-03-10',
      'Pickup_date': '2025-03-10',
      'service_node': 'Surat PC',
      'Pc_to_hub': 'MF-SU-002',
      'Pc_to_hub_flight_no': 'SQ405',
      'mawb': 'MAWB-2503-002',
      'mm_created_date': '2025-03-11',
      'point_of_entry': 'LHR',
      'Injection Port': 'LHR-Partner-EC',
      'lmcarrier': 'FedEx',
      'Lmshippingmethod': 'Ground',
      'destination_clearance': 'Formal',
      'final_type': 'Commercial',
      'Reciever country': 'UK',
      'Reciever Postal Code': 'SW1A 1AA',
      'Gross Weight': 48.0,
      'Length': 55,
      'Width': 42,
      'height': 35,
      'boxes': 8,
      'no_of_items': 1,
    },
  ]

  const ws1 = XLSX.utils.json_to_sheet(sample)
  ws1['!cols'] = Object.keys(sample[0]).map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, ws1, 'Sample Data (Box Level)')

  // Sheet 2: Column mapping reference
  const ref = [
    { 'Your File Column': 'awb',                'Maps To': 'Shipment ID', 'Required': 'YES', 'Aggregation': 'Group key', 'Notes': 'Rows with same AWB are combined into one shipment' },
    { 'Your File Column': 'Pickup_date / Created_date', 'Maps To': 'pickup_date', 'Required': 'YES', 'Aggregation': 'First value', 'Notes': 'DD/MM/YYYY or YYYY-MM-DD or Excel date' },
    { 'Your File Column': 'service_node / shipper_city', 'Maps To': 'Service Node', 'Required': 'YES', 'Aggregation': 'First value', 'Notes': 'Pickup centre name — must match Pickup Cost Master' },
    { 'Your File Column': 'hub name', 'Maps To': 'Hub Name', 'Required': 'NO*', 'Aggregation': 'First value', 'Notes': '*Auto-derived from Pickup Cost Master if missing' },
    { 'Your File Column': 'Gross Weight', 'Maps To': 'gross_weight', 'Required': 'YES', 'Aggregation': 'SUM', 'Notes': 'Box weights are summed to get shipment gross weight' },
    { 'Your File Column': 'Length / Width / height', 'Maps To': 'length_cm / width_cm / height_cm', 'Required': 'NO', 'Aggregation': 'MAX', 'Notes': 'Maximum dimension across boxes (for oversize checks)' },
    { 'Your File Column': 'boxes', 'Maps To': 'n_packages', 'Required': 'NO', 'Aggregation': 'SUM', 'Notes': 'Total packages. Defaults to row count per AWB' },
    { 'Your File Column': 'no_of_items', 'Maps To': 'line_items', 'Required': 'NO', 'Aggregation': 'SUM', 'Notes': 'For DC Clearance Per Line Item charges' },
    { 'Your File Column': 'Pc_to_hub', 'Maps To': 'manifest_no', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'First Mile manifest number' },
    { 'Your File Column': 'pc_to_hub_crated_on', 'Maps To': 'manifest_date', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'Typo "crated" is handled automatically' },
    { 'Your File Column': 'Pc_to_hub_flight_no / port_to_port_flightno', 'Maps To': 'flight_no', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': '' },
    { 'Your File Column': 'mawb / port_to_port_MM_New', 'Maps To': 'mawb', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'Master Air Waybill number' },
    { 'Your File Column': 'mm_created_date', 'Maps To': 'mawb_date', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': '' },
    { 'Your File Column': 'point_of_entry', 'Maps To': 'point_of_entry', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'IATA code: JFK, LHR, SIN…' },
    { 'Your File Column': 'Injection Port', 'Maps To': 'injection_port', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'Format: PORT-Partner-CODE. Last segment = DC partner' },
    { 'Your File Column': 'lmcarrier / lm_carrier_new', 'Maps To': 'lm_carrier', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'UPS / FedEx / UniUni — must match LM Carrier Config' },
    { 'Your File Column': 'Lmshippingmethod / shippingmethod', 'Maps To': 'lm_shipping_method', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'Ground / Express / Priority' },
    { 'Your File Column': 'destination_clearance', 'Maps To': 'dest_clearance_type', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'T86 / Formal / Informal. Auto-sets service_type too' },
    { 'Your File Column': 'final_type / type', 'Maps To': 'clearance_type_oc (OC)', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'CSB V / CSB VI / Commercial' },
    { 'Your File Column': 'Reciever Postal Code', 'Maps To': 'dest_zip', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'For LM zone & DAS lookup. Spelling "Reciever" handled.' },
    { 'Your File Column': 'Reciever country', 'Maps To': 'country', 'Required': 'NO', 'Aggregation': 'First value', 'Notes': 'USA / UK / Australia…' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ref), 'Column Mapping')

  // Sheet 3: How box aggregation works
  const aggSheet = [
    { 'Rule': 'AWB grouping', 'Detail': 'All rows with the same AWB are combined into one shipment record' },
    { 'Rule': 'Gross Weight', 'Detail': 'SUM across all boxes — total shipment weight sent to engine' },
    { 'Rule': 'Dimensions (L/W/H)', 'Detail': 'MAX across all boxes — worst case for oversize surcharge' },
    { 'Rule': 'Packages (boxes)', 'Detail': 'SUM of boxes column, or count of rows if boxes column is missing' },
    { 'Rule': 'Line items (no_of_items)', 'Detail': 'SUM across all boxes — used for DC clearance Per Line Item charge' },
    { 'Rule': 'All other fields', 'Detail': 'First non-null value across boxes (AWB, dates, nodes, carrier etc.)' },
    { 'Rule': 'hub_name (if missing)', 'Detail': 'Auto-looked up from Pickup Cost Master using service_node + pickup_date' },
    { 'Rule': 'service_type', 'Detail': 'Auto-derived: destination_clearance=T86 → Courier, else → Commercial' },
    { 'Rule': 'Duplicate columns', 'Detail': 'e.g. two "chargeableweight" columns — first non-null value is used' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aggSheet), 'Aggregation Rules')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="xindus-upload-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
