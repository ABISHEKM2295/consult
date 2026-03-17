import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Lock, CheckCircle, XCircle, RefreshCw, FlaskConical, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import './LabDip.css';

/* ── CIEDE2000 ΔE calculator (client-side) ─────────────────── */
function deg(r) { return (r * 180) / Math.PI; }
function rad(d) { return (d * Math.PI) / 180; }

function ciede2000(L1, a1, b1, L2, a2, b2) {
  const kL = 1, kC = 1, kH = 1;
  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1*a1 + b1*b1);
  const C2 = Math.sqrt(a2*a2 + b2*b2);
  const avgC = (C1 + C2) / 2;
  const avgC7 = Math.pow(avgC, 7);
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p*a1p + b1*b1);
  const C2p = Math.sqrt(a2p*a2p + b2*b2);
  const h1p = b1 === 0 && a1p === 0 ? 0 : (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p = b2 === 0 && a2p === 0 ? 0 : (deg(Math.atan2(b2, a2p)) + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(dhp) <= 180) dhp = dhp;
  else if (dhp > 180) dhp -= 360;
  else dhp += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const avgLp = (L1 + L2) / 2;
  const avgCp = (C1p + C2p) / 2;
  let avgHp;
  if (C1p * C2p === 0) avgHp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) avgHp = (h1p + h2p) / 2;
  else avgHp = (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
  const T = 1 - 0.17*Math.cos(rad(avgHp - 30)) + 0.24*Math.cos(rad(2*avgHp)) + 0.32*Math.cos(rad(3*avgHp + 6)) - 0.20*Math.cos(rad(4*avgHp - 63));
  const avgLpOff = avgLp - 50;
  const SL = 1 + 0.015*(avgLpOff*avgLpOff) / Math.sqrt(20 + avgLpOff*avgLpOff);
  const SC = 1 + 0.045*avgCp;
  const SH = 1 + 0.015*avgCp*T;
  const dTheta = 30 * Math.exp(-(((avgHp-275)/25)*((avgHp-275)/25)));
  const avgCp7   = Math.pow(avgCp, 7);
  const RC = 2 * Math.sqrt(avgCp7 / (avgCp7 + Math.pow(25, 7)));
  const RT = -Math.sin(rad(2*dTheta)) * RC;
  return Math.sqrt(
    (dLp/(kL*SL))*(dLp/(kL*SL)) +
    (dCp/(kC*SC))*(dCp/(kC*SC)) +
    (dHp/(kH*SH))*(dHp/(kH*SH)) +
    RT*(dCp/(kC*SC))*(dHp/(kH*SH))
  );
}

/* ── Lab → approximate hex swatch ─────────────────────────── */
function labToHex(L, a, b) {
  // L*a*b* → XYZ → sRGB (D65)
  let fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const x = (fx**3 > 0.008856 ? fx**3 : (fx - 16/116)/7.787) * 0.95047;
  const y = (fy**3 > 0.008856 ? fy**3 : (fy - 16/116)/7.787);
  const z = (fz**3 > 0.008856 ? fz**3 : (fz - 16/116)/7.787) * 1.08883;
  let r =  3.2406*x - 1.5372*y - 0.4986*z;
  let g = -0.9689*x + 1.8758*y + 0.0415*z;
  let bv = 0.0557*x - 0.2040*y + 1.0570*z;
  const gamma = v => v > 0.0031308 ? 1.055*v**(1/2.4) - 0.055 : 12.92*v;
  r = Math.round(Math.min(1, Math.max(0, gamma(r))) * 255);
  g = Math.round(Math.min(1, Math.max(0, gamma(g))) * 255);
  b = Math.round(Math.min(1, Math.max(0, gamma(bv))) * 255);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

const STATUS_CONFIG = {
  pending:      { label:'Pending',     cls:'lab-pending',  color:'#f59e0b' },
  client_review:{ label:'Sent to Client', cls:'lab-review', color:'#6366f1' },
  approved:     { label:'Approved',    cls:'lab-approved', color:'#10b981' },
  rejected:     { label:'Rejected',    cls:'lab-rejected', color:'#ef4444' },
  locked:       { label:'🔒 Locked',   cls:'lab-locked',   color:'#1e3a5f' },
};

const LabDip = () => {
  const [orders,  setOrders]  = useState([]);
  const [dips,    setDips]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('');     // filter by orderId
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ orderId:'', colorHex:'#888888', notes:'', targetL:'',targetA:'',targetB:'', actualL:'',actualA:'',actualB:'', dyes:[{name:'',qty:''}], chemicals:[{name:'',qty:''}] });

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [o, d] = await Promise.all([api.getOrders(), api.getLabDips()]);
      setOrders(o); setDips(d);
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const shownDips = filter ? dips.filter(d => d.orderId?._id === filter || d.orderId === filter) : dips;

  const handleCreate = async (e) => {
    e.preventDefault();
    const tL=parseFloat(form.targetL), tA=parseFloat(form.targetA), tB=parseFloat(form.targetB);
    const aL=parseFloat(form.actualL), aA=parseFloat(form.actualA), aB=parseFloat(form.actualB);
    const de = (!isNaN(tL)&&!isNaN(aL)) ? +ciede2000(tL,tA,tB,aL,aA,aB).toFixed(2) : null;
    const payload = {
      orderId: form.orderId,
      recipe:  { dyes: form.dyes.filter(d=>d.name), chemicals: form.chemicals.filter(c=>c.name) },
      targetLab: { L:tL, a:tA, b:tB },
      labResult: { L:aL, a:aA, b:aB, deltaE: de },
      colorHex: form.actualL ? labToHex(aL,aA,aB) : form.colorHex,
      notes: form.notes,
    };
    try {
      const nd = await api.createLabDip(payload);
      setDips(prev => [nd, ...prev]);
      setShowModal(false);
    } catch(e){ alert(e.message); }
  };

  const handleApprove = async (dip) => {
    try {
      const u = await api.approveLabDip(dip._id, { feedback:'Approved' });
      setDips(prev => prev.map(d => d._id===u._id ? u : d));
    } catch(e){ alert(e.message); }
  };

  const handleReject = async (dip) => {
    const fb = prompt('Feedback for client (reason for rejection):');
    if (!fb) return;
    try {
      const u = await api.rejectLabDip(dip._id, { feedback: fb });
      setDips(prev => prev.map(d => d._id===u._id ? u : d));
    } catch(e){ alert(e.message); }
  };

  const handleLock = async (dip) => {
    if (!window.confirm(`Lock "${dip.orderNo}" Attempt #${dip.attemptNo} as the production recipe?`)) return;
    try {
      const u = await api.lockLabDip(dip._id);
      setDips(prev => prev.map(d => d._id===u._id ? u : d));
    } catch(e){ alert(e.message); }
  };

  return (
    <div className="labdip-page">
      <div className="page-header">
        <div>
          <h1>Lab Dip Management</h1>
          <p className="page-subtitle">Color matching attempts, recipes, and client approval workflow</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="refresh-btn-m" onClick={fetchData}><RefreshCw size={15}/></button>
          <button className="add-job-button" onClick={() => setShowModal(true)}><Plus size={18}/> New Lab Dip</button>
        </div>
      </div>

      {error && <div className="error-banner-m"><AlertTriangle size={16}/> {error}</div>}

      {/* Order filter */}
      <div className="labdip-filters">
        <label>Filter by Order:</label>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Orders</option>
          {orders.map(o => <option key={o._id} value={o._id}>{o.orderNo} — {o.clientName} ({o.targetColor})</option>)}
        </select>
      </div>

      {/* Dip cards */}
      {loading ? (
        <div style={{padding:24}}>Loading…</div>
      ) : shownDips.length === 0 ? (
        <div className="labdip-empty"><FlaskConical size={40}/><p>No lab dips yet. Click "New Lab Dip" to start.</p></div>
      ) : (
        <div className="labdip-grid">
          {shownDips.map(dip => {
            const sc = STATUS_CONFIG[dip.status] || STATUS_CONFIG.pending;
            const tHex = dip.targetLab?.L != null ? labToHex(dip.targetLab.L, dip.targetLab.a, dip.targetLab.b) : '#cccccc';
            const aHex = dip.colorHex || '#888888';
            const de = dip.labResult?.deltaE;
            const dePass = de != null && de <= 2.0;
            return (
              <div key={dip._id} className={`labdip-card ${dip.status==='locked'?'locked':''}`}>
                <div className="labdip-card-header">
                  <div className="labdip-order-info">
                    <span className="labdip-order-no">{dip.orderNo || '—'}</span>
                    <span className="labdip-attempt">Attempt #{dip.attemptNo}</span>
                  </div>
                  <span className={`labdip-status ${sc.cls}`} style={{color: sc.color}}>{sc.label}</span>
                </div>

                {/* Color swatches */}
                <div className="labdip-swatches">
                  <div className="swatch-pair">
                    <div className="color-swatch" style={{background: tHex}} />
                    <span>Target</span>
                  </div>
                  <div className="swatch-arrow">→</div>
                  <div className="swatch-pair">
                    <div className="color-swatch" style={{background: aHex}} />
                    <span>Actual</span>
                  </div>
                </div>

                {/* ΔE */}
                {de != null && (
                  <div className={`labdip-delta ${dePass?'delta-pass':'delta-fail'}`}>
                    ΔE = {de.toFixed(2)} — {dePass ? '✓ Within tolerance' : '✗ Out of tolerance'}
                  </div>
                )}

                {/* Recipe summary */}
                {dip.recipe?.dyes?.length > 0 && (
                  <div className="labdip-recipe-summary">
                    {dip.recipe.dyes.slice(0,3).map((d,i) => (
                      <span key={i} className="recipe-chip">{d.name} {d.qty}</span>
                    ))}
                    {dip.recipe.dyes.length > 3 && <span className="recipe-chip">+{dip.recipe.dyes.length-3} more</span>}
                  </div>
                )}

                {dip.clientFeedback && <p className="labdip-feedback">💬 {dip.clientFeedback}</p>}

                {/* Actions */}
                <div className="labdip-actions">
                  {dip.status === 'pending' && (
                    <>
                      <button className="action-btn-lab approve" onClick={() => handleApprove(dip)}><CheckCircle size={14}/> Approve</button>
                      <button className="action-btn-lab reject"  onClick={() => handleReject(dip)}><XCircle size={14}/> Reject</button>
                    </>
                  )}
                  {dip.status === 'approved' && (
                    <button className="action-btn-lab lock" onClick={() => handleLock(dip)}><Lock size={14}/> Lock for Production</button>
                  )}
                  {dip.status === 'locked' && (
                    <div className="locked-badge">🔒 Locked for Production</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Lab Dip Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="labdip-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-bh">
              <h2>New Lab Dip</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={22}/></button>
            </div>
            <form className="labdip-form" onSubmit={handleCreate}>
              <div className="form-group">
                <label>Order *</label>
                <select value={form.orderId} onChange={e => setForm(p=>({...p,orderId:e.target.value}))} required>
                  <option value="">Select Order</option>
                  {orders.map(o => <option key={o._id} value={o._id}>{o.orderNo} — {o.clientName} ({o.targetColor})</option>)}
                </select>
              </div>

              <div className="labdip-lab-section">
                <p className="labdip-section-title">🎯 Target L*a*b*</p>
                <div className="lab-inputs">
                  {['targetL','targetA','targetB'].map((k,i) => (
                    <div key={k} className="form-group">
                      <label>{['L*','a*','b*'][i]}</label>
                      <input type="number" step="0.1" value={form[k]} onChange={e => setForm(p=>({...p,[k]:e.target.value}))} placeholder="0"/>
                    </div>
                  ))}
                </div>
                <p className="labdip-section-title">📊 Actual L*a*b* (Result)</p>
                <div className="lab-inputs">
                  {['actualL','actualA','actualB'].map((k,i) => (
                    <div key={k} className="form-group">
                      <label>{['L*','a*','b*'][i]}</label>
                      <input type="number" step="0.1" value={form[k]} onChange={e => setForm(p=>({...p,[k]:e.target.value}))} placeholder="0"/>
                    </div>
                  ))}
                </div>
                {form.targetL && form.actualL && (
                  <div className="labdip-live-delta">
                    Live ΔE: <strong>{ciede2000(parseFloat(form.targetL),parseFloat(form.targetA),parseFloat(form.targetB),parseFloat(form.actualL),parseFloat(form.actualA),parseFloat(form.actualB)).toFixed(2)}</strong>
                    <div className="swatch-preview">
                      <div style={{width:40,height:40,borderRadius:8,background:labToHex(parseFloat(form.targetL),parseFloat(form.targetA),parseFloat(form.targetB))}}/>
                      <span>→</span>
                      <div style={{width:40,height:40,borderRadius:8,background:labToHex(parseFloat(form.actualL),parseFloat(form.actualA),parseFloat(form.actualB))}}/>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} placeholder="Any observations…"/>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Save Lab Dip</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabDip;
