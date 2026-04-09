'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const NODE_COLORS: Record<string, string> = {
  pickup: '#f59e0b', fm: '#22d3ee', hub: '#a78bfa', oc: '#34d399',
  mm: '#60a5fa', dh: '#fb923c', dc_clearance: '#f472b6', dropoff: '#e879f9', lm: '#f87171',
}
const NODE_LABELS: Record<string, string> = {
  pickup: 'Pickup', fm: 'First Mile', hub: 'Hub', oc: 'Origin Customs',
  mm: 'Middle Mile', dh: 'Dest. Handling', dc_clearance: 'Dest. Clearance', dropoff: 'Drop-Off', lm: 'Last Mile',
}

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n ?? 0))
const fmt2 = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n ?? 0)

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/dashboard?weeks=8')
      const text = await r.text()
      if (text.trim()) setData(JSON.parse(text))
    } catch (e) { console.error('Dashboard load error:', e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const recompute = async () => {
    setComputing(true)
    try {
      const r = await fetch('/api/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const j = await r.json()
      showToast(`Recomputed ${j.count} shipments — Total ₹${fmt(j.summary?.total)}`)
      load()
    } catch { showToast('Compute failed', 'error') }
    setComputing(false)
  }

  if (loading) return (
    <main>
      <Nav active="dashboard" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--amber)' }}>
        Loading cost data…
      </div>
    </main>
  )

  const kpis = data?.kpis ?? {}
  const weekly = data?.weekly ?? []
  const dist = data?.distribution ?? []
  const top10 = data?.top10 ?? []
  const srcBreak = data?.sourceBreakdown ?? {}

  const pieData = dist.filter((d: any) => d.cost > 0)

  return (
    <main>
      <Nav active="dashboard" onRecompute={recompute} computing={computing} />
      <div className="page">

        {/* KPIs */}
        <div className="kpi-grid">
          {[
            { label: 'Total Cost (All Nodes)', value: '₹ ' + fmt(kpis.totalCost), sub: `${kpis.count ?? 0} shipments` },
            { label: 'Avg Cost / Shipment', value: '₹ ' + fmt(kpis.avgCostPerShipment), sub: 'across all 9 nodes' },
            { label: 'Avg Cost / KG', value: '₹ ' + fmt2(kpis.avgCostPerKg), sub: 'blended all-in rate' },
            { label: 'Total Weight', value: fmt(kpis.totalWeight) + ' kg', sub: `last 8 weeks` },
          ].map((k, i) => (
            <div key={i} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid-2">
          <div className="card">
            <div className="card-title">Weekly Cost by Node (₹)</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weekly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#1a2d44" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#3d5a74', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3d5a74', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => '₹' + fmt(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: '#0d1626', border: '1px solid #1a2d44', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: '#e8f0f8', fontWeight: 600 }}
                  formatter={(v: number, n: string) => ['₹ ' + fmt(v), NODE_LABELS[n] ?? n]}
                />
                <Legend iconSize={8} iconType="square" wrapperStyle={{ fontSize: 10, paddingTop: 6 }} formatter={n => NODE_LABELS[n] ?? n} />
                {Object.keys(NODE_COLORS).map(n => <Bar key={n} dataKey={n} stackId="a" fill={NODE_COLORS[n]} name={n} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Cost Distribution</div>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={pieData} dataKey="cost" cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={2}>
                  {pieData.map((e: any, i: number) => <Cell key={i} fill={NODE_COLORS[Object.keys(NODE_LABELS).find(k => NODE_LABELS[k] === e.node) ?? ''] ?? '#888'} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0d1626', border: '1px solid #1a2d44', borderRadius: 6, fontSize: 11 }} formatter={(v: number) => ['₹ ' + fmt(v)]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {pieData.sort((a: any, b: any) => b.cost - a.cost).map((p: any) => {
                const nodeKey = Object.keys(NODE_LABELS).find(k => NODE_LABELS[k] === p.node) ?? ''
                const total = pieData.reduce((a: number, x: any) => a + x.cost, 0)
                return (
                  <div key={p.node} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: NODE_COLORS[nodeKey], display: 'inline-block' }} />
                      <span style={{ color: 'var(--text-soft)' }}>{p.node}</span>
                    </span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>
                      ₹{fmt(p.cost)} <span style={{ color: 'var(--text-muted)' }}>({total ? ((p.cost / total) * 100).toFixed(1) : 0}%)</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid-2-eq">
          {/* Top shipments */}
          <div className="card">
            <div className="card-title">Top 10 Shipments by Cost</div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>AWB</th><th>Date</th><th>Hub</th><th>Carrier</th>
                  <th className="r">Weight</th><th className="r">Total ₹</th>
                </tr></thead>
                <tbody>
                  {top10.map((s: any) => (
                    <tr key={s.awb}>
                      <td className="h">{s.awb}</td>
                      <td>{new Date(s.pickup_date).toLocaleDateString('en-IN')}</td>
                      <td>{s.hub_name}</td>
                      <td>{s.lm_carrier ?? '—'}</td>
                      <td className="r">{s.gross_weight} kg</td>
                      <td className="ra">{fmt(s.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Weekly summary + source breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ flex: 1 }}>
              <div className="card-title">Weekly Summary</div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Week</th><th className="r">Ships</th>
                    <th className="r">Weight</th><th className="r">Total ₹</th><th className="r">₹/kg</th>
                  </tr></thead>
                  <tbody>
                    {weekly.map((w: any) => (
                      <tr key={w.week}>
                        <td className="h">{w.week}</td>
                        <td className="r">{w.count}</td>
                        <td className="r">{fmt(w.weight)} kg</td>
                        <td className="ra">{fmt(w.total)}</td>
                        <td className="r">{w.weight ? fmt2(w.total / w.weight) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Cost Source Breakdown</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(srcBreak).map(([src, count]) => (
                  <div key={src} style={{ textAlign: 'center' }}>
                    <div className={`badge src-${src}`}>{src}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{count as number}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>nodes</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast ${toast.type}`}>
          <span style={{ color: toast.type === 'success' ? 'var(--green)' : 'var(--red)' }}>
            {toast.type === 'success' ? '✓' : '✗'}
          </span>
          {toast.msg}
        </div>
      )}
    </main>
  )
}

function Nav({ active, onRecompute, computing }: { active: string; onRecompute?: () => void; computing?: boolean }) {
  return (
    <nav className="nav">
      <div className="nav-logo">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <polygon points="10,1 18.5,5.5 18.5,14.5 10,19 1.5,14.5 1.5,5.5" stroke="#f59e0b" strokeWidth="1.5" fill="#f59e0b18" />
          <circle cx="10" cy="10" r="2.8" fill="#f59e0b" />
        </svg>
        Xindus OS <span>/ Cost Engine</span>
      </div>
      {[['/', 'Dashboard', 'dashboard'], ['/shipments', 'Shipments', 'shipments'], ['/master', 'Master Data', 'master'], ['/upload', 'Upload', 'upload']].map(([href, label, id]) => (
        <Link key={id} href={href} className={`nav-link${active === id ? ' active' : ''}`}>{label}</Link>
      ))}
      <div className="nav-end">
        {onRecompute && (
          <button className="btn-primary" onClick={onRecompute} disabled={computing}>
            {computing ? '⟳ Computing…' : '↻ Recompute All'}
          </button>
        )}
        <a href="/api/export" className="btn-ghost" style={{ textDecoration: 'none' }}>↓ Export</a>
      </div>
    </nav>
  )
}
