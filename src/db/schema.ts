import {
  pgTable, text, doublePrecision, integer, boolean,
  timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID())
const ts = (name: string) => timestamp(name, { mode: 'date' })
const tsNN = (name: string) => timestamp(name, { mode: 'date' }).notNull()

// ─── CORE ─────────────────────────────────────────────────────────────────────

export const shipments = pgTable('shipments', {
  id: id(),
  awb:                    text('awb').notNull().unique(),
  pickup_date:            tsNN('pickup_date'),
  service_node:           text('service_node').notNull(),
  hub_name:               text('hub_name').notNull(),
  pc_to_hub:              text('pc_to_hub'),
  pc_to_hub_created_on:   ts('pc_to_hub_created_on'),
  pc_to_hub_flight_no:    text('pc_to_hub_flight_no'),
  mawb:                   text('mawb'),
  mawb_date:              ts('mawb_date'),
  port_of_origin:         text('port_of_origin'),
  clearance_type_oc:      text('clearance_type_oc'),
  oc_vendor:              text('oc_vendor'),
  dest_clearance_type:    text('dest_clearance_type'),
  service_type:           text('service_type'),
  point_of_entry:         text('point_of_entry'),
  injection_port:         text('injection_port'),
  dc_partner:             text('dc_partner'),
  country:                text('country'),
  pkg_type:               text('pkg_type').notNull(),
  n_packages:             integer('n_packages').notNull().default(1),
  length_cm:              doublePrecision('length_cm').notNull(),
  width_cm:               doublePrecision('width_cm').notNull(),
  height_cm:              doublePrecision('height_cm').notNull(),
  gross_weight:           doublePrecision('gross_weight').notNull(),
  line_items:             integer('line_items').notNull().default(1),
  lm_carrier:             text('lm_carrier'),
  lm_shipping_method:     text('lm_shipping_method'),
  dest_zip:               text('dest_zip'),
  created_at:             tsNN('created_at').defaultNow(),
  updated_at:             tsNN('updated_at').defaultNow().$onUpdateFn(() => new Date()),
})

export const shipmentCosts = pgTable('shipment_costs', {
  id: id(),
  awb:                  text('awb').notNull().unique().references(() => shipments.awb, { onDelete: 'cascade' }),
  pickup_cost:          doublePrecision('pickup_cost').notNull().default(0),
  pickup_source:        text('pickup_source').notNull().default('calculated'),
  fm_cost:              doublePrecision('fm_cost').notNull().default(0),
  fm_source:            text('fm_source').notNull().default('calculated'),
  hub_cost:             doublePrecision('hub_cost').notNull().default(0),
  hub_source:           text('hub_source').notNull().default('calculated'),
  oc_cost:              doublePrecision('oc_cost').notNull().default(0),
  oc_source:            text('oc_source').notNull().default('calculated'),
  mm_cost:              doublePrecision('mm_cost').notNull().default(0),
  mm_source:            text('mm_source').notNull().default('calculated'),
  dh_cost:              doublePrecision('dh_cost').notNull().default(0),
  dh_source:            text('dh_source').notNull().default('calculated'),
  dc_clearance_cost:    doublePrecision('dc_clearance_cost').notNull().default(0),
  dc_clearance_source:  text('dc_clearance_source').notNull().default('calculated'),
  dropoff_cost:         doublePrecision('dropoff_cost').notNull().default(0),
  dropoff_source:       text('dropoff_source').notNull().default('calculated'),
  lm_cost:              doublePrecision('lm_cost').notNull().default(0),
  lm_source:            text('lm_source').notNull().default('calculated'),
  total_cost:           doublePrecision('total_cost').notNull().default(0),
  computed_at:          tsNN('computed_at').defaultNow(),
})

export const costOverrides = pgTable('cost_overrides', {
  id: id(),
  awb:             text('awb').notNull().references(() => shipments.awb, { onDelete: 'cascade' }),
  node:            text('node').notNull(),
  override_flag:   boolean('override_flag').notNull().default(false),
  override_cost:   doublePrecision('override_cost'),
  prev_cost:       doublePrecision('prev_cost'),
  override_reason: text('override_reason'),
  updated_by:      text('updated_by'),
  updated_at:      tsNN('updated_at').defaultNow(),
}, (t) => ({
  awbNodeIdx: index('cost_overrides_awb_node_idx').on(t.awb, t.node),
}))

// ─── PICKUP ───────────────────────────────────────────────────────────────────

export const pickupCostMasters = pgTable('pickup_cost_masters', {
  id: id(),
  pickup_node:                  text('pickup_node').notNull(),
  delivery_node:                text('delivery_node').notNull(),
  monthly_fixed_charge:         doublePrecision('monthly_fixed_charge').notNull(),
  threshold_weight:             doublePrecision('threshold_weight').notNull().default(0),
  cost_per_kg_above_threshold:  doublePrecision('cost_per_kg_above_threshold').notNull().default(0),
  start_date:                   tsNN('start_date'),
  end_date:                     tsNN('end_date'),
  created_at:                   tsNN('created_at').defaultNow(),
}, (t) => ({
  nodeIdx: index('pickup_cost_masters_node_idx').on(t.pickup_node, t.delivery_node),
}))

export const pickupAvgMasters = pgTable('pickup_avg_masters', {
  id: id(),
  service_node:     text('service_node').notNull(),
  avg_cost_per_kg:  doublePrecision('avg_cost_per_kg').notNull(),
  start_date:       tsNN('start_date'),
  end_date:         tsNN('end_date'),
})

// ─── FIRST MILE ───────────────────────────────────────────────────────────────

export const fmMasters = pgTable('fm_masters', {
  id: id(),
  flight_no:         text('flight_no'),
  origin_node:       text('origin_node').notNull(),
  delivery_node:     text('delivery_node').notNull(),
  mode_of_transport: text('mode_of_transport').notNull(),
  cost_per_kg:       doublePrecision('cost_per_kg').notNull(),
  fixed_cost:        doublePrecision('fixed_cost').notNull().default(0),
  start_date:        tsNN('start_date'),
  end_date:          tsNN('end_date'),
  created_at:        tsNN('created_at').defaultNow(),
}, (t) => ({
  nodeIdx: index('fm_masters_node_idx').on(t.origin_node, t.delivery_node),
}))

export const fmAvgMasters = pgTable('fm_avg_masters', {
  id: id(),
  service_node:     text('service_node').notNull(),
  avg_cost_per_kg:  doublePrecision('avg_cost_per_kg').notNull(),
  start_date:       tsNN('start_date'),
  end_date:         tsNN('end_date'),
})

// ─── HUB ──────────────────────────────────────────────────────────────────────

export const hubCostMasters = pgTable('hub_cost_masters', {
  id: id(),
  hub_name:                  text('hub_name').notNull(),
  monthly_fixed_cost:        doublePrecision('monthly_fixed_cost').notNull(),
  monthly_threshold_weight:  doublePrecision('monthly_threshold_weight').notNull().default(0),
  threshold_per_kg_cost:     doublePrecision('threshold_per_kg_cost').notNull().default(0),
  start_date:                tsNN('start_date'),
  end_date:                  tsNN('end_date'),
  created_at:                tsNN('created_at').defaultNow(),
})

export const holidays = pgTable('holidays', {
  id: id(),
  date:     tsNN('date'),
  hub_name: text('hub_name').notNull(),
  reason:   text('reason'),
}, (t) => ({
  dateHubUniq: uniqueIndex('holidays_date_hub_name_uniq').on(t.date, t.hub_name),
}))

// ─── ORIGIN CUSTOMS ───────────────────────────────────────────────────────────

export const ocMasters = pgTable('oc_masters', {
  id: id(),
  vendor_name:            text('vendor_name').notNull(),
  port_of_origin:         text('port_of_origin').notNull(),
  clearance_type:         text('clearance_type').notNull(),
  charge_type:            text('charge_type').notNull(),
  cost:                   doublePrecision('cost').notNull(),
  threshold_mawb_weight:  doublePrecision('threshold_mawb_weight').notNull().default(0),
  threshold_per_kg_cost:  doublePrecision('threshold_per_kg_cost').notNull().default(0),
  start_date:             tsNN('start_date'),
  end_date:               tsNN('end_date'),
  created_at:             tsNN('created_at').defaultNow(),
}, (t) => ({
  vendorIdx: index('oc_masters_vendor_idx').on(t.vendor_name, t.port_of_origin, t.clearance_type),
}))

export const ocAvgMasters = pgTable('oc_avg_masters', {
  id: id(),
  vendor_name:     text('vendor_name').notNull(),
  clearance_type:  text('clearance_type').notNull(),
  avg_cost_per_kg: doublePrecision('avg_cost_per_kg').notNull(),
  start_date:      tsNN('start_date'),
  end_date:        tsNN('end_date'),
})

// ─── MIDDLE MILE ──────────────────────────────────────────────────────────────

export const mmMasters = pgTable('mm_masters', {
  id: id(),
  airline:              text('airline').notNull(),
  origin_port:          text('origin_port').notNull(),
  dest_port:            text('dest_port').notNull(),
  rate_per_kg:          doublePrecision('rate_per_kg').notNull(),
  fixed_cost_per_mawb:  doublePrecision('fixed_cost_per_mawb').notNull().default(0),
  start_date:           tsNN('start_date'),
  end_date:             tsNN('end_date'),
  created_at:           tsNN('created_at').defaultNow(),
})

export const mmAvgMasters = pgTable('mm_avg_masters', {
  id: id(),
  origin_port:     text('origin_port').notNull(),
  avg_cost_per_kg: doublePrecision('avg_cost_per_kg').notNull(),
  start_date:      tsNN('start_date'),
  end_date:        tsNN('end_date'),
})

// ─── DESTINATION HANDLING ─────────────────────────────────────────────────────

export const dhMasters = pgTable('dh_masters', {
  id: id(),
  dc_partner:      text('dc_partner').notNull(),
  clearance_type:  text('clearance_type').notNull(),
  cost_head_name:  text('cost_head_name').notNull(),
  charge_type:     text('charge_type').notNull(),
  cost:            doublePrecision('cost').notNull(),
  pallet_weight:   doublePrecision('pallet_weight'),
  start_date:      tsNN('start_date'),
  end_date:        tsNN('end_date'),
  created_at:      tsNN('created_at').defaultNow(),
}, (t) => ({
  partnerIdx: index('dh_masters_partner_idx').on(t.dc_partner, t.clearance_type),
}))

export const dhAvgMasters = pgTable('dh_avg_masters', {
  id: id(),
  clearance_type:  text('clearance_type').notNull(),
  point_of_entry:  text('point_of_entry').notNull(),
  avg_cost_per_kg: doublePrecision('avg_cost_per_kg').notNull(),
  start_date:      tsNN('start_date'),
  end_date:        tsNN('end_date'),
})

// ─── DESTINATION CLEARANCE ────────────────────────────────────────────────────

export const dcClearanceMasters = pgTable('dc_clearance_masters', {
  id: id(),
  country:        text('country').notNull(),
  vendor_name:    text('vendor_name').notNull(),
  clearance_type: text('clearance_type').notNull(),
  charge_type:    text('charge_type').notNull(),
  cost:           doublePrecision('cost').notNull(),
  start_date:     tsNN('start_date'),
  end_date:       tsNN('end_date'),
  created_at:     tsNN('created_at').defaultNow(),
}, (t) => ({
  countryIdx: index('dc_clearance_masters_country_idx').on(t.country, t.clearance_type),
}))

export const dcClearanceAvgMasters = pgTable('dc_clearance_avg_masters', {
  id: id(),
  country:         text('country').notNull(),
  clearance_type:  text('clearance_type').notNull(),
  avg_cost_per_kg: doublePrecision('avg_cost_per_kg').notNull(),
  start_date:      tsNN('start_date'),
  end_date:        tsNN('end_date'),
})

// ─── DROPOFF ──────────────────────────────────────────────────────────────────

export const dropoffMasters = pgTable('dropoff_masters', {
  id: id(),
  country:              text('country').notNull(),
  partner:              text('partner').notNull(),
  fixed_cost_per_mawb:  doublePrecision('fixed_cost_per_mawb').notNull().default(0),
  cost_per_kg:          doublePrecision('cost_per_kg').notNull().default(0),
  start_date:           tsNN('start_date'),
  end_date:             tsNN('end_date'),
  created_at:           tsNN('created_at').defaultNow(),
}, (t) => ({
  countryIdx: index('dropoff_masters_country_idx').on(t.country, t.partner),
}))

export const dropoffAvgMasters = pgTable('dropoff_avg_masters', {
  id: id(),
  country:         text('country').notNull(),
  partner:         text('partner').notNull(),
  avg_cost_per_kg: doublePrecision('avg_cost_per_kg').notNull(),
  start_date:      tsNN('start_date'),
  end_date:        tsNN('end_date'),
})

// ─── LAST MILE ────────────────────────────────────────────────────────────────

export const lmCarrierConfigs = pgTable('lm_carrier_configs', {
  id: id(),
  carrier_name:                      text('carrier_name').notNull(),
  shipping_method:                   text('shipping_method').notNull(),
  vol_factor:                        doublePrecision('vol_factor').notNull().default(5000),
  carrier_type:                      text('carrier_type').notNull(),
  rate_type:                         text('rate_type').notNull(),
  residential_surcharge:             doublePrecision('residential_surcharge').notNull().default(0),
  residential_threshold_weight:      doublePrecision('residential_threshold_weight'),
  net_chargeable_weight_type:        text('net_chargeable_weight_type').notNull().default('Chargeable Weight'),
  net_chargeable_weight_threshold:   doublePrecision('net_chargeable_weight_threshold'),
  fuel_surcharge_pct:                doublePrecision('fuel_surcharge_pct').notNull().default(0),
  partner_margin_pct:                doublePrecision('partner_margin_pct').notNull().default(0),
  country:                           text('country').notNull().default('USA'),
  start_date:                        tsNN('start_date'),
  end_date:                          tsNN('end_date'),
  created_at:                        tsNN('created_at').defaultNow(),
}, (t) => ({
  carrierUniq: uniqueIndex('lm_carrier_configs_carrier_shipping_country_uniq').on(t.carrier_name, t.shipping_method, t.country),
}))

export const lmZoneMappings = pgTable('lm_zone_mappings', {
  id: id(),
  country:         text('country').notNull(),
  carrier_name:    text('carrier_name').notNull(),
  shipping_method: text('shipping_method').notNull(),
  destination_key: text('destination_key').notNull(),
  zone:            text('zone').notNull(),
  injection_port:  text('injection_port').notNull(),
  start_date:      tsNN('start_date'),
  end_date:        tsNN('end_date'),
}, (t) => ({
  carrierPortKeyIdx: index('lm_zone_mappings_carrier_port_key_idx').on(t.carrier_name, t.injection_port, t.destination_key),
}))

export const lmRateCards = pgTable('lm_rate_cards', {
  id: id(),
  country:         text('country').notNull(),
  zone:            text('zone').notNull(),
  carrier_name:    text('carrier_name').notNull(),
  shipping_method: text('shipping_method').notNull(),
  injection_port:  text('injection_port').notNull(),
  unit:            text('unit').notNull(),
  unit_value:      doublePrecision('unit_value').notNull(),
  rate:            doublePrecision('rate').notNull(),
  start_date:      tsNN('start_date'),
  end_date:        tsNN('end_date'),
}, (t) => ({
  carrierZoneIdx: index('lm_rate_cards_carrier_zone_idx').on(t.carrier_name, t.shipping_method, t.zone, t.injection_port),
}))

export const lmDasMasters = pgTable('lm_das_masters', {
  id: id(),
  country:          text('country').notNull(),
  carrier_name:     text('carrier_name').notNull(),
  shipping_method:  text('shipping_method').notNull(),
  zipcode:          text('zipcode').notNull(),
  das_type:         text('das_type').notNull(),
  surcharge_amount: doublePrecision('surcharge_amount').notNull(),
  start_date:       tsNN('start_date'),
  end_date:         tsNN('end_date'),
}, (t) => ({
  carrierZipIdx: index('lm_das_masters_carrier_zip_idx').on(t.carrier_name, t.zipcode),
}))

export const lmSurchargeMasters = pgTable('lm_surcharge_masters', {
  id: id(),
  carrier_name:    text('carrier_name').notNull(),
  surcharge_type:  text('surcharge_type').notNull(),
  charge_type:     text('charge_type').notNull(),
  value:           doublePrecision('value').notNull(),
  condition_type:  text('condition_type'),
  condition_value: doublePrecision('condition_value'),
  start_date:      tsNN('start_date'),
  end_date:        tsNN('end_date'),
}, (t) => ({
  carrierSurchargeIdx: index('lm_surcharge_masters_carrier_type_idx').on(t.carrier_name, t.surcharge_type),
}))

export const lmAvgMasters = pgTable('lm_avg_masters', {
  id: id(),
  carrier_name:     text('carrier_name').notNull(),
  shipping_method:  text('shipping_method').notNull(),
  zone:             text('zone'),
  avg_cost_per_kg:  doublePrecision('avg_cost_per_kg').notNull(),
  country:          text('country').notNull().default('USA'),
  start_date:       tsNN('start_date'),
  end_date:         tsNN('end_date'),
})

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  costs:     one(shipmentCosts,  { fields: [shipments.awb], references: [shipmentCosts.awb] }),
  overrides: many(costOverrides),
}))

export const shipmentCostsRelations = relations(shipmentCosts, ({ one }) => ({
  shipment: one(shipments, { fields: [shipmentCosts.awb], references: [shipments.awb] }),
}))

export const costOverridesRelations = relations(costOverrides, ({ one }) => ({
  shipment: one(shipments, { fields: [costOverrides.awb], references: [shipments.awb] }),
}))
