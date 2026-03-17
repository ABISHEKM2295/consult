import React, { useState, useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Plus, Search, Calculator, TrendingUp, Award, Eye } from 'lucide-react';
import './StandardsTracking.css';

/* ─────────────────────────────────────────────────────────────
   STANDARDS TRACKING — Color Standard Library
   • Every client color has a stored L*a*b* standard
   • Live ΔE Calculator: input measured values → auto ΔE vs standard
   • Compliance rate: % of past inspections within tolerance
   • Color fastness tracker (wash, rub, light — ISO grades 1–5)
   • Inspection history trend per standard
   ───────────────────────────────────────────────────────────── */

// ΔE CIEDE2000 (simplified — full formula for a real app)
const calcDeltaE = (std, meas) => {
  if (!std || !meas) return null;
  const dL = meas.L - std.L;
  const da = meas.a - std.a;
  const db = meas.b - std.b;
  return Math.sqrt(dL * dL + da * da + db * db);
};

const getGrade = (de) => {
  if (de == null) return null;
  if (de < 0.5)  return { label: 'A+', color: '#059669', text: 'Perfect' };
  if (de < 1.0)  return { label: 'A',  color: '#10b981', text: 'Excellent' };
  if (de < 2.0)  return { label: 'B',  color: '#84cc16', text: 'Good' };
  if (de < 3.0)  return { label: 'C',  color: '#f59e0b', text: 'Acceptable' };
  if (de < 4.5)  return { label: 'D',  color: '#f97316', text: 'Marginal' };
  return             { label: 'F',  color: '#ef4444', text: 'Re-dye' };
};

const FASTNESS_LABELS = { 5:'Excellent', 4:'Good', 3:'Moderate', 2:'Poor', 1:'Very Poor' };
const FASTNESS_COLOR  = { 5:'#10b981', 4:'#84cc16', 3:'#f59e0b', 2:'#f97316', 1:'#ef4444' };

const STANDARDS = [
  {
    id: 1,
    name: 'Navy Blue',
    ref: 'Pantone 19-4024 TCX',
    type: 'Pantone',
    hex: '#1a2e5a',
    clients: ['Modenik'],
    tolerance: 2.0,
    lab: { L: 18.5, a: 8.2, b: -15.3 },
    fastness: { wash: 4, rubDry: 4, rubWet: 3, light: 4 },
    inspections: [
      { date:'Nov 28', de: 3.5, lot:'12814/1/D' },
      { date:'Dec 2',  de: 1.2, lot:'13145' },
    ],
    status: 'active',
    usedInOrders: ['ORD-0001','ORD-0004'],
    recipe: 'REC-001',
  },
  {
    id: 2,
    name: 'Olive Green',
    ref: 'Pantone 18-0430 TCX',
    type: 'Pantone',
    hex: '#5a6e35',
    clients: ['Modenik'],
    tolerance: 2.0,
    lab: { L: 42.3, a: -14.8, b: 22.5 },
    fastness: { wash: 5, rubDry: 4, rubWet: 4, light: 4 },
    inspections: [
      { date:'Nov 28', de: 0.6, lot:'111' },
      { date:'Dec 3',  de: 3.4, lot:'13143' },
    ],
    status: 'active',
    usedInOrders: ['ORD-0002'],
    recipe: 'REC-002',
  },
  {
    id: 3,
    name: 'Charcoal',
    ref: 'Pantone 19-0303 TCX',
    type: 'Pantone',
    hex: '#36454f',
    clients: ['JG'],
    tolerance: 3.0,
    lab: { L: 31.2, a: 2.5, b: -1.8 },
    fastness: { wash: 4, rubDry: 3, rubWet: 2, light: 3 },
    inspections: [
      { date:'Nov 29', de: 3.8, lot:'371' },
      { date:'Nov 29', de: 3.7, lot:'371' },
    ],
    status: 'active',
    usedInOrders: ['ORD-0003'],
    recipe: 'REC-003',
  },
  {
    id: 4,
    name: 'H. Orange',
    ref: 'Pantone 16-1358 TCX',
    type: 'Pantone',
    hex: '#d4522e',
    clients: ['LUX'],
    tolerance: 3.0,
    lab: { L: 55.8, a: 42.1, b: 38.6 },
    fastness: { wash: 4, rubDry: 4, rubWet: 3, light: 3 },
    inspections: [
      { date:'Dec 1', de: 3.1, lot:'2002' },
    ],
    status: 'active',
    usedInOrders: [],
    recipe: 'REC-004',
  },
  {
    id: 5,
    name: 'Graphwine',
    ref: 'Custom Client Standard',
    type: 'Client Standard',
    hex: '#4a2040',
    clients: ['Modenik'],
    tolerance: 2.0,
    lab: { L: 22.8, a: 14.2, b: -10.5 },
    fastness: { wash: 4, rubDry: 4, rubWet: 3, light: 4 },
    inspections: [
      { date:'Nov 28', de: 0.9, lot:'109' },
    ],
    status: 'active',
    usedInOrders: [],
    recipe: null,
  },
];

/* ── Main ────────────────────────────────────────────────────── */
const StandardsTracking = () => {
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState(STANDARDS[0]);
  const [calcMode, setCalcMode] = useState(false);
  const [meas, setMeas]         = useState({ L: '', a: '', b: '' });

  const measDE = useMemo(() => {
    if (!meas.L || !meas.a || !meas.b || !selected) return null;
    return parseFloat(calcDeltaE(selected.lab, { L: Number(meas.L), a: Number(meas.a), b: Number(meas.b) }).toFixed(2));
  }, [meas, selected]);

  const measGrade = measDE != null ? getGrade(measDE) : null;

  const filtered = STANDARDS.filter(s => {
    if (filter !== 'all' && s.type !== filter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.ref.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const types = [...new Set(STANDARDS.map(s => s.type))];

  // compliance rates
  const complianceRate = (std) => {
    const withDE = std.inspections.filter(i => i.de != null);
    if (!withDE.length) return null;
    const pass = withDE.filter(i => i.de <= std.tolerance).length;
    return Math.round((pass / withDE.length) * 100);
  };

  // L*a*b* radar data
  const radarData = selected ? [
    { axis: 'L*',  std: Math.abs(selected.lab.L), achieved: selected.inspections.slice(-1)[0] ? Math.abs(selected.lab.L + (selected.inspections.slice(-1)[0].de * 0.4)) : null },
    { axis: 'a*',  std: Math.abs(selected.lab.a), achieved: selected.inspections.slice(-1)[0] ? Math.abs(selected.lab.a + (selected.inspections.slice(-1)[0].de * 0.3)) : null },
    { axis: 'b*',  std: Math.abs(selected.lab.b), achieved: selected.inspections.slice(-1)[0] ? Math.abs(selected.lab.b + (selected.inspections.slice(-1)[0].de * 0.2)) : null },
  ] : [];

  return (
    <div className="standards-tracking">
      <div className="page-header">
        <div>
          <h1>Standards Library</h1>
          <p className="page-subtitle">L*a*b* color standards, fastness grades, compliance tracking & live ΔE calculator</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn-calc" onClick={() => setCalcMode(c => !c)}>
            <Calculator size={16}/> ΔE Calculator
          </button>
          <button className="new-standard-button"><Plus size={18}/> Add Standard</button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="st-kpis">
        {[
          { label:'Total Standards', value: STANDARDS.length, color:'#6366f1' },
          { label:'Active',          value: STANDARDS.filter(s=>s.status==='active').length, color:'#10b981' },
          { label:'Avg Compliance',  value: `${Math.round(STANDARDS.map(s=>complianceRate(s)).filter(Boolean).reduce((a,b)=>a+b,0)/STANDARDS.filter(s=>complianceRate(s)!=null).length)}%`, color:'#3b82f6' },
          { label:'Clients Covered', value: new Set(STANDARDS.flatMap(s=>s.clients)).size, color:'#8b5cf6' },
          { label:'Linked Recipes',  value: STANDARDS.filter(s=>s.recipe).length, color:'#f59e0b' },
        ].map(k => (
          <div className="st-kpi" key={k.label}>
            <div className="st-kpi-val" style={{color:k.color}}>{k.value}</div>
            <div className="st-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="st-layout">
        {/* Left — Standards List */}
        <div className="st-sidebar">
          {/* Toolbar */}
          <div className="st-toolbar">
            <div className="search-input">
              <Search size={14}/><input placeholder="Search standards…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="filter-tabs">
              <button className={`filter-tab ${filter==='all'?'active':''}`} onClick={()=>setFilter('all')}>All</button>
              {types.map(t=>(
                <button key={t} className={`filter-tab ${filter===t?'active':''}`} onClick={()=>setFilter(t)}>{t}</button>
              ))}
            </div>
          </div>

          <div className="st-list">
            {filtered.map(std => {
              const cr = complianceRate(std);
              const lastDE = std.inspections.slice(-1)[0]?.de;
              const grade  = lastDE != null ? getGrade(lastDE) : null;
              return (
                <div key={std.id} className={`st-item ${selected?.id===std.id?'selected':''}`} onClick={()=>setSelected(std)}>
                  <div className="st-item-swatch" style={{background:std.hex}}/>
                  <div className="st-item-body">
                    <div className="st-item-name">{std.name}</div>
                    <div className="st-item-ref">{std.ref}</div>
                    <div className="st-item-meta">
                      {std.clients.map(c=><span key={c} className="client-badge">{c}</span>)}
                      {grade && <span className="de-grade-chip" style={{color:grade.color,background:grade.color+'18',border:`1px solid ${grade.color}33`}}>ΔE {lastDE} — {grade.text}</span>}
                    </div>
                  </div>
                  {cr != null && (
                    <div className="st-item-cr">
                      <div className={`cr-pct ${cr>=80?'cr-good':cr>=60?'cr-warn':'cr-bad'}`}>{cr}%</div>
                      <div className="cr-label">compliance</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Detail Panel */}
        {selected && (
          <div className="st-detail">
            {/* Color strip header */}
            <div className="st-detail-header" style={{background:`linear-gradient(135deg, ${selected.hex}cc, ${selected.hex}66)`}}>
              <div className="sdh-left">
                <div className="sdh-swatch" style={{background:selected.hex}}/>
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.ref}</p>
                </div>
              </div>
              <div className="sdh-right">
                <span className="sdh-chip">Tolerance ΔE ≤ {selected.tolerance}</span>
                {selected.recipe && <span className="sdh-chip">{selected.recipe}</span>}
              </div>
            </div>

            <div className="st-detail-body">
              {/* L*a*b* Reference values */}
              <div className="st-section">
                <h4>📐 L*a*b* Reference Values</h4>
                <div className="lab-grid">
                  {['L','a','b'].map(axis => (
                    <div key={axis} className="lab-card">
                      <div className="lab-axis">{axis}*</div>
                      <div className="lab-val">{selected.lab[axis]}</div>
                      <div className="lab-note">{axis==='L'?'Lightness':axis==='a'?'Red–Green':'Yellow–Blue'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ΔE Calculator */}
              {calcMode && (
                <div className="de-calc">
                  <h4><Calculator size={14}/> Live ΔE Calculator</h4>
                  <p className="de-calc-sub">Enter your spectrophotometer reading to compare against the standard</p>
                  <div className="de-calc-inputs">
                    {['L','a','b'].map(ax => (
                      <div key={ax} className="de-inp-wrap">
                        <label>{ax}* (measured)</label>
                        <input
                          type="number" step="0.01"
                          placeholder={`${selected.lab[ax]}`}
                          value={meas[ax]}
                          onChange={e => setMeas(m => ({...m, [ax]: e.target.value}))}
                        />
                      </div>
                    ))}
                  </div>
                  {measDE != null && (
                    <div className="de-calc-result">
                      <span className="de-calc-val" style={{color: measGrade?.color}}>ΔE = {measDE}</span>
                      <span className="de-calc-grade" style={{background:measGrade?.color+'18',color:measGrade?.color,border:`1px solid ${measGrade?.color}44`}}>
                        Grade {measGrade?.label} — {measGrade?.text}
                      </span>
                      {measDE <= selected.tolerance
                        ? <span className="de-pass">✅ Within client tolerance (≤{selected.tolerance})</span>
                        : <span className="de-fail">❌ Exceeds tolerance — re-dye or flag for client</span>
                      }
                    </div>
                  )}
                </div>
              )}

              {/* Color Fastness */}
              <div className="st-section">
                <h4>🧪 Color Fastness Results (ISO Grade 1–5)</h4>
                <div className="fastness-grid">
                  {[
                    { key:'wash',   label:'Wash Fastness'      },
                    { key:'rubDry', label:'Rub Fastness (Dry)' },
                    { key:'rubWet', label:'Rub Fastness (Wet)' },
                    { key:'light',  label:'Light Fastness'     },
                  ].map(f => {
                    const val = selected.fastness[f.key];
                    const color = FASTNESS_COLOR[val];
                    return (
                      <div key={f.key} className="fastness-card" style={{borderTop:`3px solid ${color}`,background:color+'0a'}}>
                        <div className="fastness-label">{f.label}</div>
                        <div className="fastness-grade" style={{color}}>Grade {val}</div>
                        <div className="fastness-text" style={{color}}>{FASTNESS_LABELS[val]}</div>
                        <div className="fastness-dots">
                          {[1,2,3,4,5].map(n => (
                            <div key={n} className="fdot" style={{background: n <= val ? color : '#e5e7eb'}}/>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inspection history ΔE trend */}
              {selected.inspections.length > 0 && (
                <div className="st-section">
                  <h4><TrendingUp size={14}/> Inspection ΔE History</h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={selected.inspections}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="date" tick={{fontSize:11}}/>
                      <YAxis domain={[0, 6]} tick={{fontSize:11}} tickFormatter={v=>`${v}`}/>
                      <Tooltip formatter={(v)=>[`ΔE = ${v}`, 'Reading']} contentStyle={{borderRadius:8}}/>
                      <ReferenceLine y={selected.tolerance} stroke="#ef4444" strokeDasharray="5 3" label={{value:`Tolerance ≤${selected.tolerance}`,fontSize:10,fill:'#ef4444'}}/>
                      <Line type="monotone" dataKey="de" stroke="#6366f1" strokeWidth={2} dot={{r:4,fill:'#6366f1'}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Traceability */}
              <div className="st-section">
                <h4><Eye size={14}/> Traceability</h4>
                <div className="trace-row">
                  <div className="trace-col">
                    <div className="trace-label">Linked Orders</div>
                    <div className="trace-chips">
                      {selected.usedInOrders.length
                        ? selected.usedInOrders.map(o=><span key={o} className="trace-chip">{o}</span>)
                        : <span className="st-dim">None yet</span>
                      }
                    </div>
                  </div>
                  <div className="trace-col">
                    <div className="trace-label">Color Recipe</div>
                    {selected.recipe
                      ? <span className="trace-chip trace-recipe">{selected.recipe}</span>
                      : <span className="st-dim">No locked recipe</span>
                    }
                  </div>
                  <div className="trace-col">
                    <div className="trace-label">Compliance Rate</div>
                    {(() => {
                      const cr = complianceRate(selected);
                      const col = cr >= 80 ? '#10b981' : cr >= 60 ? '#f59e0b' : '#ef4444';
                      return cr != null
                        ? <span style={{fontSize:22,fontWeight:800,color:col}}>{cr}%</span>
                        : <span className="st-dim">No data yet</span>;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StandardsTracking;
