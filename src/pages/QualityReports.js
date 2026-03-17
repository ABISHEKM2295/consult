import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RotateCcw, FlaskConical } from 'lucide-react';
import './QualityReports.css';

/* ─────────────────────────────────────────────────────────────
   QUALITY REPORTS — ΔE-based analytics
   Pulls data from:
     • Color Inspections  (ΔE readings + grade + client result)
     • Orders            (re-dye, stage failures)
     • Lab Dips          (attempt counts, approval rate)
   ───────────────────────────────────────────────────────────── */

// Same grade system as ColorInspection.js
const GRADES = [
  { label:'A+', range:[0,   0.5],  color:'#059669', text:'Perfect' },
  { label:'A',  range:[0.5, 1.0],  color:'#10b981', text:'Excellent' },
  { label:'B',  range:[1.0, 2.0],  color:'#84cc16', text:'Good' },
  { label:'C',  range:[2.0, 3.0],  color:'#f59e0b', text:'Acceptable' },
  { label:'D',  range:[3.0, 4.5],  color:'#f97316', text:'Marginal' },
  { label:'F',  range:[4.5, 99],   color:'#ef4444', text:'Re-dye' },
];
const getGrade = de => GRADES.find(g => de >= g.range[0] && de < g.range[1]) || GRADES[GRADES.length-1];

const CLIENT_TOL = { Modenik:2.0, JG:3.0, LUX:3.0 };

// ── Raw inspection data (same as ColorInspection) ──────────────
const INSPECTIONS = [
  { date:'28/11/25', month:'Nov', color:'Navy',      client:'Modenik', lotNo:'12814/1/D', deltaE:3.5, recipe:'REC-001' },
  { date:'28/11/25', month:'Nov', color:'Olive',     client:'Modenik', lotNo:'111',       deltaE:0.6, recipe:'REC-002' },
  { date:'28/11/25', month:'Nov', color:'Poseidon',  client:'Modenik', lotNo:'109',       deltaE:3.3, recipe:null },
  { date:'28/11/25', month:'Nov', color:'Graphwine', client:'Modenik', lotNo:'109',       deltaE:0.9, recipe:null },
  { date:'29/11/25', month:'Nov', color:'Air Force', client:'JG',      lotNo:'371',       deltaE:3.1, recipe:null },
  { date:'29/11/25', month:'Nov', color:'Charcoal',  client:'JG',      lotNo:'371',       deltaE:3.8, recipe:'REC-003' },
  { date:'29/11/25', month:'Nov', color:'Dk. Brown', client:'JG',      lotNo:'375',       deltaE:null,recipe:null },
  { date:'29/11/25', month:'Nov', color:'DmnBlue',   client:'JG',      lotNo:'375',       deltaE:0.4, recipe:null },
  { date:'1/12/25',  month:'Dec', color:'Olive',     client:'LUX',     lotNo:'2003',      deltaE:null,recipe:null },
  { date:'1/12/25',  month:'Dec', color:'H. Orange', client:'LUX',     lotNo:'2002',      deltaE:3.1, recipe:'REC-004' },
  { date:'29/11/25', month:'Nov', color:'Air Force', client:'JG',      lotNo:'371',       deltaE:3.7, recipe:null },
  { date:'2/12/25',  month:'Dec', color:'Navy',      client:'Modenik', lotNo:'13145',     deltaE:1.2, recipe:'REC-001' },
  { date:'2/12/25',  month:'Dec', color:'Poseidon',  client:'JG',      lotNo:'109',       deltaE:1.8, recipe:null },
  { date:'3/12/25',  month:'Dec', color:'Olive',     client:'Modenik', lotNo:'13143',     deltaE:3.4, recipe:'REC-002' },
  { date:'3/12/25',  month:'Dec', color:'C. Brown',  client:'Modenik', lotNo:'112',       deltaE:0.9, recipe:null },
];

// ── Lab Dip stats (cross-linked) ───────────────────────────────
const LABDIP_STATS = [
  { ref:'LD-0023', color:'Navy Blue',   client:'Modenik', attempts:2, finalDE:1.2, approved:true  },
  { ref:'LD-0019', color:'Olive Green', client:'Modenik', attempts:1, finalDE:0.6, approved:true  },
  { ref:'LD-0031', color:'Charcoal',    client:'JG',      attempts:3, finalDE:3.5, approved:true  },
  { ref:'LD-0038', color:'H. Orange',   client:'LUX',     attempts:2, finalDE:3.1, approved:false },
];

// ── Re-dye incidents ───────────────────────────────────────────
const REDYE_LOG = [
  { date:'29/11/25', color:'Charcoal',  client:'JG',  lotNo:'371', originalDE:5.2, afterDE:3.8, reason:'Shade too light', cost:4200 },
  { date:'28/11/25', color:'Navy',      client:'Modenik',lotNo:'12814/1/D',originalDE:4.8, afterDE:3.5, reason:'Uneven dyeing — temperature fluctuation', cost:3800 },
  { date:'1/12/25',  color:'H. Orange', client:'LUX', lotNo:'2002', originalDE:4.2, afterDE:3.1, reason:'Wrong recipe dosage — increased Red 195', cost:2900 },
];

// ── Approval trend by date ─────────────────────────────────────
const TREND_DATA = [
  { date:'Nov 21', gradeA:3, gradeB:2, gradeC:1, gradeD:0, gradeF:0 },
  { date:'Nov 22', gradeA:2, gradeB:3, gradeC:2, gradeD:1, gradeF:0 },
  { date:'Nov 25', gradeA:4, gradeB:2, gradeC:1, gradeD:1, gradeF:0 },
  { date:'Nov 28', gradeA:2, gradeB:1, gradeC:2, gradeD:2, gradeF:1 },
  { date:'Nov 29', gradeA:3, gradeB:2, gradeC:1, gradeD:1, gradeF:1 },
  { date:'Dec 1',  gradeA:2, gradeB:3, gradeC:2, gradeD:0, gradeF:0 },
  { date:'Dec 2',  gradeA:3, gradeB:2, gradeC:1, gradeD:1, gradeF:0 },
  { date:'Dec 3',  gradeA:4, gradeB:2, gradeC:2, gradeD:0, gradeF:0 },
];

/* ── Main ────────────────────────────────────────────────────── */
const QualityReports = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const withDE = INSPECTIONS.filter(i => i.deltaE != null);

  // KPI calculations
  const avgDE = withDE.length
    ? (withDE.reduce((s,i) => s+i.deltaE,0) / withDE.length).toFixed(2)
    : '—';
  const passByTol = withDE.filter(i => i.deltaE <= (CLIENT_TOL[i.client]||3.0)).length;
  const passRate  = withDE.length ? Math.round(passRate2 => (passByTol/withDE.length)*100) : 0;
  const reDyeCount = REDYE_LOG.length;
  const totalReDyeCost = REDYE_LOG.reduce((s,r) => s+r.cost, 0);

  // passRate fix
  const passRatePct = withDE.length ? Math.round((passByTol/withDE.length)*100) : 0;

  // Grade distribution
  const gradeDist = GRADES.map(g => ({
    name: `Grade ${g.label}`,
    count: withDE.filter(i => { const gr = getGrade(i.deltaE); return gr.label === g.label; }).length,
    color: g.color, text: g.text,
  }));

  // Per-client breakdown
  const clientBreakdown = Object.entries(CLIENT_TOL).map(([client, tol]) => {
    const rows  = withDE.filter(i => i.client === client);
    const pass  = rows.filter(i => i.deltaE <= tol).length;
    const fail  = rows.filter(i => i.deltaE > tol).length;
    const avg   = rows.length ? (rows.reduce((s,i)=>s+i.deltaE,0)/rows.length).toFixed(2) : '—';
    const best  = rows.length ? Math.min(...rows.map(i=>i.deltaE)).toFixed(2) : '—';
    const worst = rows.length ? Math.max(...rows.map(i=>i.deltaE)).toFixed(2) : '—';
    return { client, tol, total:rows.length, pass, fail, avg, best, worst,
             passRate: rows.length ? Math.round((pass/rows.length)*100) : 0 };
  });

  // Color-wise worst performers (ΔE average by color)
  const byColor = {};
  withDE.forEach(i => {
    if (!byColor[i.color]) byColor[i.color] = { color:i.color, client:i.client, readings:[], recipe:i.recipe };
    byColor[i.color].readings.push(i.deltaE);
  });
  const colorStats = Object.values(byColor).map(c => ({
    ...c,
    avgDE: (c.readings.reduce((s,v)=>s+v,0)/c.readings.length).toFixed(2),
    count: c.readings.length,
    grade: getGrade(c.readings.reduce((s,v)=>s+v,0)/c.readings.length),
  })).sort((a,b) => b.avgDE - a.avgDE);

  const avgLabDipAttempts = LABDIP_STATS.length
    ? (LABDIP_STATS.reduce((s,l)=>s+l.attempts,0)/LABDIP_STATS.length).toFixed(1)
    : '—';

  const TABS = [
    { key:'overview',  label:'Overview' },
    { key:'grades',    label:'ΔE Grade Analysis' },
    { key:'clients',   label:'Client Breakdown' },
    { key:'redye',     label:`Re-dye Log (${REDYE_LOG.length})` },
    { key:'labdip',    label:'Lab Dip Efficiency' },
  ];

  return (
    <div className="quality-reports">
      <div className="page-header">
        <div>
          <h1>Quality Reports</h1>
          <p className="page-subtitle">ΔE-based shade quality analytics — linked to Inspections, Orders & Lab Dips</p>
        </div>
        <button className="export-button"><Download size={18}/> Export PDF</button>
      </div>

      {/* KPIs */}
      <div className="qr-kpi-row">
        {[
          { label:'Total Inspected',   value: INSPECTIONS.length,  sub:'batches',          color:'#6366f1', icon:<CheckCircle size={20}/> },
          { label:'Avg ΔE (all)',      value: avgDE,               sub:'lower=better',     color: Number(avgDE)>3?'#ef4444':Number(avgDE)>2?'#f59e0b':'#10b981', icon:<span style={{fontWeight:900,fontSize:16}}>ΔE</span> },
          { label:'Pass Rate (vs tol)',value:`${passRatePct}%`,    sub:'within tolerance', color:'#10b981', icon:<TrendingUp size={20}/> },
          { label:'Re-dye Incidents',  value: reDyeCount,          sub:`₹${totalReDyeCost.toLocaleString()} cost`, color:'#ef4444', icon:<RotateCcw size={20}/> },
          { label:'Avg Lab Dip Attempts', value:avgLabDipAttempts, sub:'per color',        color:'#8b5cf6', icon:<FlaskConical size={20}/> },
        ].map(k => (
          <div className="qr-kpi" key={k.label}>
            <div className="qr-kpi-icon" style={{ background:k.color+'1a', color:k.color }}>{k.icon}</div>
            <div>
              <div className="qr-kpi-val" style={{ color:k.color }}>{k.value}</div>
              <div className="qr-kpi-label">{k.label}</div>
              <div className="qr-kpi-sub">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="qr-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`qr-tab ${activeTab===t.key?'qr-tab-active':''}`} onClick={()=>setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="qr-content">
          <div className="qr-charts-grid">
            {/* Grade distribution */}
            <div className="qr-card">
              <h3>Grade Distribution</h3>
              <p className="qr-card-sub">How many batches fall into each ΔE quality grade</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={gradeDist} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize:11}}/>
                  <YAxis allowDecimals={false} tick={{fontSize:11}}/>
                  <Tooltip formatter={(v,n,p)=>[v,p.payload.text]} contentStyle={{borderRadius:8,border:'1px solid #e5e7eb'}}/>
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {gradeDist.map((g,i)=><Cell key={i} fill={g.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Grade trend over time */}
            <div className="qr-card">
              <h3>Grade Trend Over Time</h3>
              <p className="qr-card-sub">Daily count of Grade A+A (excellent) vs D+F (problem)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={TREND_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{fontSize:10}}/>
                  <YAxis allowDecimals={false} tick={{fontSize:10}}/>
                  <Tooltip contentStyle={{borderRadius:8,border:'1px solid #e5e7eb'}}/>
                  <Legend/>
                  <Line type="monotone" dataKey="gradeA" name="Grade A/A+" stroke="#10b981" strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="gradeB" name="Grade B"     stroke="#84cc16" strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="gradeC" name="Grade C"     stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2" dot={false}/>
                  <Line type="monotone" dataKey="gradeD" name="Grade D/F"   stroke="#ef4444" strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Color performance table */}
          <div className="qr-card" style={{marginTop:16}}>
            <h3>Color-wise Performance</h3>
            <p className="qr-card-sub">Average ΔE per color — identify problem shades</p>
            <table className="qr-table">
              <thead>
                <tr><th>Color</th><th>Client</th><th>Readings</th><th>Avg ΔE</th><th>Grade</th><th>Recipe</th></tr>
              </thead>
              <tbody>
                {colorStats.map((c,i) => (
                  <tr key={i} className={c.grade.label==='F'||c.grade.label==='D'?'qr-row-warn':''}>
                    <td>{c.color}</td>
                    <td><span className="client-badge">{c.client}</span></td>
                    <td>{c.count}</td>
                    <td>
                      <span style={{color:c.grade.color,fontWeight:800,fontFamily:'monospace'}}>{c.avgDE}</span>
                    </td>
                    <td>
                      <span className="grade-chip" style={{background:c.grade.color+'18',color:c.grade.color,border:`1px solid ${c.grade.color}44`}}>
                        Grade {c.grade.label} — {c.grade.text}
                      </span>
                    </td>
                    <td>
                      {c.recipe
                        ? <span className="rec-link">{c.recipe}</span>
                        : <span className="qr-dim">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ΔE GRADE ANALYSIS ── */}
      {activeTab === 'grades' && (
        <div className="qr-content">
          <div className="grade-breakdown-grid">
            {GRADES.map(g => {
              const rows = withDE.filter(i => getGrade(i.deltaE).label === g.label);
              return (
                <div key={g.label} className="grade-block" style={{borderTop:`3px solid ${g.color}`,background:g.color+'08'}}>
                  <div className="gb-top">
                    <span className="gb-grade" style={{color:g.color}}>Grade {g.label}</span>
                    <span className="gb-count" style={{background:g.color+'22',color:g.color}}>{rows.length}</span>
                  </div>
                  <div className="gb-range">ΔE {g.range[0]}–{g.range[1]<99?g.range[1]:'∞'}</div>
                  <div className="gb-text" style={{color:g.color}}>{g.text}</div>
                  {rows.length > 0 && (
                    <ul className="gb-list">
                      {rows.slice(0,4).map((r,i) => (
                        <li key={i}>
                          {r.color} <span className="gb-client">({r.client})</span>
                          <span className="gb-de" style={{color:g.color}}>ΔE {r.deltaE}</span>
                        </li>
                      ))}
                      {rows.length > 4 && <li className="gb-more">+{rows.length-4} more</li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CLIENT BREAKDOWN ── */}
      {activeTab === 'clients' && (
        <div className="qr-content">
          <div className="client-breakdown-grid">
            {clientBreakdown.map(c => (
              <div key={c.client} className="cb-card">
                <div className="cb-header">
                  <span className="cb-client">{c.client}</span>
                  <span className="cb-tier">Tolerance ΔE ≤ {c.tol}</span>
                </div>
                <div className="cb-stats">
                  {[
                    { l:'Total Batches', v:c.total },
                    { l:'Passed',        v:c.pass,   color:'#10b981' },
                    { l:'Failed',        v:c.fail,   color:'#ef4444' },
                    { l:'Pass Rate',     v:`${c.passRate}%`, color: c.passRate>=80?'#10b981':c.passRate>=60?'#f59e0b':'#ef4444' },
                    { l:'Avg ΔE',        v:c.avg,    color: Number(c.avg)>c.tol?'#ef4444':Number(c.avg)>c.tol*0.75?'#f59e0b':'#10b981' },
                    { l:'Best ΔE',       v:c.best,   color:'#10b981' },
                    { l:'Worst ΔE',      v:c.worst,  color:'#ef4444' },
                  ].map(s => (
                    <div key={s.l} className="cb-stat">
                      <div className="cb-stat-val" style={{color:s.color}}>{s.v}</div>
                      <div className="cb-stat-label">{s.l}</div>
                    </div>
                  ))}
                </div>
                {/* Pass rate bar */}
                <div className="cb-bar-wrap">
                  <div className="cb-bar" style={{width:`${c.passRate}%`, background:c.passRate>=80?'#10b981':c.passRate>=60?'#f59e0b':'#ef4444'}}/>
                </div>
                <div className="cb-bar-label">{c.passRate}% within tolerance</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RE-DYE LOG ── */}
      {activeTab === 'redye' && (
        <div className="qr-content">
          <div className="qr-card">
            <h3>Re-dye Incidents</h3>
            <p className="qr-card-sub">Batches that failed Post-QC and required re-dyeing — track root cause and cost</p>
            <table className="qr-table">
              <thead>
                <tr><th>Date</th><th>Color</th><th>Client</th><th>Lot No.</th><th>Original ΔE</th><th>After Re-dye</th><th>Root Cause</th><th>Cost (₹)</th></tr>
              </thead>
              <tbody>
                {REDYE_LOG.map((r,i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td style={{fontWeight:600}}>{r.color}</td>
                    <td><span className="client-badge">{r.client}</span></td>
                    <td style={{fontFamily:'monospace'}}>{r.lotNo}</td>
                    <td><span style={{color:'#ef4444',fontWeight:800,fontFamily:'monospace'}}>{r.originalDE}</span></td>
                    <td>
                      <span style={{color: r.afterDE <= (CLIENT_TOL[r.client]||3.0) ? '#f59e0b' : '#ef4444', fontWeight:700, fontFamily:'monospace'}}>
                        {r.afterDE}
                      </span>
                      {r.afterDE <= (CLIENT_TOL[r.client]||3.0)
                        ? <span className="badge-marginal">Marginal Pass</span>
                        : <span className="badge-fail">Still Fail</span>
                      }
                    </td>
                    <td style={{fontSize:12,color:'#374151',maxWidth:180}}>{r.reason}</td>
                    <td style={{fontWeight:700,color:'#ef4444'}}>₹{r.cost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} style={{fontWeight:700,textAlign:'right',paddingTop:12}}>Total Re-dye Cost:</td>
                  <td style={{fontWeight:800,color:'#ef4444',fontSize:15}}>₹{totalReDyeCost.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── LAB DIP EFFICIENCY ── */}
      {activeTab === 'labdip' && (
        <div className="qr-content">
          <div className="qr-card">
            <h3>Lab Dip Efficiency</h3>
            <p className="qr-card-sub">Attempts needed per color before client approval — fewer = more efficient</p>
            <table className="qr-table">
              <thead>
                <tr><th>Lab Dip Ref</th><th>Color</th><th>Client</th><th>Attempts</th><th>Final ΔE</th><th>Status</th><th>Efficiency</th></tr>
              </thead>
              <tbody>
                {LABDIP_STATS.map((l,i) => {
                  const eff = l.attempts === 1 ? 'Excellent' : l.attempts === 2 ? 'Good' : l.attempts === 3 ? 'Acceptable' : 'Poor';
                  const effColor = l.attempts===1?'#10b981':l.attempts===2?'#84cc16':l.attempts===3?'#f59e0b':'#ef4444';
                  const grade = getGrade(l.finalDE);
                  return (
                    <tr key={i}>
                      <td style={{fontFamily:'monospace',fontWeight:700,color:'#6366f1'}}>{l.ref}</td>
                      <td style={{fontWeight:600}}>{l.color}</td>
                      <td><span className="client-badge">{l.client}</span></td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          {'●'.repeat(l.attempts).split('').map((d,j)=>(
                            <span key={j} style={{color:effColor,fontSize:16}}>●</span>
                          ))}
                          <span style={{fontSize:12,color:'#6b7280'}}>× {l.attempts}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{color:grade.color,fontWeight:800,fontFamily:'monospace'}}>{l.finalDE}</span>
                        <span className="grade-chip" style={{background:grade.color+'18',color:grade.color,border:`1px solid ${grade.color}44`,marginLeft:6,fontSize:10}}>
                          Grade {grade.label}
                        </span>
                      </td>
                      <td>
                        {l.approved
                          ? <span style={{color:'#10b981',fontWeight:700}}>✅ Approved</span>
                          : <span style={{color:'#f59e0b',fontWeight:700}}>⏳ Pending</span>
                        }
                      </td>
                      <td><span style={{color:effColor,fontWeight:700}}>{eff}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="ld-summary">
              <span>Average attempts per color: <strong>{avgLabDipAttempts}</strong></span>
              <span style={{color:'#6b7280',fontSize:12}}>Target: ≤ 2 attempts = efficient lab operation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityReports;
