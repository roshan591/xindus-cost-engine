'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const NODES = ['pickup', 'fm', 'hub', 'oc', 'mm', 'dh', 'dc_clearance', 'dropoff', 'lm'] as const
const NODE_LABELS: Record<string, string> = {
  pickup: 'Pickup', fm: 'First Mile', hub: 'Hub', oc: 'Origin Customs',
  mm: 'Middle Mile', dh: 'Dest. Handling', dc_clearance: 'Dest. Clearance', dropoff: 'Drop-Off', lm: 'Last Mile',
}
const NODE_COLORS: Record<string, string> = {
  pickup: '#f59e0b', fm: '#22d3ee', hub: '#a78bfa', oc: '#34d399',
  mm: '#60a5fa', dh: '#fb923c', dc_clearance: '#f472b6', dropoff: '#e879f9', lm: '#f87171',
}

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n ?? 0))
const pct = (n: number, t: number) => t ? ((n / t) * 100).toFixed(1) + '%' : '—'

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [overrideModal, setOverrideModal] = useState<{ awb: string; node: string } | null>(null)
  const [overrideForm, setOverrideForm] = useState({ cost: '', reason: '', updatedBy: '' })
  const [filters, setFilters] = useState({ week: '', hub: '' })
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.week) params.set('week', filters.week)
    if (filters.hub) params.set('hub', filters.hub)
    params.set('limit', '200')
    const r = await fetch('/api/shipments?' + params)
    const j = await r.json()
    setShipments(j.shipments ?? [])
    setTotal(j.total ?? 0)
    setLoading(false)
  }, [filters])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const applyOverride = async () => {
    if (!overrideModal) return
    const r = await fetch(`/api/shipments/${overrideModal.awb}/override`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node: overrideModal.node,
        override_flag: true,
        override_cost: parseFloat(overrideForm.cost),
        override_reason: overrideForm.reason,
        updated_by: overrideForm.updatedBy,
      }),
    })
    if (r.ok) {
      showToast(`Override applied for ${overrideModal.awb} / ${NODE_LABELS[overrideModal.node]}`)
      setOverrideModal(null)
      setOverrideForm({ cost: '', reason: '', updatedBy: '' })
      load()
    } else {
      showToast('Override failed')
    }
  }

  const removeOverride = async (awb: string, node: string) => {
    await fetch(`/api/shipments/${awb}/override`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node, override_flag: false }),
    })
    showToast('Override removed')
    load()
  }

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
          <Link key={id} href={href} className={`nav-link${id === 'shipments' ? ' active' : ''}`}>{label}</Link>
        ))}
      </nav>

      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="page-title">Shipments <span>({total} total)</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ width: 130 }}
              placeholder="Week (2025-W12)"
              value={filters.week}
              onChange={e => setFilters(f => ({ ...f, week: e.target.value }))}
            />
            <input
              style={{ width: 130 }}
              placeholder="Hub filter"
              value={filters.hub}
              onChange={e => setFilters(f => ({ ...f, hub: e.target.value }))}
            />
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>AWB</th>
                  <th>Date</th>
                  <th>Node → Hub</th>
                  <th>Pkg</th>
                  <th className="r">Wt kg</th>
                  {NODES.map(n => (
                    <th key={n} className="r" style={{ color: NODE_COLORS[n], fontSize: 9 }}>
                      {NODE_LABELS[n].split(' ')[0]}
                    </th>
                  ))}
                  <th className="r" style={{ color: 'var(--amber)' }}>Total ₹</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={16} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</td></tr>
                ) : shipments.length === 0 ? (
                  <tr><td colSpan={16} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No shipments found. Upload a file to get started.</td></tr>
                ) : shipments.map(s => {
                  const c = s.costs
                  const isExp = expanded === s.awb
                  return (
                    <>
                      <tr key={s.awb} onClick={() => setExpanded(isExp ? null : s.awb)}>
                        <td className="expand">{isExp ? '▼' : '▶'}</td>
                        <td className="h">
                          <Link href={`/shipments/${encodeURIComponent(s.awb)}`}
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--amber)', textDecoration: 'none', fontWeight: 600 }}>
                            {s.awb}
                          </Link>
                        </td>
                        <td>{new Date(s.pickup_date).toLocaleDateString('en-IN')}</td>
                        <td style={{ color: 'var(--text-soft)' }}>
                          <span style={{ fontSize: 11 }}>{s.service_node}</span>
                          <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>
                          <span style={{ fontSize: 11 }}>{s.hub_name}</span>
                        </td>
                        <td><span className={`badge pkg-${s.pkg_type}`}>{s.pkg_type}</span></td>
                        <td className="r">{s.gross_weight}</td>
                        {NODES.map(n => (
                          <td key={n} className="r" style={{ fontSize: 11 }}>
                            {c ? fmt(c[`${n}_cost`]) : '—'}
                          </td>
                        ))}
                        <td className="ra">{c ? fmt(c.total_cost) : '—'}</td>
                      </tr>
                      {isExp && (
                        <tr key={s.awb + '_exp'}>
                          <td colSpan={16} className="expand-panel">
                            {/* Details grid */}
                            <div className="detail-grid" style={{ marginBottom: 12 }}>
                              {[
                                ['MAWB', s.mawb ?? '—'],
                                ['Manifest', s.pc_to_hub ?? '—'],
                                ['Flight No', s.pc_to_hub_flight_no ?? '—'],
                                ['Port', s.port_of_origin ?? '—'],
                                ['OC Type', s.clearance_type_oc ?? '—'],
                                ['OC Vendor', s.oc_vendor ?? '—'],
                                ['Dest Type', s.dest_clearance_type ?? '—'],
                                ['Service', s.service_type ?? '—'],
                                ['Entry Port', s.point_of_entry ?? '—'],
                                ['Partner', s.dc_partner ?? '—'],
                                ['LM Carrier', s.lm_carrier ?? '—'],
                                ['Dest ZIP', s.dest_zip ?? '—'],
                                ['Dimensions', `${s.length_cm}×${s.width_cm}×${s.height_cm} cm`],
                                ['Packages', `${s.n_packages} ${s.pkg_type}`],
                                ['Line Items', s.line_items],
                                ['Cost/KG', c ? '₹' + (c.total_cost / s.gross_weight).toFixed(2) : '—'],
                              ].map(([l, v]) => (
                                <div key={String(l)} className="detail-item">
                                  <label>{String(l)}</label>
                                  <span>{String(v)}</span>
                                </div>
                              ))}
                            </div>

                            {/* Node cost chips with override button */}
                            <div className="node-chips">
                              {NODES.map(n => {
                                const cost = c?.[`${n}_cost`] ?? 0
                                const src = c?.[`${n}_source`] ?? 'missing'
                                const total = c?.total_cost ?? 1
                                return (
                                  <div
                                    key={n}
                                    className="node-chip"
                                    style={{ background: NODE_COLORS[n] + '12', borderColor: NODE_COLORS[n] + '40' }}
                                  >
                                    <div className="node-chip-label" style={{ color: NODE_COLORS[n] }}>{NODE_LABELS[n]}</div>
                                    <div className="node-chip-val" style={{ color: 'var(--text)' }}>₹ {fmt(cost)}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                      <div className="node-chip-pct">{pct(cost, total)}</div>
                                      <span className={`badge src-${src}`} style={{ fontSize: 8, padding: '0 4px' }}>{src}</span>
                                    </div>
                                    <button
                                      className="btn-ghost"
                                      style={{ marginTop: 4, padding: '2px 6px', fontSize: 9 }}
                                      onClick={e => { e.stopPropagation(); setOverrideModal({ awb: s.awb, node: n }); setOverrideForm({ cost: String(cost), reason: '', updatedBy: '' }) }}
                                    >
                                      Override
                                    </button>
                                    {src === 'override' && (
                                      <button
                                        className="btn-danger"
                                        style={{ marginTop: 2, padding: '2px 6px', fontSize: 9 }}
                                        onClick={e => { e.stopPropagation(); removeOverride(s.awb, n) }}
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Override Modal */}
      {overrideModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setOverrideModal(null) }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                Override — {overrideModal.awb} / {NODE_LABELS[overrideModal.node]}
              </div>
              <button className="btn-ghost" onClick={() => setOverrideModal(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="field-label">Override Cost (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={overrideForm.cost}
                  onChange={e => setOverrideForm(f => ({ ...f, cost: e.target.value }))}
                  placeholder="Enter cost in ₹"
                />
              </div>
              <div>
                <label className="field-label">Reason</label>
                <select value={overrideForm.reason} onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}>
                  <option value="">— Select reason —</option>
                  <option>Airline Billing Adjustment</option>
                  <option>Manual Correction</option>
                  <option>Negotiated Rate</option>
                  <option>Missing Manifest</option>
                  <option>Rate Card Exception</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="field-label">Updated By</label>
                <input
                  value={overrideForm.updatedBy}
                  onChange={e => setOverrideForm(f => ({ ...f, updatedBy: e.target.value }))}
                  placeholder="Your name / email"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setOverrideModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={applyOverride}>Apply Override</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast success">✓ {toast}</div>}
    </main>
  )
}
