'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'

const REQUIRED_COLS = [
  { col: 'awb', ex: 'XD-2503-001', note: 'Unique shipment ID' },
  { col: 'pickup date', ex: '2025-03-10', note: 'YYYY-MM-DD' },
  { col: 'service node', ex: 'Jaipur PC', note: 'Must match Pickup master' },
  { col: 'hub name', ex: 'Delhi Hub', note: 'Must match Hub master' },
  { col: 'package type', ex: 'box / flyer', note: '' },
  { col: 'no of packages', ex: '3', note: 'Integer' },
  { col: 'length cm', ex: '40', note: '' },
  { col: 'breadth cm', ex: '30', note: '' },
  { col: 'height cm', ex: '20', note: '' },
  { col: 'gross weight', ex: '12.5', note: 'KG' },
]
const OPTIONAL_COLS = ['manifest no', 'manifest date', 'flight no', 'mawb', 'mawb date', 'port of origin', 'oc clearance type', 'oc vendor', 'dest clearance type', 'service type', 'point of entry', 'injection port', 'country', 'line items', 'lm carrier', 'shipping method', 'dest zip']

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

export default function UploadPage() {
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportPeriod, setExportPeriod] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const downloadExport = () => {
    const params = new URLSearchParams()
    if (exportPeriod) {
      if (exportPeriod.includes('W')) params.set('week', exportPeriod)
      else params.set('month', exportPeriod)
    }
    window.open('/api/export?' + params, '_blank')
  }

  const upload = async (file: File) => {
    setUploading(true)
    setResult(null)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: form })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'Upload failed'); setUploading(false); return }
      setResult(j)
    } catch (e) {
      setError(String(e))
    }
    setUploading(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) upload(f)
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
          <Link key={id} href={href} className={`nav-link${id === 'upload' ? ' active' : ''}`}>{label}</Link>
        ))}
      </nav>

      <div className="page">
        <div className="page-title">Upload Shipment Data</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 20 }}>

          {/* Upload zone */}
          <div>
            <div
              className={`upload-zone${drag ? ' drag' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className="upload-zone-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="4" y="8" width="32" height="26" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M14 20l6-6 6 6M20 14v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="upload-zone-text">
                {uploading ? 'Uploading & computing costs…' : 'Drop XLSX or CSV file here'}
              </div>
              <div className="upload-zone-sub">or click to browse</div>
              <input
                ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
              />
            </div>

            {uploading && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--amber-dim)', border: '1px solid var(--amber)', borderRadius: 8, fontSize: 12, color: 'var(--amber)' }}>
                ⟳ Parsing file → Creating shipments → Running 9-node cost engine…
              </div>
            )}

            {error && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#f8717115', border: '1px solid #f8717140', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
                ✗ {error}
              </div>
            )}

            {result && !uploading && (
              <div style={{ marginTop: 16, padding: 18, background: '#34d39912', border: '1px solid #34d39940', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)', marginBottom: 12 }}>✓ Upload complete</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Box rows parsed', result.uploaded_box_rows ?? result.uploaded],
                    ['Shipments created', result.shipments_created ?? result.costs_computed],
                    ['Costs computed', result.costs_computed ?? result.computed],
                    ['Total cost ₹', fmt(result.total_cost)],
                    ['Avg / shipment ₹', fmt(result.avg_cost_per_shipment ?? 0)],
                    ['Parse errors', result.parse_errors?.length ?? 0],
                  ].map(([l, v]) => (
                    <div key={String(l)}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{l}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
                {result.column_sample?.length > 0 && (
                  <div style={{ marginBottom: 12, padding: '8px 10px', background: '#1a2d44', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>COLUMNS DETECTED IN FILE</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {result.column_sample.map((c: string) => (
                        <span key={c} style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--amber)', background: '#f59e0b12', padding: '2px 6px', borderRadius: 3 }}>{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {result.parse_errors?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>PARSE ERRORS</div>
                    {result.parse_errors.map((e: string, i: number) => (
                      <div key={i} style={{ fontSize: 11, color: '#f59e0b', padding: '2px 0' }}>• {e}</div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <Link href="/shipments" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                    View Shipments →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Column guide */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/api/template" className="btn-primary" style={{ textDecoration: 'none', flex: 1, textAlign: 'center' }}>
                ↓ Download Upload Template
              </a>
            </div>

            <div className="card">
              <div className="card-title">Required Columns</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Column</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Example</th>
                  </tr>
                </thead>
                <tbody>
                  {REQUIRED_COLS.map(({ col, ex, note }) => (
                    <tr key={col}>
                      <td style={{ padding: '5px 0', borderBottom: '1px solid #0c1624' }}>
                        <code style={{ color: 'var(--amber)', fontFamily: 'monospace', fontSize: 11 }}>{col}</code>
                        {note && <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 6 }}>{note}</span>}
                      </td>
                      <td style={{ padding: '5px 6px', borderBottom: '1px solid #0c1624', color: 'var(--text-soft)', fontSize: 11 }}>{ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-title">Optional Columns</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {OPTIONAL_COLS.map(c => (
                  <span key={c} style={{ background: '#1a2d44', color: 'var(--text-muted)', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontFamily: 'monospace', border: '1px solid var(--border)' }}>{c}</span>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Export Cost Report</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="field-label">Period</label>
                  <input value={exportPeriod} onChange={e => setExportPeriod(e.target.value)} placeholder="2025-W12  or  2025-03  (blank = all)" />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn-primary" onClick={downloadExport}>↓ XLSX</button>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                3 sheets: Full Breakdown · Weekly Summary · Node Distribution
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
