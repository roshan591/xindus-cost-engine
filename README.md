# Xindus OS — End-to-End Logistics Cost Engine

Production-grade, 9-node logistics cost computation platform built with **Next.js 14**, **PostgreSQL (Supabase)**, and **Prisma ORM**.

---

## Architecture

```
src/
├── app/                     # Next.js App Router pages + API routes
│   ├── page.tsx             # Dashboard (charts, KPIs, weekly rollup)
│   ├── shipments/page.tsx   # Shipment table + per-node override panel
│   ├── master/page.tsx      # Master data CRUD for all 9 nodes
│   ├── upload/page.tsx      # Drag-and-drop XLSX/CSV upload
│   └── api/
│       ├── compute/         # POST — run cost engine on all/selected shipments
│       ├── shipments/       # GET list, POST create, PATCH [awb]/override
│       ├── upload/          # POST — parse XLSX/CSV → create → compute
│       ├── dashboard/       # GET — weekly aggregations for charts
│       ├── master/{node}/   # GET + POST for all 9 master tables
│       └── cron/recompute/  # GET — Vercel Cron weekly recompute
│
├── engine/                  # Cost computation services (pure TypeScript)
│   ├── index.ts             # Orchestrator — loads masters, runs all nodes
│   ├── pickup.ts            # §5.1 Pickup: threshold + working-day allocation
│   ├── firstMile.ts         # §5.2 FM: manifest-level MAX(variable, fixed)
│   ├── hub.ts               # §5.3 Hub: monthly → weekly → working days
│   ├── originCustoms.ts     # §5.4 OC: multi-charge MAWB aggregation
│   ├── destNodes.ts         # §5.5 MM + §5.6 DH + §5.7 DC + §5.8 Dropoff
│   └── lastMile.ts          # §5.9 LM: 6-master slab pricing engine
│
├── types/index.ts           # All TypeScript interfaces
└── lib/
    ├── prisma.ts            # Singleton Prisma client
    └── utils.ts             # Week/date/weight helpers

prisma/
├── schema.prisma            # 25 tables — complete relational schema
└── seed.ts                  # Sample master data for all 9 nodes
```

---

## Cost Node Logic Summary

| Node | Grouping | Method | Fallback |
|------|----------|--------|---------|
| **5.1 Pickup** | pickup_node + delivery_node + week | Monthly fixed ÷ working days → threshold check → per-kg allocation | Avg master |
| **5.2 First Mile** | Manifest (pc_to_hub + flight_no) | MAX(variable, fixed) → per-kg → allocate | Avg master |
| **5.3 Hub** | hub_name + week | Monthly fixed ÷ working days → threshold → per-kg | — |
| **5.4 Origin Customs** | MAWB | Sum Per MAWB + Per HAWB + Per Box + Per KG (threshold) | Avg master |
| **5.5 Middle Mile** | MAWB | Rate × weight + fixed MAWB fee → per-kg | Avg master |
| **5.6 Dest. Handling** | MAWB + partner | Multi-charge incl. Per Pallet (CEILING logic) | Avg master |
| **5.7 Dest. Clearance** | Commercial=HAWB / Courier=MAWB | Per KG + Per HAWB + Per Line Item + Fixed + Max cap | Avg master |
| **5.8 Drop-Off** | MAWB + partner | Fixed (partner-scoped) + variable → per-kg | Avg master |
| **5.9 Last Mile** | Per shipment | ZIP→zone→slab rate → DAS → surcharges → fuel% → margin% | Avg master |

**Override priority (all nodes):** Override (flag=Yes) → Calculated → Avg master

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd xindus-cost-engine
npm install
```

Use Node 20 LTS or Node 22 LTS for this repo. Node 24 can generate broken Next.js `.next` chunk output on Windows in this project.

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection string (URI)**
3. Copy the connection string

### 3. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL
```

### 4. Create database tables

```bash
npm run db:push        # Push schema to Supabase
npm run db:generate    # Generate Prisma client
```

### 5. Seed master data

```bash
npm run db:seed
```

### 6. Run development server

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel

# Add environment variables in Vercel dashboard:
# DATABASE_URL  →  your Supabase connection string
# CRON_SECRET   →  openssl rand -base64 32
```

Vercel Cron is pre-configured in `vercel.json` to recompute all shipment costs every **Monday at 02:00 UTC**.

> **Build troubleshooting:** If Vercel logs show `sh: line 1: Install: command not found`, open **Project Settings → Build & Development Settings → Install Command** and set it to exactly `npm install` (or leave it blank). Do **not** paste labels like `Install Command: npm install`.

---

## Upload Template

Your XLSX file should have these column headers (case-insensitive):

**Required:**
| Column | Example |
|--------|---------|
| awb | XD-2503-001 |
| pickup date | 2025-03-10 |
| service node | Jaipur PC |
| hub name | Delhi Hub |
| package type | box |
| no of packages | 3 |
| length cm | 40 |
| breadth cm | 30 |
| height cm | 20 |
| gross weight | 250 |

**Optional (for full cost computation):**

`manifest no`, `manifest date`, `flight no`, `mawb`, `mawb date`, `port of origin`, `oc clearance type`, `oc vendor`, `dest clearance type`, `service type`, `point of entry`, `injection port`, `country`, `line items`, `lm carrier`, `shipping method`, `dest zip`

---

## Adding Master Data

### Via UI
Navigate to **Master Data** → select node → click **+ Add Record**

### Via API
```bash
# Add a pickup cost master record
curl -X POST /api/master/pickup \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "pickup_node": "Mumbai PC",
      "delivery_node": "Mumbai Hub",
      "monthly_fixed_charge": 35000,
      "threshold_weight": 2500,
      "cost_per_kg_above_threshold": 7,
      "start_date": "2025-04-01",
      "end_date": "2099-12-31"
    }
  }'

# Add LM zone mapping (bulk)
curl -X POST /api/master/lm \
  -H "Content-Type: application/json" \
  -d '{
    "type": "zone",
    "data": [
      { "country": "USA", "carrier_name": "UPS", "shipping_method": "Ground", 
        "destination_key": "941", "zone": "8", "injection_port": "JFK",
        "start_date": "2025-01-01", "end_date": "2099-12-31" }
    ]
  }'

# Trigger recompute
curl -X POST /api/compute -d '{}'

# Recompute specific AWBs
curl -X POST /api/compute \
  -d '{"awbs": ["XD-2503-001", "XD-2503-002"]}'

# Apply override
curl -X PATCH /api/shipments/XD-2503-001/override \
  -H "Content-Type: application/json" \
  -d '{
    "node": "lm",
    "override_flag": true,
    "override_cost": 850,
    "override_reason": "Airline Billing Adjustment",
    "updated_by": "ops@xindus.com"
  }'
```

---

## Database Tables (25 total)

**Core:** `shipments`, `shipment_costs`, `cost_overrides`

**Pickup:** `pickup_cost_master`, `pickup_avg_master`

**First Mile:** `fm_master`, `fm_avg_master`

**Hub:** `hub_cost_master`, `holidays`

**OC:** `oc_master`, `oc_avg_master`

**MM:** `mm_master`, `mm_avg_master`

**DH:** `dh_master`, `dh_avg_master`

**DC Clearance:** `dc_clearance_master`, `dc_clearance_avg_master`

**Drop-Off:** `dropoff_master`, `dropoff_avg_master`

**Last Mile:** `lm_carrier_config`, `lm_zone_mapping`, `lm_rate_card`, `lm_das_master`, `lm_surcharge_master`, `lm_avg_master`


