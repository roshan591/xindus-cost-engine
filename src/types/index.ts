// ─── SHIPMENT TYPES ───────────────────────────────────────────────────────────

export interface ShipmentInput {
  awb: string
  pickup_date: string        // ISO date
  service_node: string
  hub_name: string
  pc_to_hub?: string         // manifest number
  pc_to_hub_created_on?: string
  pc_to_hub_flight_no?: string
  mawb?: string
  mawb_date?: string
  port_of_origin?: string
  clearance_type_oc?: string // CSB V | CSB VI | Commercial
  oc_vendor?: string
  dest_clearance_type?: string // Formal | Informal | T86
  service_type?: string      // Commercial | Courier
  point_of_entry?: string    // JFK | LAX
  injection_port?: string    // JFK-Shipbae-WC
  country?: string
  pkg_type: 'box' | 'flyer'
  n_packages: number
  length_cm: number
  width_cm: number
  height_cm: number
  gross_weight: number       // kg
  line_items: number
  lm_carrier?: string
  lm_shipping_method?: string
  dest_zip?: string
}

export interface NodeCost {
  cost: number
  source: 'calculated' | 'avg' | 'override' | 'missing'
  detail?: string
}

export interface ShipmentCostResult {
  awb: string
  pickup: NodeCost
  fm: NodeCost
  hub: NodeCost
  oc: NodeCost
  mm: NodeCost
  dh: NodeCost
  dc_clearance: NodeCost
  dropoff: NodeCost
  lm: NodeCost
  total: number
}

// ─── WEEK / DATE HELPERS ─────────────────────────────────────────────────────

export interface WeekKey {
  year: number
  week: number
  label: string   // "2025-W12"
}

export interface ManifestGroup {
  manifest_id: string       // pc_to_hub
  flight_no?: string
  created_on?: Date
  origin_node: string
  shipments: ShipmentInput[]
  total_weight: number
}

export interface MawbGroup {
  mawb: string
  mawb_date?: Date
  port_of_origin?: string
  oc_vendor?: string
  clearance_type_oc?: string
  shipments: ShipmentInput[]
  total_weight: number
  total_hawbs: number
  total_boxes: number
}

// ─── MASTER DATA TYPES ────────────────────────────────────────────────────────

export interface PickupMaster {
  pickup_node: string
  delivery_node: string
  monthly_fixed_charge: number
  threshold_weight: number
  cost_per_kg_above_threshold: number
  start_date: Date
  end_date: Date
}

export interface FmMasterRecord {
  flight_no?: string | null
  origin_node: string
  delivery_node: string
  mode_of_transport: string
  cost_per_kg: number
  fixed_cost: number
  start_date: Date
  end_date: Date
}

export interface HubMaster {
  hub_name: string
  monthly_fixed_cost: number
  monthly_threshold_weight: number
  threshold_per_kg_cost: number
  start_date: Date
  end_date: Date
}

export interface OcMasterRecord {
  vendor_name: string
  port_of_origin: string
  clearance_type: string
  charge_type: 'Per MAWB' | 'Per Shipment' | 'Per Box' | 'Per KG'
  cost: number
  threshold_mawb_weight: number
  threshold_per_kg_cost: number
  start_date: Date
  end_date: Date
}

export interface DhMasterRecord {
  dc_partner: string
  clearance_type: string
  cost_head_name: string
  charge_type: 'Per MAWB' | 'Per KG' | 'Per Shipment' | 'Per Carton' | 'Per Pallet'
  cost: number
  pallet_weight?: number | null
  start_date: Date
  end_date: Date
}

export interface DcClearanceMasterRecord {
  country: string
  vendor_name: string
  clearance_type: string
  charge_type: 'Per KG' | 'Per Shipment' | 'Per Line Item' | 'Fixed Per MAWB' | 'Max Per MAWB'
  cost: number
  start_date: Date
  end_date: Date
}

export interface DropoffMasterRecord {
  country: string
  partner: string
  fixed_cost_per_mawb: number
  cost_per_kg: number
  start_date: Date
  end_date: Date
}

export interface LmCarrierConfigRecord {
  carrier_name: string
  shipping_method: string
  vol_factor: number
  carrier_type: 'Regional' | 'National'
  rate_type: 'LBS' | 'OZ'
  residential_surcharge: number
  fuel_surcharge_pct: number
  partner_margin_pct: number
  country: string
  start_date: Date
  end_date: Date
}

export interface LmRateCardRecord {
  zone: string
  carrier_name: string
  shipping_method: string
  injection_port: string
  unit: 'OZ' | 'LBS'
  unit_value: number
  rate: number
}

export interface EngineContext {
  // All master data pre-loaded for a computation run
  pickupMasters: PickupMaster[]
  pickupAvg: { service_node: string; avg_cost_per_kg: number; start_date: Date; end_date: Date }[]
  fmMasters: FmMasterRecord[]
  fmAvg: { service_node: string; avg_cost_per_kg: number; start_date: Date; end_date: Date }[]
  hubMasters: HubMaster[]
  holidays: { date: Date; hub_name: string }[]
  ocMasters: OcMasterRecord[]
  ocAvg: { vendor_name: string; clearance_type: string; avg_cost_per_kg: number; start_date: Date; end_date: Date }[]
  mmMasters: { airline: string; origin_port: string; dest_port: string; rate_per_kg: number; fixed_cost_per_mawb: number; start_date: Date; end_date: Date }[]
  mmAvg: { origin_port: string; avg_cost_per_kg: number; start_date: Date; end_date: Date }[]
  dhMasters: DhMasterRecord[]
  dhAvg: { clearance_type: string; point_of_entry: string; avg_cost_per_kg: number; start_date: Date; end_date: Date }[]
  dcClearanceMasters: DcClearanceMasterRecord[]
  dcClearanceAvg: { country: string; clearance_type: string; avg_cost_per_kg: number; start_date: Date; end_date: Date }[]
  dropoffMasters: DropoffMasterRecord[]
  dropoffAvg: { country: string; partner: string; avg_cost_per_kg: number; start_date: Date; end_date: Date }[]
  lmCarrierConfigs: LmCarrierConfigRecord[]
  lmZoneMapping: { carrier_name: string; shipping_method: string; destination_key: string; zone: string; injection_port: string; start_date: Date; end_date: Date }[]
  lmRateCards: LmRateCardRecord[]
  lmDas: { carrier_name: string; zipcode: string; das_type: string; surcharge_amount: number; start_date: Date; end_date: Date }[]
  lmSurcharges: { carrier_name: string; surcharge_type: string; charge_type: string; value: number; condition_type?: string | null; condition_value?: number | null; start_date: Date; end_date: Date }[]
  lmAvg: { carrier_name: string; shipping_method: string; zone?: string | null; avg_cost_per_kg: number; start_date: Date; end_date: Date }[]
  overrides: Map<string, Map<string, { override_flag: boolean; override_cost: number | null }>>
}
