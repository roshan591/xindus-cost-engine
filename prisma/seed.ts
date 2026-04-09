import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const START = new Date('2025-01-01')
const END = new Date('2099-12-31')

async function main() {
  console.log('Seeding master data…')

  // ── Pickup ─────────────────────────────────────────────────────────────────
  await prisma.pickupCostMaster.createMany({
    data: [
      { pickup_node: 'Jaipur PC', delivery_node: 'Delhi Hub', monthly_fixed_charge: 30000, threshold_weight: 2000, cost_per_kg_above_threshold: 8, start_date: START, end_date: END },
      { pickup_node: 'Surat PC', delivery_node: 'Mumbai Hub', monthly_fixed_charge: 25000, threshold_weight: 1800, cost_per_kg_above_threshold: 7.5, start_date: START, end_date: END },
      { pickup_node: 'Delhi PC', delivery_node: 'Delhi Hub', monthly_fixed_charge: 40000, threshold_weight: 3000, cost_per_kg_above_threshold: 9, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })
  await prisma.pickupAvgMaster.createMany({
    data: [
      { service_node: 'Jaipur PC', avg_cost_per_kg: 12, start_date: START, end_date: END },
      { service_node: 'Surat PC', avg_cost_per_kg: 10, start_date: START, end_date: END },
      { service_node: 'Delhi PC', avg_cost_per_kg: 11, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // ── First Mile ─────────────────────────────────────────────────────────────
  await prisma.fmMaster.createMany({
    data: [
      { origin_node: 'Jaipur PC', delivery_node: 'Delhi Hub', mode_of_transport: 'Road', cost_per_kg: 7, fixed_cost: 500, start_date: START, end_date: END },
      { origin_node: 'Surat PC', delivery_node: 'Mumbai Hub', mode_of_transport: 'Air', cost_per_kg: 40, fixed_cost: 2000, start_date: START, end_date: END },
      { origin_node: 'Delhi PC', delivery_node: 'Delhi Hub', mode_of_transport: 'Road', cost_per_kg: 5, fixed_cost: 300, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })
  await prisma.fmAvgMaster.createMany({
    data: [
      { service_node: 'Jaipur PC', avg_cost_per_kg: 9, start_date: START, end_date: END },
      { service_node: 'Surat PC', avg_cost_per_kg: 45, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // ── Hubs ───────────────────────────────────────────────────────────────────
  await prisma.hubCostMaster.createMany({
    data: [
      { hub_name: 'Delhi Hub', monthly_fixed_cost: 80000, monthly_threshold_weight: 15000, threshold_per_kg_cost: 4, start_date: START, end_date: END },
      { hub_name: 'Mumbai Hub', monthly_fixed_cost: 65000, monthly_threshold_weight: 12000, threshold_per_kg_cost: 3.5, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // ── Origin Customs ─────────────────────────────────────────────────────────
  await prisma.ocMaster.createMany({
    data: [
      { vendor_name: 'ABC Customs', port_of_origin: 'DEL', clearance_type: 'CSB V', charge_type: 'Per MAWB', cost: 500, threshold_mawb_weight: 0, threshold_per_kg_cost: 0, start_date: START, end_date: END },
      { vendor_name: 'ABC Customs', port_of_origin: 'DEL', clearance_type: 'CSB V', charge_type: 'Per KG', cost: 2, threshold_mawb_weight: 500, threshold_per_kg_cost: 1.5, start_date: START, end_date: END },
      { vendor_name: 'ABC Customs', port_of_origin: 'DEL', clearance_type: 'CSB V', charge_type: 'Per Shipment', cost: 50, threshold_mawb_weight: 0, threshold_per_kg_cost: 0, start_date: START, end_date: END },
      { vendor_name: 'PQR Freight', port_of_origin: 'BOM', clearance_type: 'Commercial', charge_type: 'Per MAWB', cost: 800, threshold_mawb_weight: 0, threshold_per_kg_cost: 0, start_date: START, end_date: END },
      { vendor_name: 'PQR Freight', port_of_origin: 'BOM', clearance_type: 'Commercial', charge_type: 'Per KG', cost: 3, threshold_mawb_weight: 1000, threshold_per_kg_cost: 2, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })
  await prisma.ocAvgMaster.createMany({
    data: [
      { vendor_name: 'ABC Customs', clearance_type: 'CSB V', avg_cost_per_kg: 8, start_date: START, end_date: END },
      { vendor_name: 'PQR Freight', clearance_type: 'Commercial', avg_cost_per_kg: 10, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // ── Middle Mile ────────────────────────────────────────────────────────────
  await prisma.mmMaster.createMany({
    data: [
      { airline: 'Emirates (EK)', origin_port: 'DEL', dest_port: 'JFK', rate_per_kg: 3.5, fixed_cost_per_mawb: 250, start_date: START, end_date: END },
      { airline: 'Air India (AI)', origin_port: 'DEL', dest_port: 'LHR', rate_per_kg: 2.8, fixed_cost_per_mawb: 200, start_date: START, end_date: END },
      { airline: 'Singapore (SQ)', origin_port: 'BOM', dest_port: 'SIN', rate_per_kg: 4.0, fixed_cost_per_mawb: 300, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })
  await prisma.mmAvgMaster.createMany({
    data: [
      { origin_port: 'DEL', avg_cost_per_kg: 3.2, start_date: START, end_date: END },
      { origin_port: 'BOM', avg_cost_per_kg: 3.8, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // ── Destination Handling ───────────────────────────────────────────────────
  await prisma.dhMaster.createMany({
    data: [
      { dc_partner: 'WC', clearance_type: 'T86', cost_head_name: 'Airline Recovery', charge_type: 'Per KG', cost: 2.0, start_date: START, end_date: END },
      { dc_partner: 'WC', clearance_type: 'T86', cost_head_name: 'ISC', charge_type: 'Per MAWB', cost: 150, start_date: START, end_date: END },
      { dc_partner: 'WC', clearance_type: 'T86', cost_head_name: 'Pallet', charge_type: 'Per Pallet', cost: 80, pallet_weight: 300, start_date: START, end_date: END },
      { dc_partner: 'WC', clearance_type: 'T86', cost_head_name: 'Handover', charge_type: 'Per Shipment', cost: 5, start_date: START, end_date: END },
      { dc_partner: 'EC', clearance_type: 'FORMAL', cost_head_name: 'Airline Recovery', charge_type: 'Per KG', cost: 1.8, start_date: START, end_date: END },
      { dc_partner: 'EC', clearance_type: 'FORMAL', cost_head_name: 'ISC', charge_type: 'Per MAWB', cost: 120, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })
  await prisma.dhAvgMaster.createMany({
    data: [
      { clearance_type: 'T86', point_of_entry: 'JFK', avg_cost_per_kg: 4.5, start_date: START, end_date: END },
      { clearance_type: 'FORMAL', point_of_entry: 'LHR', avg_cost_per_kg: 3.8, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // ── Destination Clearance ──────────────────────────────────────────────────
  await prisma.dcClearanceMaster.createMany({
    data: [
      { country: 'USA', vendor_name: 'US Broker JFK', clearance_type: 'T86', charge_type: 'Per Shipment', cost: 8, start_date: START, end_date: END },
      { country: 'USA', vendor_name: 'US Broker JFK', clearance_type: 'T86', charge_type: 'Fixed Per MAWB', cost: 150, start_date: START, end_date: END },
      { country: 'USA', vendor_name: 'US Broker JFK', clearance_type: 'Formal', charge_type: 'Per KG', cost: 1.5, start_date: START, end_date: END },
      { country: 'UK', vendor_name: 'UK Customs LHR', clearance_type: 'Formal', charge_type: 'Per KG', cost: 1.2, start_date: START, end_date: END },
      { country: 'UK', vendor_name: 'UK Customs LHR', clearance_type: 'Formal', charge_type: 'Fixed Per MAWB', cost: 100, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })
  await prisma.dcClearanceAvgMaster.createMany({
    data: [
      { country: 'USA', clearance_type: 'T86', avg_cost_per_kg: 2.5, start_date: START, end_date: END },
      { country: 'UK', clearance_type: 'Formal', avg_cost_per_kg: 2.0, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // ── Drop-Off ───────────────────────────────────────────────────────────────
  await prisma.dropoffMaster.createMany({
    data: [
      { country: 'USA', partner: 'UPS', fixed_cost_per_mawb: 100, cost_per_kg: 2.0, start_date: START, end_date: END },
      { country: 'USA', partner: 'FedEx', fixed_cost_per_mawb: 120, cost_per_kg: 2.2, start_date: START, end_date: END },
      { country: 'USA', partner: 'UniUni', fixed_cost_per_mawb: 80, cost_per_kg: 1.5, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // ── Last Mile ──────────────────────────────────────────────────────────────
  await prisma.lmCarrierConfig.createMany({
    data: [
      { carrier_name: 'UPS', shipping_method: 'Ground', vol_factor: 5000, carrier_type: 'National', rate_type: 'LBS', residential_surcharge: 4.9, fuel_surcharge_pct: 20.25, partner_margin_pct: 5, country: 'USA', start_date: START, end_date: END },
      { carrier_name: 'FedEx', shipping_method: 'Ground', vol_factor: 5000, carrier_type: 'National', rate_type: 'LBS', residential_surcharge: 5.1, fuel_surcharge_pct: 21.5, partner_margin_pct: 5, country: 'USA', start_date: START, end_date: END },
      { carrier_name: 'UniUni', shipping_method: 'Ground', vol_factor: 6000, carrier_type: 'Regional', rate_type: 'LBS', residential_surcharge: 0, fuel_surcharge_pct: 18, partner_margin_pct: 3, country: 'USA', start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // UPS Zone 2 sample rate slabs (LBS)
  await prisma.lmRateCard.createMany({
    data: [
      { country: 'USA', zone: '2', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 1, rate: 8.40, start_date: START, end_date: END },
      { country: 'USA', zone: '2', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 2, rate: 9.10, start_date: START, end_date: END },
      { country: 'USA', zone: '2', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 5, rate: 10.40, start_date: START, end_date: END },
      { country: 'USA', zone: '2', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 10, rate: 12.60, start_date: START, end_date: END },
      { country: 'USA', zone: '2', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 20, rate: 15.80, start_date: START, end_date: END },
      { country: 'USA', zone: '2', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 70, rate: 22.30, start_date: START, end_date: END },
      // Zone 3
      { country: 'USA', zone: '3', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 1, rate: 9.20, start_date: START, end_date: END },
      { country: 'USA', zone: '3', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 5, rate: 11.50, start_date: START, end_date: END },
      { country: 'USA', zone: '3', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 10, rate: 14.20, start_date: START, end_date: END },
      { country: 'USA', zone: '3', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 20, rate: 18.40, start_date: START, end_date: END },
      { country: 'USA', zone: '3', carrier_name: 'UPS', shipping_method: 'Ground', injection_port: 'JFK', unit: 'LBS', unit_value: 70, rate: 27.60, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // DAS zones
  await prisma.lmDasMaster.createMany({
    data: [
      { country: 'USA', carrier_name: 'UPS', shipping_method: 'Ground', zipcode: '90001', das_type: 'DAS', surcharge_amount: 3.85, start_date: START, end_date: END },
      { country: 'USA', carrier_name: 'UPS', shipping_method: 'Ground', zipcode: '90002', das_type: 'EDAS', surcharge_amount: 7.50, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // Surcharges
  await prisma.lmSurchargeMaster.createMany({
    data: [
      { carrier_name: 'UPS', surcharge_type: 'Additional Handling', charge_type: 'Fixed', value: 31.45, condition_type: 'Weight', condition_value: 70, start_date: START, end_date: END },
      { carrier_name: 'UPS', surcharge_type: 'Large Package', charge_type: 'Fixed', value: 115.00, condition_type: 'Dimension', condition_value: 96, start_date: START, end_date: END },
      { carrier_name: 'FedEx', surcharge_type: 'Additional Handling', charge_type: 'Fixed', value: 30.50, condition_type: 'Weight', condition_value: 70, start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  // Zone mapping samples
  await prisma.lmZoneMapping.createMany({
    data: [
      { country: 'USA', carrier_name: 'UPS', shipping_method: 'Ground', destination_key: '100', zone: '2', injection_port: 'JFK', start_date: START, end_date: END },
      { country: 'USA', carrier_name: 'UPS', shipping_method: 'Ground', destination_key: '200', zone: '3', injection_port: 'JFK', start_date: START, end_date: END },
      { country: 'USA', carrier_name: 'UPS', shipping_method: 'Ground', destination_key: '300', zone: '4', injection_port: 'JFK', start_date: START, end_date: END },
      { country: 'USA', carrier_name: 'UPS', shipping_method: 'Ground', destination_key: '900', zone: '8', injection_port: 'JFK', start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  await prisma.lmAvgMaster.createMany({
    data: [
      { carrier_name: 'UPS', shipping_method: 'Ground', avg_cost_per_kg: 18, country: 'USA', start_date: START, end_date: END },
      { carrier_name: 'FedEx', shipping_method: 'Ground', avg_cost_per_kg: 19, country: 'USA', start_date: START, end_date: END },
      { carrier_name: 'UniUni', shipping_method: 'Ground', avg_cost_per_kg: 14, country: 'USA', start_date: START, end_date: END },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Seed complete')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
