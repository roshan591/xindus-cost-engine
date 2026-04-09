'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const NODES = ['pickup','fm','hub','oc','mm','dh','dc_clearance','dropoff','lm'] as const
const NODE_LABELS: Record<string,string> = {
  pickup:'Pickup', fm:'First Mile', hub:'Hub', oc:'Origin Customs',
  mm:'Middle Mile', dh:'Dest. Handling', dc_clearance:'Dest. Clearance',
  dropoff:'Drop-Off', lm:'Last Mile',
}
const NODE_COLORS: Record<string,string> = {
  pickup:'#f59e0b', fm:'#22d3ee', hub:'#a78bfa', oc:'#34d399',
  mm:'#60a5fa', dh:'#fb923c', dc_clearance:'#f472b6', dropoff:'#e879f9', lm:'#f87171',
}
const fmt = (n: number) => new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(Math.round(n??0))
const pct = (n: number, t: number) => t ? ((n/t)*100).toFixed(1)+'%' : '—'
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-logo">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <polygon points="10,1 18.5,5.5 18.5,14.5 10,19 1.5,14.5 1.5,5.5" stroke="#f59e0b" strokeWidth="1.5" fill="#f59e0b18"/>
          <circle cx="10" cy="10" r="2.8" fill="#f59e0b"/>
        </svg>
        Xindus OS <span>/ Cost Engine</span>
      </div>
      {[['/', 'Dashboard','dashboard'],['/shipments','Shipments','shipments'],['/master','Master Data','master'],['/upload','Upload','upload']].map(([href,label,id]) => (
        <Link key={id} href={href} className={`nav-link${id==='shipments'?' active':''}`}>{label}</Link>
      ))}
    </nav>
  )
}

export default function ShipmentDetailPage() {
  const params = useParams<{ awb: string }>()
  const router = useRouter()
  const awb = decodeURIComponent(params.awb)

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [overrideNode, setOverrideNode] = useState<string|null>(null)
  const [overrideForm, setOverrideForm] = useState({ cost:'', reason:'', updatedBy:'' })
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/shipments/${encodeURIComponent(awb)}`)
    if (r.ok) setData(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [awb])

  const showToast = (msg:string, type:'success'|'error'='success') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3000)
  }

  const applyOverride = async () => {
    if (!overrideNode) return
    const r = await fetch(`/api/shipments/${encodeURIComponent(awb)}/override`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        node: overrideNode,
        override_flag: true,
        override_cost: parseFloat(overrideForm.cost),
        override_reason: overrideForm.reason,
        updated_by: overrideForm.updatedBy,
      }),
    })
    if (r.ok) { showToast(`Override applied for ${NODE_LABELS[overrideNode]}`); setOverrideNode(null); load() }
    else showToast('Override failed','error')
  }

  const removeOverride = async (node:string) => {
    await fetch(`/api/shipments/${encodeURIComponent(awb)}/override`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ node, override_flag:false }),
    })
    showToast('Override removed'); load()
  }

  const deleteShipment = async () => {
    if (!confirm(`Delete shipment ${awb}? This cannot be undone.`)) return
    setDeleting(true)
    const r = await fetch(`/api/shipments/${encodeURIComponent(awb)}`,{ method:'DELETE' })
    if (r.ok) router.push('/shipments')
    else { showToast('Delete failed','error'); setDeleting(false) }
  }

  if (loading) return (
    <main><Nav/>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',color:'var(--amber)'}}>
        Loading shipment…
      </div>
    </main>
  )

  if (!data) return (
    <main><Nav/>
      <div className="page">
        <div style={{color:'var(--red)',marginTop:40}}>Shipment {awb} not found.</div>
        <Link href="/shipments" className="btn-ghost" style={{marginTop:12,display:'inline-block',textDecoration:'none'}}>← Back to Shipments</Link>
      </div>
    </main>
  )

  const s = data.shipment
  const nc = data.nodeCosts
  const overrides: any[] = s.overrides ?? []

  const fields = [
    ['AWB', s.awb],['Pickup Date', fmtDate(s.pickup_date)],['Service Node', s.service_node],
    ['Hub', s.hub_name],['Package Type', s.pkg_type],['Packages', s.n_packages],
    ['Dimensions', `${s.length_cm} × ${s.width_cm} × ${s.height_cm} cm`],
    ['Gross Weight', `${s.gross_weight} kg`],['Line Items', s.line_items],
    ['Manifest No', s.pc_to_hub??'—'],['Flight No', s.pc_to_hub_flight_no??'—'],
    ['MAWB', s.mawb??'—'],['MAWB Date', s.mawb_date?fmtDate(s.mawb_date):'—'],
    ['Port of Origin', s.port_of_origin??'—'],['OC Type', s.clearance_type_oc??'—'],
    ['OC Vendor', s.oc_vendor??'—'],['Entry Port', s.point_of_entry??'—'],
    ['DC Type', s.dest_clearance_type??'—'],['Service Type', s.service_type??'—'],
    ['DC Partner', s.dc_partner??'—'],['Country', s.country??'—'],
    ['LM Carrier', s.lm_carrier??'—'],['Shipping Method', s.lm_shipping_method??'—'],
    ['Dest ZIP', s.dest_zip??'—'],
  ]

  return (
    <main>
      <Nav/>
      <div className="page">

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <Link href="/shipments" style={{color:'var(--text-muted)',textDecoration:'none',fontSize:12}}>← Shipments</Link>
            <div style={{fontSize:18,fontWeight:700,color:'var(--text)'}}>{s.awb}</div>
            <span className={`badge pkg-${s.pkg_type}`}>{s.pkg_type}</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            <a href={`/api/export?week=${getWeek(s.pickup_date)}`} className="btn-ghost" style={{textDecoration:'none'}}>↓ Export Week</a>
            <button className="btn-danger" onClick={deleteShipment} disabled={deleting}>{deleting?'Deleting…':'Delete'}</button>
          </div>
        </div>

        <div className="grid-2">

          {/* Left: Details + Costs */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>

            {/* Total cost hero */}
            {nc && (
              <div className="card" style={{background:'linear-gradient(135deg,#0d1626 0%,#0f1e36 100%)',border:'1px solid #1a3050'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                  <div>
                    <div className="kpi-label">Total Cost</div>
                    <div style={{fontSize:28,fontWeight:700,color:'var(--amber)'}}>₹ {fmt(nc.total)}</div>
                    <div className="kpi-sub">all 9 nodes</div>
                  </div>
                  <div>
                    <div className="kpi-label">Cost per KG</div>
                    <div style={{fontSize:24,fontWeight:700,color:'var(--text)'}}>₹ {nc.cost_per_kg.toFixed(2)}</div>
                    <div className="kpi-sub">{s.gross_weight} kg gross</div>
                  </div>
                  <div>
                    <div className="kpi-label">Last Computed</div>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--text-soft)',marginTop:4}}>{fmtDate(nc.computed_at)}</div>
                    <div className="kpi-sub">auto-recomputed weekly</div>
                  </div>
                </div>
              </div>
            )}

            {/* Node cost breakdown */}
            {nc && (
              <div className="card">
                <div className="card-title">Node Cost Breakdown</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {NODES.map(n => {
                    const cost = nc[n]?.cost ?? 0
                    const src  = nc[n]?.source ?? 'missing'
                    const ov   = overrides.find((o:any) => o.node===n && o.override_flag)
                    return (
                      <div key={n} style={{
                        display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
                        background: NODE_COLORS[n]+'10', borderRadius:6,
                        border:`1px solid ${NODE_COLORS[n]}28`,
                      }}>
                        <div style={{width:3,height:32,borderRadius:2,background:NODE_COLORS[n],flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:500,color:NODE_COLORS[n]}}>{NODE_LABELS[n]}</div>
                          <div style={{fontSize:9,color:'var(--text-muted)'}}>
                            {pct(cost,nc.total)} of total · <span className={`badge src-${src}`} style={{fontSize:8,padding:'0 4px'}}>{src}</span>
                          </div>
                        </div>
                        {/* Cost bar */}
                        <div style={{width:100,height:4,background:'#1a2d44',borderRadius:2,flexShrink:0}}>
                          <div style={{width:pct(cost,nc.total),height:'100%',background:NODE_COLORS[n],borderRadius:2}}/>
                        </div>
                        <div style={{fontFamily:'monospace',fontSize:13,fontWeight:600,color:'var(--text)',minWidth:80,textAlign:'right'}}>
                          ₹ {fmt(cost)}
                        </div>
                        <div style={{display:'flex',gap:4,flexShrink:0}}>
                          {ov ? (
                            <button className="btn-danger" style={{fontSize:9,padding:'2px 7px'}}
                              onClick={()=>removeOverride(n)}>Remove Override</button>
                          ) : (
                            <button className="btn-ghost" style={{fontSize:9,padding:'2px 7px'}}
                              onClick={()=>{setOverrideNode(n);setOverrideForm({cost:String(cost),reason:'',updatedBy:''})}}>
                              Override
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Shipment details + override history */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="card">
              <div className="card-title">Shipment Details</div>
              <div style={{display:'flex',flexDirection:'column',gap:0}}>
                {fields.map(([l,v]) => (
                  <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #0c1624'}}>
                    <span style={{fontSize:11,color:'var(--text-muted)'}}>{l}</span>
                    <span style={{fontSize:11,color:'var(--text)',fontWeight:500}}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            {overrides.length > 0 && (
              <div className="card">
                <div className="card-title">Override Audit Trail ({overrides.length})</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {overrides.map((ov:any) => (
                    <div key={ov.id} style={{
                      padding:'8px 10px', borderRadius:6,
                      background: ov.override_flag ? '#f8717112' : '#34d39912',
                      border: `1px solid ${ov.override_flag ? '#f8717130' : '#34d39930'}`,
                      fontSize:11,
                    }}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontWeight:600,color:'var(--text)'}}>{NODE_LABELS[ov.node] ?? ov.node}</span>
                        <span style={{color:'var(--text-muted)'}}>{new Date(ov.updated_at).toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{color:'var(--text-soft)'}}>
                        {ov.override_flag
                          ? `Override: ₹${fmt(ov.override_cost ?? 0)} (was ₹${fmt(ov.prev_cost ?? 0)})`
                          : 'Override removed'}
                        {ov.override_reason && <span style={{color:'var(--text-muted)',marginLeft:8}}>· {ov.override_reason}</span>}
                      </div>
                      {ov.updated_by && <div style={{color:'var(--text-muted)',marginTop:2}}>by {ov.updated_by}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Override modal */}
      {overrideNode && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setOverrideNode(null)}}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Override — {NODE_LABELS[overrideNode]}</div>
              <button className="btn-ghost" onClick={()=>setOverrideNode(null)}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label className="field-label">Override Cost (₹)</label>
                <input type="number" min="0" step="0.01"
                  value={overrideForm.cost}
                  onChange={e=>setOverrideForm(f=>({...f,cost:e.target.value}))}
                  placeholder="Enter cost in ₹"/>
              </div>
              <div>
                <label className="field-label">Reason</label>
                <select value={overrideForm.reason} onChange={e=>setOverrideForm(f=>({...f,reason:e.target.value}))}>
                  <option value="">— Select —</option>
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
                <input value={overrideForm.updatedBy}
                  onChange={e=>setOverrideForm(f=>({...f,updatedBy:e.target.value}))}
                  placeholder="Your name"/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={()=>setOverrideNode(null)}>Cancel</button>
              <button className="btn-primary" onClick={applyOverride}>Apply Override</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.type==='success'?'✓':'✗'} {toast.msg}</div>}
    </main>
  )
}

function getWeek(dateStr: string) {
  const d = new Date(dateStr)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const wk = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(wk).padStart(2,'0')}`
}
