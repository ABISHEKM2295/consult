import React, { useState } from 'react';
import { Plus, Search, Edit, Copy, Lock, Unlock, FlaskConical, ChevronDown, ChevronUp, X } from 'lucide-react';
import './ColorRecipes.css';

/* ─────────────────────────────────────────────────────────────
   COLOR RECIPE LIBRARY
   Each recipe represents a locked, client-approved dye formula.
   Linked to:  Lab Dip (approval source) | Order (usage history)
               Color Inspection (achieved ΔE on production)
   ───────────────────────────────────────────────────────────── */

const CLIENT_TOLERANCES = {
  'Modenik': 2.0, 'JG': 3.0, 'LUX': 3.0, 'DEFAULT': 3.0
};

const RECIPE_LIBRARY = [
  {
    id: 'REC-001',
    colorName: 'Navy Blue',
    colorHex: '#1a2e5a',
    pantoneRef: 'Pantone 19-4024 TCX',
    client: 'Modenik',
    fabricType: 'Single Jersey (30/1)',
    status: 'locked',     // locked = approved for production
    labDipRef: 'LD-0023',
    linkedOrders: ['ORD-0001', 'ORD-0004'],
    lockedBy: 'Ravi Kumar',
    lockedOn: '2025-11-20',
    lastUsed: '2025-12-02',
    timesUsed: 4,
    avgDeltaE: 1.2,
    // Dye recipe (per 100 kg fabric — exhaustion dyeing)
    dyeMethod: 'Reactive (Exhaust)',
    machineType: 'Jet Dyeing Machine',
    liquorRatio: '1:10',
    dyes: [
      { name: 'Reactive Blue 222', owf: 2.8, unit: '% owf', supplier: 'DyStar' },
      { name: 'Reactive Black 5',  owf: 0.4, unit: '% owf', supplier: 'Huntsman' },
      { name: 'Reactive Red 120',  owf: 0.15,unit: '% owf', supplier: 'DyStar' },
    ],
    auxiliaries: [
      { name: 'Glauber Salt (Na₂SO₄)', qty: 60,  unit: 'g/L',  purpose: 'Exhaustion aid' },
      { name: 'Soda Ash (Na₂CO₃)',     qty: 20,  unit: 'g/L',  purpose: 'Fixation alkali' },
      { name: 'Wetting Agent',          qty: 1.0, unit: 'g/L',  purpose: 'Surface tension' },
      { name: 'Sequestering Agent',     qty: 1.5, unit: 'g/L',  purpose: 'Water hardness' },
      { name: 'Anti-creasing Agent',    qty: 2.0, unit: 'g/L',  purpose: 'Fabric protection' },
    ],
    processSteps: [
      { step: 'Pre-wash',  temp: 40,  time: 10, note: 'Remove knitting oils' },
      { step: 'Load dye',  temp: 40,  time: 10, note: 'Add dye + wetting agent' },
      { step: 'Salt add',  temp: 40,  time: 20, note: 'Add salt in 3 portions' },
      { step: 'Raise',     temp: 60,  time: 15, note: 'Raise temp 1°C/min' },
      { step: 'Fixation',  temp: 60,  time: 10, note: 'Add soda ash slowly' },
      { step: 'Run',       temp: 60,  time: 30, note: 'Main fixation time' },
      { step: 'Drain+Wash',temp: 70,  time: 15, note: 'Hot wash 70°C × 2' },
      { step: 'Soaping',   temp: 98,  time: 15, note: 'Boiling soap to remove unfixed dye' },
      { step: 'Final wash',temp: 40,  time: 10, note: 'Cold wash, pH check 6.5–7' },
    ],
    notes: 'Deep navy — extra soaping required. Check for unlevel dyeing at step 4. Shade card: NB-28.',
  },
  {
    id: 'REC-002',
    colorName: 'Olive Green',
    colorHex: '#5a6e35',
    pantoneRef: 'Pantone 18-0430 TCX',
    client: 'Modenik',
    fabricType: 'Single Jersey (30/1)',
    status: 'locked',
    labDipRef: 'LD-0019',
    linkedOrders: ['ORD-0002'],
    lockedBy: 'Suresh M',
    lockedOn: '2025-11-15',
    lastUsed: '2025-12-03',
    timesUsed: 2,
    avgDeltaE: 0.8,
    dyeMethod: 'Reactive (Exhaust)',
    machineType: 'Jet Dyeing Machine',
    liquorRatio: '1:10',
    dyes: [
      { name: 'Reactive Yellow 145', owf: 1.6, unit: '% owf', supplier: 'Huntsman' },
      { name: 'Reactive Blue 250',   owf: 0.5, unit: '% owf', supplier: 'DyStar'   },
      { name: 'Reactive Black 5',    owf: 0.2, unit: '% owf', supplier: 'DyStar'   },
    ],
    auxiliaries: [
      { name: 'Glauber Salt',      qty: 50,  unit: 'g/L', purpose: 'Exhaustion' },
      { name: 'Soda Ash',          qty: 18,  unit: 'g/L', purpose: 'Fixation' },
      { name: 'Wetting Agent',     qty: 1.0, unit: 'g/L', purpose: 'Surface tension' },
      { name: 'Sequestering Agent',qty: 1.5, unit: 'g/L', purpose: 'Water hardness' },
    ],
    processSteps: [
      { step: 'Pre-wash',  temp: 40, time: 10, note: '' },
      { step: 'Dye + Salt',temp: 40, time: 25, note: 'Gradual salt addition' },
      { step: 'Raise',     temp: 60, time: 15, note: '1°C/min gradient' },
      { step: 'Alkali fix',temp: 60, time: 40, note: 'Soda ash in 3 portions' },
      { step: 'Hot wash',  temp: 70, time: 10, note: '' },
      { step: 'Neutralise',temp: 40, time: 5,  note: 'Acetic acid, pH 5.5–6' },
    ],
    notes: 'Medium depth olive. Sensitive to temperature uniformity — monitor ±2°C.',
  },
  {
    id: 'REC-003',
    colorName: 'Charcoal',
    colorHex: '#36454f',
    pantoneRef: 'Pantone 19-0303 TCX',
    client: 'JG',
    fabricType: 'Single Jersey (30/1)',
    status: 'locked',
    labDipRef: 'LD-0031',
    linkedOrders: ['ORD-0003'],
    lockedBy: 'Murugan R',
    lockedOn: '2025-11-22',
    lastUsed: '2025-11-29',
    timesUsed: 1,
    avgDeltaE: 3.5,
    dyeMethod: 'Reactive (Exhaust)',
    machineType: 'Jet Dyeing Machine',
    liquorRatio: '1:8',
    dyes: [
      { name: 'Reactive Black 5',  owf: 4.5, unit: '% owf', supplier: 'DyStar'  },
      { name: 'Reactive Blue 222', owf: 0.8, unit: '% owf', supplier: 'DyStar'  },
      { name: 'Reactive Red 195',  owf: 0.3, unit: '% owf', supplier: 'Archroma'},
    ],
    auxiliaries: [
      { name: 'Glauber Salt',       qty: 80,  unit: 'g/L', purpose: 'Exhaustion (high for dark shade)' },
      { name: 'Soda Ash',           qty: 25,  unit: 'g/L', purpose: 'Fixation' },
      { name: 'Reducing Agent',     qty: 2.0, unit: 'g/L', purpose: 'Tail-end shade correction' },
      { name: 'Wetting Agent',      qty: 1.5, unit: 'g/L', purpose: 'Surface' },
      { name: 'Anti-creasing Agent',qty: 3.0, unit: 'g/L', purpose: 'Heavy fabric protection' },
    ],
    processSteps: [
      { step: 'Pre-wash',  temp: 60, time: 15, note: 'Extended pre-wash for dark shade' },
      { step: 'Dye load',  temp: 40, time: 10, note: '' },
      { step: 'Salt x3',   temp: 40, time: 30, note: 'Critical: slow salt for level dyeing' },
      { step: 'Raise',     temp: 60, time: 20, note: '0.5°C/min — slow raise for black' },
      { step: 'Alkali 1',  temp: 60, time: 15, note: '1/3 soda ash' },
      { step: 'Alkali 2',  temp: 60, time: 15, note: '1/3 soda ash' },
      { step: 'Alkali 3',  temp: 60, time: 20, note: 'Final 1/3 soda ash' },
      { step: 'Hot wash',  temp: 80, time: 20, note: 'Multi-wash essential for dark' },
      { step: 'Soaping',   temp: 98, time: 20, note: 'Extended soaping' },
      { step: 'Final',     temp: 40, time: 10, note: 'pH 6–6.5 check' },
    ],
    notes: '⚠️ Dark shade — watch ΔE carefully. Last batch ΔE=3.5 (marginal for JG). Consider increasing dye by 0.2% if rejected.',
  },
  {
    id: 'REC-004',
    colorName: 'H. Orange',
    colorHex: '#d4522e',
    pantoneRef: 'Pantone 16-1358 TCX',
    client: 'LUX',
    fabricType: 'Fleece (30/1)',
    status: 'draft',   // draft = in testing, not yet approved
    labDipRef: 'LD-0038',
    linkedOrders: [],
    lockedBy: null,
    lockedOn: null,
    lastUsed: '2025-12-01',
    timesUsed: 0,
    avgDeltaE: 3.1,
    dyeMethod: 'Reactive (Exhaust)',
    machineType: 'Winch Dyeing Machine',
    liquorRatio: '1:15',
    dyes: [
      { name: 'Reactive Orange 107',owf: 3.2, unit: '% owf', supplier: 'Huntsman' },
      { name: 'Reactive Red 195',   owf: 0.6, unit: '% owf', supplier: 'Archroma'},
    ],
    auxiliaries: [
      { name: 'Glauber Salt',  qty: 55, unit: 'g/L', purpose: 'Exhaustion' },
      { name: 'Soda Ash',      qty: 20, unit: 'g/L', purpose: 'Fixation' },
      { name: 'Wetting Agent', qty: 1.0,unit: 'g/L', purpose: 'Surface' },
    ],
    processSteps: [
      { step: 'Pre-treat', temp: 40, time: 10, note: '' },
      { step: 'Dye+Salt',  temp: 40, time: 25, note: '' },
      { step: 'Raise',     temp: 60, time: 15, note: '' },
      { step: 'Fixation',  temp: 60, time: 40, note: '' },
      { step: 'Wash',      temp: 70, time: 15, note: '' },
    ],
    notes: '⚠️ Still in trial — ΔE = 3.1, LUX tolerance = 3.0. Needs one more attempt. Try increasing Red 195 by 0.1%.',
  },
];

/* ── Helpers ─────────────────────────────────────────────────── */
const STATUS = {
  locked: { label: '🔒 Locked for Production', color: '#10b981', bg: '#ecfdf5' },
  draft:  { label: '⚗️ Draft / Testing',        color: '#f59e0b', bg: '#fffbeb' },
  archived:{ label:'📦 Archived',              color: '#9ca3af', bg: '#f9fafb' },
};

const DeltaEBadge = ({ de, client }) => {
  if (!de) return null;
  const tol = CLIENT_TOLERANCES[client] || 3.0;
  const color = de <= tol * 0.66 ? '#10b981' : de <= tol ? '#f59e0b' : '#ef4444';
  return (
    <span className="de-badge" style={{ color, background: color + '18', border: `1px solid ${color}44` }}>
      avg ΔE {de.toFixed(1)}
    </span>
  );
};

/* ── Main ────────────────────────────────────────────────────── */
const ColorRecipes = () => {
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [client, setClient]       = useState('');
  const [expanded, setExpanded]   = useState(null);
  const [showNew, setShowNew]     = useState(false);

  const clients = [...new Set(RECIPE_LIBRARY.map(r => r.client))];

  const filtered = RECIPE_LIBRARY.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (client && r.client !== client)           return false;
    if (search && !r.colorName.toLowerCase().includes(search.toLowerCase()) &&
        !r.id.toLowerCase().includes(search.toLowerCase()) &&
        !r.client.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggle = (id) => setExpanded(e => e === id ? null : id);

  return (
    <div className="color-recipes">
      <div className="page-header">
        <div>
          <h1>Color Recipe Library</h1>
          <p className="page-subtitle">Locked production formulas — linked to Lab Dips, Orders & Inspections</p>
        </div>
        <button className="new-recipe-button" onClick={() => setShowNew(true)}>
          <Plus size={18}/> New Recipe
        </button>
      </div>

      {/* Stats */}
      <div className="recipe-stats">
        {[
          { label: 'Total Recipes', value: RECIPE_LIBRARY.length,                              color:'#6366f1' },
          { label: 'Locked (Production Ready)', value: RECIPE_LIBRARY.filter(r=>r.status==='locked').length, color:'#10b981' },
          { label: 'Draft / Testing',            value: RECIPE_LIBRARY.filter(r=>r.status==='draft').length,  color:'#f59e0b' },
          { label: 'Clients Covered',            value: clients.length,                        color:'#8b5cf6' },
          { label: 'Total Production Runs',      value: RECIPE_LIBRARY.reduce((s,r)=>s+r.timesUsed,0), color:'#3b82f6' },
        ].map(s => (
          <div className="rc-stat" key={s.label}>
            <h3 style={{ color: s.color }}>{s.value}</h3>
            <p>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="rc-toolbar">
        <div className="search-input">
          <Search size={15}/>
          <input placeholder="Search color, recipe ID, client…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="filter-tabs">
          {['all','locked','draft','archived'].map(f => (
            <button key={f} className={`filter-tab ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
              {f==='all'?'All':STATUS[f]?.label||f}
            </button>
          ))}
        </div>
        <select className="rc-client-filter" value={client} onChange={e=>setClient(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Recipe Cards */}
      <div className="rc-list">
        {filtered.map(r => {
          const st  = STATUS[r.status];
          const exp = expanded === r.id;
          return (
            <div key={r.id} className={`rc-card ${r.status === 'draft' ? 'rc-draft' : ''}`}>
              {/* Card header — always visible */}
              <div className="rc-card-header" onClick={() => toggle(r.id)}>
                <div className="rc-color-swatch" style={{ background: r.colorHex }}>
                  <span className="rc-hex">{r.colorHex}</span>
                </div>
                <div className="rc-card-info">
                  <div className="rc-card-top">
                    <span className="rc-id">{r.id}</span>
                    <span className="rc-status-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="rc-name">{r.colorName}</div>
                  <div className="rc-meta-row">
                    <span className="rc-meta-chip">👤 {r.client}</span>
                    <span className="rc-meta-chip">🧶 {r.fabricType}</span>
                    <span className="rc-meta-chip">⚗️ {r.dyeMethod}</span>
                    {r.labDipRef && <span className="rc-meta-chip rc-link">🧪 {r.labDipRef}</span>}
                    {r.linkedOrders.length > 0 && <span className="rc-meta-chip rc-link">📋 {r.linkedOrders.join(', ')}</span>}
                    <DeltaEBadge de={r.avgDeltaE} client={r.client} />
                    {r.pantoneRef && <span className="rc-meta-chip" style={{color:'#6b7280'}}>🎨 {r.pantoneRef}</span>}
                  </div>
                </div>
                <div className="rc-card-right">
                  <div className="rc-usage">
                    <span className="rc-used-count">{r.timesUsed}×</span>
                    <span className="rc-used-label">production runs</span>
                  </div>
                  {exp ? <ChevronUp size={18} color="#6b7280"/> : <ChevronDown size={18} color="#6b7280"/>}
                </div>
              </div>

              {/* Expanded detail — dye formula + process */}
              {exp && (
                <div className="rc-detail">
                  <div className="rc-detail-grid">
                    {/* Dye Formula */}
                    <div className="rc-section">
                      <h4>🧪 Dye Formula</h4>
                      <p className="rc-section-sub">Liquor ratio {r.liquorRatio} · {r.machineType}</p>
                      <table className="rc-table">
                        <thead>
                          <tr><th>Dye Name</th><th>% owf</th><th>Supplier</th></tr>
                        </thead>
                        <tbody>
                          {r.dyes.map((d,i) => (
                            <tr key={i}>
                              <td>{d.name}</td>
                              <td className="rc-bold">{d.owf} {d.unit}</td>
                              <td className="rc-dim">{d.supplier}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Auxiliaries */}
                    <div className="rc-section">
                      <h4>⚗️ Auxiliaries & Chemicals</h4>
                      <p className="rc-section-sub">Per litre of bath</p>
                      <table className="rc-table">
                        <thead>
                          <tr><th>Chemical</th><th>Qty</th><th>Purpose</th></tr>
                        </thead>
                        <tbody>
                          {r.auxiliaries.map((a,i) => (
                            <tr key={i}>
                              <td>{a.name}</td>
                              <td className="rc-bold">{a.qty} {a.unit}</td>
                              <td className="rc-dim">{a.purpose}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Process Steps */}
                  <div className="rc-section" style={{marginTop:14}}>
                    <h4>🔥 Process Steps</h4>
                    <div className="rc-process-steps">
                      {r.processSteps.map((s, i) => (
                        <div key={i} className="rc-step">
                          <div className="rc-step-no">{i+1}</div>
                          <div className="rc-step-body">
                            <div className="rc-step-name">{s.step}</div>
                            <div className="rc-step-meta">
                              {s.temp}°C · {s.time} min
                              {s.note && <span className="rc-step-note"> — {s.note}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes + Lock info */}
                  {r.notes && (
                    <div className="rc-notes">
                      <strong>📌 Notes:</strong> {r.notes}
                    </div>
                  )}
                  <div className="rc-footer">
                    {r.lockedBy
                      ? <span><Lock size={12}/> Locked by {r.lockedBy} on {r.lockedOn}</span>
                      : <span><Unlock size={12}/> Not yet locked — pending client approval</span>
                    }
                    {r.lastUsed && <span>Last production: {r.lastUsed}</span>}
                  </div>
                  <div className="rc-actions">
                    <button className="rc-btn"><Copy size={14}/> Duplicate</button>
                    <button className="rc-btn"><Edit size={14}/> Edit</button>
                    {r.status === 'draft' && (
                      <button className="rc-btn rc-lock-btn"><Lock size={14}/> Lock for Production</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ColorRecipes;
