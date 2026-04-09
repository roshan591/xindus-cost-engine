'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const TABS = [
  { id: 'pickup', label: 'Pickup', endpoint: '/api/master/pickup' },
  { id: 'fm', label: 'First Mile', endpoint: '/api/master/fm' },
  { id: 'hub', label: 'Hub', endpoint: '/api/master/hub' },
  { id: 'oc', label: 'Origin Customs', endpoint: '/api/master/oc' },
  { id: 'mm', label: 'Middle Mile', endpoint: '/api/master/mm' },
  { id: 'dh', label: 'Dest. Handling', endpoint: '/api/master/dh' },
  { id: 'dc', label: 'Dest. Clearance', endpoint: '/api/master/dc' },
  { id: 'dropoff', label: 'Drop-Off', endpoint: '/api/master/dropoff' },
  { id: 'lm', label: 'Last Mile', endpoint: '/api/master/lm' },
]

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n ?? 0)
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN') : '—'

export default function MasterPage() {
  const [tab, setTab] = useState('pickup')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [addType, setAddType] = useState('master')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const [apiError, setApiError] = useState<string | null>(null)

  const loadTab = useCallback(async (t: string) => {
    setLoading(true)
    setData(null)
    setApiError(null)
    const ep = TABS.find(x => x.id === t)?.endpoint
    if (!ep) return
    try {
      const r = await fetch(ep)
      const text = await r.text()
      if (!text.trim()) {
        setApiError(`API returned empty response (${r.status}). Check DATABASE_URL and run: npm run db:push && npm run db:generate`)
        setLoading(false)
        return
      }
      let json: unknown
      try { json = JSON.parse(text) }
      catch { setApiError(`API returned non-JSON: ${text.slice(0, 300)}`); setLoading(false); return }
      if (!r.ok) {
        setApiError(`API error ${r.status}: ${(json as any)?.error ?? text}`)
        setLoading(false)
        return
      }
      setData(json)
    } catch (e) {
      setApiError(`Network error: ${String(e)}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadTab(tab) }, [tab, loadTab])

  return (
    <main>
      <nav className="nav">
        <div className="nav-logo">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <polygon points="10,1 18.5,5.5 18.5,14.5 10,19 1.5,14.5 1.5,5.5" stroke="#f59e0b" strokeWidth="1.5" fill="#f59e0b18" />
            <circle cx="10" cy="10" r="2.8" fill="#f59e0b" />
          </svg>
          Xindus OS <span>/ Cost Engine</span>
        </div>
        {[['/', 'Dashboard', 'dashboard'], ['/shipments', 'Shipments', 'shipments'], ['/master', 'Master Data', 'master'], ['/upload', 'Upload', 'upload']].map(([href, label, id]) => (
          <Link key={id} href={href} className={`nav-link${id === 'master' ? ' active' : ''}`}>{label}</Link>
        ))}
      </nav>

      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="page-title">Master Data</div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Record</button>
        </div>

        <div className="sub-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`sub-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading master data…</div>
        ) : apiError ? (
          <div style={{ padding: 20, background: '#f8717112', border: '1px solid #f8717140', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>✗ Failed to load master data</div>
            <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 12 }}>{apiError}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', background: '#060c18', borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace' }}>
              Fix: npm run db:push &amp;&amp; npm run db:generate &amp;&amp; npm run db:seed
            </div>
          </div>
        ) : (
          <>
            {tab === 'pickup' && <PickupMaster data={data} />}
            {tab === 'fm' && <FmMaster data={data} />}
            {tab === 'hub' && <HubMaster data={data} />}
            {tab === 'oc' && <OcMaster data={data} />}
            {tab === 'mm' && <MmMaster data={data} />}
            {tab === 'dh' && <DhMaster data={data} />}
            {tab === 'dc' && <DcMaster data={data} />}
            {tab === 'dropoff' && <DropoffMaster data={data} />}
            {tab === 'lm' && <LmMaster data={data} />}
          </>
        )}
      </div>

      {showAdd && (
        <AddModal tab={tab} onClose={() => setShowAdd(false)} onSaved={() => { loadTab(tab); showToast('Record saved'); setShowAdd(false) }} />
      )}

      {toast && <div className="toast success">✓ {toast}</div>}
    </main>
  )
}

// ── Individual master view components ─────────────────────────────────────────

function PickupMaster({ data }: { data: any }) {
  const masters = data?.masters ?? []
  const avg = data?.avg ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-title">Pickup Cost Master ({masters.length} records)</div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Pickup Node</th><th>Delivery Node</th>
              <th className="r">Monthly Fixed ₹</th><th className="r">Threshold kg</th>
              <th className="r">Above Threshold ₹/kg</th><th>From</th><th>To</th>
            </tr></thead>
            <tbody>{masters.map((m: any) => (
              <tr key={m.id}>
                <td className="h">{m.pickup_node}</td><td>{m.delivery_node}</td>
                <td className="r">{fmt(m.monthly_fixed_charge)}</td>
                <td className="r">{m.threshold_weight || '—'}</td>
                <td className="r">{m.cost_per_kg_above_threshold || '—'}</td>
                <td>{fmtDate(m.start_date)}</td><td>{fmtDate(m.end_date)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Pickup Average Master (Fallback)</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Service Node</th><th className="r">Avg Cost ₹/kg</th><th>From</th><th>To</th></tr></thead>
            <tbody>{avg.map((a: any) => (
              <tr key={a.id}><td className="h">{a.service_node}</td><td className="r">{fmt(a.avg_cost_per_kg)}</td><td>{fmtDate(a.start_date)}</td><td>{fmtDate(a.end_date)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FmMaster({ data }: { data: any }) {
  const masters = data?.masters ?? [], avg = data?.avg ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-title">First Mile Master ({masters.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Flight/Manifest No</th><th>Origin</th><th>Destination</th><th>Mode</th>
              <th className="r">₹/kg</th><th className="r">Fixed ₹</th><th>From</th><th>To</th>
            </tr></thead>
            <tbody>{masters.map((m: any) => (
              <tr key={m.id}>
                <td className="h">{m.flight_no ?? '—'}</td><td>{m.origin_node}</td><td>{m.delivery_node}</td>
                <td><span className={`badge ${m.mode_of_transport === 'Air' ? 'src-calculated' : 'src-avg'}`}>{m.mode_of_transport}</span></td>
                <td className="r">{fmt(m.cost_per_kg)}</td><td className="r">{fmt(m.fixed_cost)}</td>
                <td>{fmtDate(m.start_date)}</td><td>{fmtDate(m.end_date)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">FM Average Master (Fallback)</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Service Node</th><th className="r">Avg ₹/kg</th><th>From</th><th>To</th></tr></thead>
            <tbody>{avg.map((a: any) => (<tr key={a.id}><td className="h">{a.service_node}</td><td className="r">{fmt(a.avg_cost_per_kg)}</td><td>{fmtDate(a.start_date)}</td><td>{fmtDate(a.end_date)}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function HubMaster({ data }: { data: any }) {
  const masters = data?.masters ?? [], holidays = data?.holidays ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-title">Hub Cost Master ({masters.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Hub</th><th className="r">Monthly Fixed ₹</th>
              <th className="r">Monthly Threshold kg</th><th className="r">Threshold ₹/kg</th>
              <th>From</th><th>To</th>
            </tr></thead>
            <tbody>{masters.map((m: any) => (
              <tr key={m.id}>
                <td className="h">{m.hub_name}</td>
                <td className="r">{fmt(m.monthly_fixed_cost)}</td>
                <td className="r">{m.monthly_threshold_weight || '—'}</td>
                <td className="r">{m.threshold_per_kg_cost || '—'}</td>
                <td>{fmtDate(m.start_date)}</td><td>{fmtDate(m.end_date)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Holidays ({holidays.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Hub</th><th>Reason</th></tr></thead>
            <tbody>{holidays.map((h: any) => (<tr key={h.id}><td className="h">{fmtDate(h.date)}</td><td>{h.hub_name}</td><td>{h.reason ?? '—'}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function OcMaster({ data }: { data: any }) {
  const masters = data?.masters ?? [], avg = data?.avg ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-title">OC Master — Multi-charge ({masters.length} charge rows)</div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Vendor</th><th>Port</th><th>Clearance Type</th><th>Charge Type</th>
              <th className="r">Cost</th><th className="r">Threshold kg</th><th className="r">Threshold Rate</th>
              <th>From</th><th>To</th>
            </tr></thead>
            <tbody>{masters.map((m: any) => (
              <tr key={m.id}>
                <td className="h">{m.vendor_name}</td><td>{m.port_of_origin}</td>
                <td><span className="badge src-calculated">{m.clearance_type}</span></td>
                <td><span className="badge src-avg">{m.charge_type}</span></td>
                <td className="r">{fmt(m.cost)}</td>
                <td className="r">{m.threshold_mawb_weight || '—'}</td>
                <td className="r">{m.threshold_per_kg_cost || '—'}</td>
                <td>{fmtDate(m.start_date)}</td><td>{fmtDate(m.end_date)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">OC Average Master</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vendor</th><th>Clearance Type</th><th className="r">Avg ₹/kg</th><th>From</th><th>To</th></tr></thead>
            <tbody>{avg.map((a: any) => (<tr key={a.id}><td className="h">{a.vendor_name}</td><td>{a.clearance_type}</td><td className="r">{fmt(a.avg_cost_per_kg)}</td><td>{fmtDate(a.start_date)}</td><td>{fmtDate(a.end_date)}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MmMaster({ data }: { data: any }) {
  const masters = data?.masters ?? [], avg = data?.avg ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-title">Middle Mile (Air Freight) Rates ({masters.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Airline</th><th>Origin</th><th>Dest</th><th className="r">Rate $/kg</th><th className="r">MAWB Fixed $</th><th>From</th><th>To</th></tr></thead>
            <tbody>{masters.map((m: any) => (<tr key={m.id}><td className="h">{m.airline}</td><td>{m.origin_port}</td><td>{m.dest_port}</td><td className="r">{fmt(m.rate_per_kg)}</td><td className="r">{fmt(m.fixed_cost_per_mawb)}</td><td>{fmtDate(m.start_date)}</td><td>{fmtDate(m.end_date)}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">MM Average Master</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Origin Port</th><th className="r">Avg $/kg</th><th>From</th><th>To</th></tr></thead>
            <tbody>{avg.map((a: any) => (<tr key={a.id}><td className="h">{a.origin_port}</td><td className="r">{fmt(a.avg_cost_per_kg)}</td><td>{fmtDate(a.start_date)}</td><td>{fmtDate(a.end_date)}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DhMaster({ data }: { data: any }) {
  const masters = data?.masters ?? [], avg = data?.avg ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-title">Destination Handling — Multi-charge ({masters.length} rows)</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Partner</th><th>Clearance Type</th><th>Charge Head</th><th>Charge Type</th><th className="r">Cost</th><th className="r">Pallet Wt</th><th>From</th><th>To</th></tr></thead>
            <tbody>{masters.map((m: any) => (<tr key={m.id}><td className="h">{m.dc_partner}</td><td>{m.clearance_type}</td><td>{m.cost_head_name}</td><td><span className="badge src-avg">{m.charge_type}</span></td><td className="r">{fmt(m.cost)}</td><td className="r">{m.pallet_weight ?? '—'}</td><td>{fmtDate(m.start_date)}</td><td>{fmtDate(m.end_date)}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">DH Average Master</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Clearance Type</th><th>Point of Entry</th><th className="r">Avg $/kg</th></tr></thead>
            <tbody>{avg.map((a: any) => (<tr key={a.id}><td className="h">{a.clearance_type}</td><td>{a.point_of_entry}</td><td className="r">{fmt(a.avg_cost_per_kg)}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DcMaster({ data }: { data: any }) {
  const masters = data?.masters ?? [], avg = data?.avg ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-title">Destination Clearance Master ({masters.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Country</th><th>Vendor</th><th>Clearance Type</th><th>Charge Type</th><th className="r">Cost</th><th>From</th><th>To</th></tr></thead>
            <tbody>{masters.map((m: any) => (<tr key={m.id}><td className="h">{m.country}</td><td>{m.vendor_name}</td><td>{m.clearance_type}</td><td><span className="badge src-avg">{m.charge_type}</span></td><td className="r">{fmt(m.cost)}</td><td>{fmtDate(m.start_date)}</td><td>{fmtDate(m.end_date)}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DropoffMaster({ data }: { data: any }) {
  const masters = data?.masters ?? [], avg = data?.avg ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-title">Drop-Off / Carrier Injection Master ({masters.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Country</th><th>Partner</th><th className="r">Fixed $/MAWB</th><th className="r">$/kg</th><th>From</th><th>To</th></tr></thead>
            <tbody>{masters.map((m: any) => (<tr key={m.id}><td className="h">{m.country}</td><td>{m.partner}</td><td className="r">{fmt(m.fixed_cost_per_mawb)}</td><td className="r">{fmt(m.cost_per_kg)}</td><td>{fmtDate(m.start_date)}</td><td>{fmtDate(m.end_date)}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function LmMaster({ data }: { data: any }) {
  const configs = data?.configs ?? [], rates = data?.rates ?? [], das = data?.das ?? [], surcharges = data?.surcharges ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-title">Carrier Config ({configs.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Carrier</th><th>Method</th><th className="r">Vol Factor</th><th>Type</th><th>Rate Unit</th><th className="r">Fuel %</th><th className="r">Margin %</th></tr></thead>
            <tbody>{configs.map((c: any) => (<tr key={c.id}><td className="h">{c.carrier_name}</td><td>{c.shipping_method}</td><td className="r">{c.vol_factor}</td><td><span className="badge src-avg">{c.carrier_type}</span></td><td>{c.rate_type}</td><td className="r">{c.fuel_surcharge_pct}%</td><td className="r">{c.partner_margin_pct}%</td></tr>))}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Rate Card ({rates.length} slabs)</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Carrier</th><th>Method</th><th>Zone</th><th>Port</th><th>Unit</th><th className="r">Up to</th><th className="r">Rate $</th></tr></thead>
            <tbody>{rates.slice(0, 50).map((r: any) => (<tr key={r.id}><td className="h">{r.carrier_name}</td><td>{r.shipping_method}</td><td>{r.zone}</td><td>{r.injection_port}</td><td>{r.unit}</td><td className="r">{r.unit_value}</td><td className="r">{fmt(r.rate)}</td></tr>))}</tbody>
          </table>
          {rates.length > 50 && <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)' }}>Showing 50 of {rates.length} slabs</div>}
        </div>
      </div>
      <div className="grid-2-eq">
        <div className="card">
          <div className="card-title">DAS Master ({das.length})</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Carrier</th><th>ZIP</th><th>Type</th><th className="r">Surcharge $</th></tr></thead>
              <tbody>{das.slice(0, 30).map((d: any) => (<tr key={d.id}><td className="h">{d.carrier_name}</td><td>{d.zipcode}</td><td><span className="badge src-override">{d.das_type}</span></td><td className="r">{fmt(d.surcharge_amount)}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Additional Surcharges ({surcharges.length})</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Carrier</th><th>Type</th><th>Charge</th><th className="r">Value</th><th>Condition</th></tr></thead>
              <tbody>{surcharges.map((s: any) => (<tr key={s.id}><td className="h">{s.carrier_name}</td><td style={{ fontSize: 10 }}>{s.surcharge_type}</td><td>{s.charge_type}</td><td className="r">{s.charge_type === 'Percent' ? s.value + '%' : '$' + fmt(s.value)}</td><td style={{ fontSize: 10 }}>{s.condition_type ? `${s.condition_type} > ${s.condition_value}` : '—'}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Modal (generic) ────────────────────────────────────────────────────────

function AddModal({ tab, onClose, onSaved }: { tab: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '2099-12-31',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    const ep = TABS.find(t => t.id === tab)?.endpoint
    if (!ep) return
    const body: Record<string, unknown> = { data: form }
    // convert numeric strings
    for (const [k, v] of Object.entries(form)) {
      if (!isNaN(Number(v)) && v !== '') (body.data as any)[k] = Number(v)
    }
    await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    onSaved()
  }

  const fields: Record<string, { label: string; type?: string; options?: string[] }[]> = {
    pickup: [
      { label: 'Pickup Node' }, { label: 'Delivery Node' },
      { label: 'Monthly Fixed Charge (₹)', type: 'number' },
      { label: 'Threshold Weight (kg)', type: 'number' },
      { label: 'Cost Per KG Above Threshold', type: 'number' },
      { label: 'Start Date', type: 'date' }, { label: 'End Date', type: 'date' },
    ],
    fm: [
      { label: 'Origin Node' }, { label: 'Delivery Node' },
      { label: 'Mode of Transport', options: ['Air', 'Rail', 'Road'] },
      { label: 'Cost Per KG', type: 'number' }, { label: 'Fixed Cost', type: 'number' },
      { label: 'Flight No (optional)' },
      { label: 'Start Date', type: 'date' }, { label: 'End Date', type: 'date' },
    ],
    hub: [
      { label: 'Hub Name' }, { label: 'Monthly Fixed Cost (₹)', type: 'number' },
      { label: 'Monthly Threshold Weight (kg)', type: 'number' },
      { label: 'Threshold Per KG Cost', type: 'number' },
      { label: 'Start Date', type: 'date' }, { label: 'End Date', type: 'date' },
    ],
    oc: [
      { label: 'Vendor Name' }, { label: 'Port of Origin' },
      { label: 'Clearance Type', options: ['CSB V', 'CSB VI', 'Commercial'] },
      { label: 'Charge Type', options: ['Per MAWB', 'Per Shipment', 'Per Box', 'Per KG'] },
      { label: 'Cost', type: 'number' },
      { label: 'Threshold MAWB Weight', type: 'number' },
      { label: 'Threshold Per KG Cost', type: 'number' },
      { label: 'Start Date', type: 'date' }, { label: 'End Date', type: 'date' },
    ],
    mm: [
      { label: 'Airline' }, { label: 'Origin Port' }, { label: 'Dest Port' },
      { label: 'Rate Per KG ($)', type: 'number' }, { label: 'Fixed Cost Per MAWB ($)', type: 'number' },
      { label: 'Start Date', type: 'date' }, { label: 'End Date', type: 'date' },
    ],
    dh: [
      { label: 'DC Partner' },
      { label: 'Clearance Type', options: ['T86', 'FORMAL', 'INFORMAL'] },
      { label: 'Cost Head Name' },
      { label: 'Charge Type', options: ['Per MAWB', 'Per KG', 'Per Shipment', 'Per Carton', 'Per Pallet'] },
      { label: 'Cost ($)', type: 'number' }, { label: 'Pallet Weight (kg)', type: 'number' },
      { label: 'Start Date', type: 'date' }, { label: 'End Date', type: 'date' },
    ],
    dc: [
      { label: 'Country' }, { label: 'Vendor Name' },
      { label: 'Clearance Type', options: ['Formal', 'Informal', 'T86'] },
      { label: 'Charge Type', options: ['Per KG', 'Per Shipment', 'Per Line Item', 'Fixed Per MAWB', 'Max Per MAWB'] },
      { label: 'Cost ($)', type: 'number' },
      { label: 'Start Date', type: 'date' }, { label: 'End Date', type: 'date' },
    ],
    dropoff: [
      { label: 'Country' }, { label: 'Partner' },
      { label: 'Fixed Cost Per MAWB ($)', type: 'number' },
      { label: 'Cost Per KG ($)', type: 'number' },
      { label: 'Start Date', type: 'date' }, { label: 'End Date', type: 'date' },
    ],
    lm: [
      { label: 'Carrier Name' },
      { label: 'Shipping Method', options: ['Ground', 'Express', 'Priority'] },
      { label: 'Vol Factor', type: 'number' },
      { label: 'Carrier Type', options: ['Regional', 'National'] },
      { label: 'Rate Type', options: ['LBS', 'OZ'] },
      { label: 'Fuel Surcharge %', type: 'number' },
      { label: 'Partner Margin %', type: 'number' },
      { label: 'Start Date', type: 'date' }, { label: 'End Date', type: 'date' },
    ],
  }

  const toKey = (label: string) =>
    label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Add {TABS.find(t => t.id === tab)?.label} Record</div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-grid">
          {(fields[tab] ?? []).map(f => {
            const key = toKey(f.label)
            return (
              <div key={key}>
                <label className="field-label">{f.label}</label>
                {f.options ? (
                  <select value={form[key] ?? ''} onChange={set(key)}>
                    <option value="">— Select —</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type ?? 'text'} value={form[key] ?? ''} onChange={set(key)} />
                )}
              </div>
            )
          })}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Record'}</button>
        </div>
      </div>
    </div>
  )
}
