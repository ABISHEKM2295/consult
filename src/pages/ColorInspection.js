import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Plus, Search, Eye, CheckCircle, Clock, XCircle, AlertTriangle, Info } from 'lucide-react';
import './ColorInspection.css';

/* ─────────────────────────────────────────────────────────────
   INDUSTRY-STANDARD ΔE (CIEDE2000) GRADE SYSTEM
   
   ΔE = Delta E = how different the achieved color is from the target.
   LOWER is BETTER.  ΔE = 0 means perfect match.
   
   Grade  ΔE Range       What it means in real textiles
   ────────────────────────────────────────────────────────────
   A+     0.0 – 0.5      Perfect match — imperceptible difference
   A      0.5 – 1.0      Excellent — only instrument can detect it
   B      1.0 – 2.0      Good — skilled observer barely notices
   C      2.0 – 3.0      Acceptable — slight difference visible
   D      3.0 – 4.5      Marginal — clear difference, flag for decision
   F      > 4.5          Fail — obvious mismatch, must re-dye
   
   CLIENT TOLERANCES (real industry):
   ─────────────────────────────────────
   • Luxury / European brands  : ΔE ≤ 1.0   (very strict)
   • Modenik, premium brands   : ΔE ≤ 2.0
   • Standard brands (JG, LUX): ΔE ≤ 3.0
   • Commodity / budget        : ΔE ≤ 4.5
   ───────────────────────────────────────────────────────────── */

// Per-client tolerance thresholds (configurable)
const CLIENT_TOLERANCES = {
  'Modenik': { limit: 2.0, tier: 'Premium' },
  'JG':      { limit: 3.0, tier: 'Standard' },
  'LUX':     { limit: 3.0, tier: 'Standard' },
  'DEFAULT': { limit: 3.0, tier: 'Standard' },
};

const GRADES = [
  { label: 'A+', range: [0,    0.5],  color: '#059669', bg: '#ecfdf5', text: 'Perfect Match',   description: 'Imperceptible — instrument-only detection' },
  { label: 'A',  range: [0.5,  1.0],  color: '#10b981', bg: '#f0fdf4', text: 'Excellent',        description: 'Only a trained observer can notice' },
  { label: 'B',  range: [1.0,  2.0],  color: '#84cc16', bg: '#f7fee7', text: 'Good',             description: 'Slight difference, skilled observer barely notices' },
  { label: 'C',  range: [2.0,  3.0],  color: '#f59e0b', bg: '#fffbeb', text: 'Acceptable',       description: 'Visible difference — needs client tolerance check' },
  { label: 'D',  range: [3.0,  4.5],  color: '#f97316', bg: '#fff7ed', text: 'Marginal',         description: 'Clear difference — flag for client decision' },
  { label: 'F',  range: [4.5,  99],   color: '#ef4444', bg: '#fef2f2', text: 'Re-dye Required',  description: 'Obvious mismatch — cannot ship, must re-dye' },
];

const getGrade = (deltaE) => {
  if (deltaE == null) return null;
  return GRADES.find(g => deltaE >= g.range[0] && deltaE < g.range[1]) || GRADES[GRADES.length - 1];
};

// Result = PASS / MARGINAL / FAIL based on client's own tolerance
const getResult = (deltaE, client) => {
  if (deltaE == null) return { status: 'pending', label: 'Pending', color: '#9ca3af' };
  const tol = (CLIENT_TOLERANCES[client] || CLIENT_TOLERANCES['DEFAULT']).limit;
  if (deltaE <= tol * 0.75)             return { status: 'approved',  label: 'Approved',  color: '#10b981' };
  if (deltaE <= tol)                     return { status: 'marginal',  label: 'Marginal',  color: '#f59e0b' };
  return                                        { status: 'rejected',  label: 'Re-dye',    color: '#ef4444' };
};

/* ── Raw inspection data (your real records) ─────────────────── */
const RAW = [
  { date: '28/11/25', color: 'Navy',      client: 'Modenik', lotNo: '12814/1/D', deltaE: 3.5 },
  { date: '28/11/25', color: 'Olive',     client: 'Modenik', lotNo: '111',       deltaE: 0.6 },
  { date: '28/11/25', color: 'Poseidon',  client: 'Modenik', lotNo: '109',       deltaE: 3.3 },
  { date: '28/11/25', color: 'Graphwine', client: 'Modenik', lotNo: '109',       deltaE: 0.9 },
  { date: '29/11/25', color: 'Air Force', client: 'JG',      lotNo: '371',       deltaE: 3.1 },
  { date: '29/11/25', color: 'Charcoal',  client: 'JG',      lotNo: '371',       deltaE: 3.8 },
  { date: '29/11/25', color: 'Dk. Brown', client: 'JG',      lotNo: '375',       deltaE: null },
  { date: '29/11/25', color: 'DmnBlue',   client: 'JG',      lotNo: '375',       deltaE: 0.4 },
  { date: '1/12/25',  color: 'Olive',     client: 'LUX',     lotNo: '2003',      deltaE: null },
  { date: '1/12/25',  color: 'H. Orange', client: 'LUX',     lotNo: '2002',      deltaE: 3.1 },
  { date: '29/11/25', color: 'Air Force', client: 'JG',      lotNo: '371',       deltaE: 3.7 },
  { date: '2/12/25',  color: 'Navy',      client: 'Modenik', lotNo: '13145',     deltaE: 1.2 },
  { date: '2/12/25',  color: 'Poseidon',  client: 'JG',      lotNo: '109',       deltaE: 1.8 },
  { date: '3/12/25',  color: 'Olive',     client: 'Modenik', lotNo: '13143',     deltaE: 3.4 },
  { date: '3/12/25',  color: 'C. Brown',  client: 'Modenik', lotNo: '112',       deltaE: 0.9 },
];

/* ── ΔE Gauge Bar ────────────────────────────────────────────── */
const DeltaEGauge = ({ deltaE }) => {
  if (!deltaE) return <span className="ci-no-data">—</span>;
  const grade = getGrade(deltaE);
  // Position on a 0–6 scale
  const pct   = Math.min((deltaE / 6) * 100, 100);
  return (
    <div className="de-gauge-wrap">
      <div className="de-gauge-bar">
        <div className="de-gauge-fill" style={{ width: `${pct}%`, background: grade.color }} />
        <div className="de-gauge-pointer" style={{ left: `${pct}%` }} />
      </div>
      <div className="de-gauge-row">
        <span className="de-value" style={{ color: grade.color }}>{deltaE.toFixed(2)}</span>
        <span className="de-grade-badge" style={{ background: grade.bg, color: grade.color, border: `1px solid ${grade.color}55` }}>
          Grade {grade.label}
        </span>
      </div>
    </div>
  );
};

/* ── Tolerance explainer chip ────────────────────────────────── */
const ToleranceChip = ({ client, deltaE }) => {
  if (!deltaE) return null;
  const ct  = CLIENT_TOLERANCES[client] || CLIENT_TOLERANCES['DEFAULT'];
  const res = getResult(deltaE, client);
  return (
    <div className="tol-chip" style={{ borderColor: res.color + '66', background: res.color + '0f' }}>
      <span style={{ color: res.color, fontWeight: 700 }}>{res.label}</span>
      <span className="tol-detail">({ct.tier} ≤ {ct.limit})</span>
    </div>
  );
};

/* ── Main Component ──────────────────────────────────────────── */
const ColorInspection = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [showGuide, setShowGuide]       = useState(false);
  const [clientFilter, setClientFilter] = useState('');

  const inspections = useMemo(() =>
    RAW.map(r => ({
      ...r,
      grade:  getGrade(r.deltaE),
      result: getResult(r.deltaE, r.client),
    })), []);

  const filtered = inspections.filter(i => {
    if (activeFilter !== 'all' && i.result.status !== activeFilter) return false;
    if (clientFilter && i.client !== clientFilter)                  return false;
    if (search && !i.color.toLowerCase().includes(search.toLowerCase()) &&
        !i.client.toLowerCase().includes(search.toLowerCase()) &&
        !i.lotNo.toLowerCase().includes(search.toLowerCase()))       return false;
    return true;
  });

  const withData = inspections.filter(i => i.deltaE != null);
  const approved = inspections.filter(i => i.result.status === 'approved').length;
  const marginal = inspections.filter(i => i.result.status === 'marginal').length;
  const rejected = inspections.filter(i => i.result.status === 'rejected').length;
  const pending  = inspections.filter(i => i.result.status === 'pending').length;
  const avgDE    = withData.length ? (withData.reduce((s,i)=>s+i.deltaE,0)/withData.length).toFixed(2) : '—';

  // Grade distribution for bar chart
  const gradeDist = GRADES.map(g => ({
    grade: `Grade ${g.label}`,
    label: g.text,
    count: withData.filter(i => i.grade?.label === g.label).length,
    color: g.color,
  }));

  const clients = [...new Set(RAW.map(r => r.client))];

  return (
    <div className="color-inspection">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Color Inspection</h1>
          <p className="page-subtitle">ΔE-based shade quality grading — lower ΔE = better match</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="guide-btn" onClick={() => setShowGuide(!showGuide)}>
            <Info size={16}/> ΔE Guide
          </button>
          <button className="new-inspection-button"><Plus size={20}/> New Inspection</button>
        </div>
      </div>

      {/* ΔE Grade Guide Panel */}
      {showGuide && (
        <div className="grade-guide">
          <h3>📊 Understanding ΔE (Delta E) Grades</h3>
          <p className="guide-intro">
            ΔE measures the color difference between the client's target and your achieved shade.
            <strong> ΔE = 0 means a perfect match. Lower is always better.</strong>
          </p>
          <div className="grade-guide-grid">
            {GRADES.map(g => (
              <div key={g.label} className="grade-guide-row" style={{ borderLeft: `4px solid ${g.color}`, background: g.bg }}>
                <span className="gg-grade" style={{ color: g.color }}>Grade {g.label}</span>
                <span className="gg-range">ΔE {g.range[0]}–{g.range[1] < 99 ? g.range[1] : '∞'}</span>
                <span className="gg-text" style={{ color: g.color, fontWeight: 700 }}>{g.text}</span>
                <span className="gg-desc">{g.description}</span>
              </div>
            ))}
          </div>
          <div className="guide-tol">
            <strong>Client Tolerance Bands:</strong>
            <div className="tol-grid">
              {Object.entries(CLIENT_TOLERANCES).filter(([k])=>k!=='DEFAULT').map(([client, ct]) => (
                <div key={client} className="tol-item">
                  <span className="tol-client">{client}</span>
                  <span className="tol-tier">{ct.tier}</span>
                  <span className="tol-limit">ΔE ≤ {ct.limit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="inspection-stats">
        {[
          { label:'Total Inspections', value: inspections.length, icon:<Eye size={22}/>,           color:'#6366f1' },
          { label:'Approved',          value: approved,           icon:<CheckCircle size={22}/>,    color:'#10b981' },
          { label:'Marginal',          value: marginal,           icon:<AlertTriangle size={22}/>,  color:'#f59e0b' },
          { label:'Re-dye Required',   value: rejected,           icon:<XCircle size={22}/>,        color:'#ef4444' },
          { label:'Pending',           value: pending,            icon:<Clock size={22}/>,           color:'#64748b' },
          { label:'Avg ΔE',            value: avgDE,              icon:<span style={{fontSize:18,fontWeight:800}}>ΔE</span>, color: Number(avgDE) > 3 ? '#ef4444' : Number(avgDE) > 2 ? '#f59e0b' : '#10b981' },
        ].map(k => (
          <div className="stat-card" key={k.label}>
            <div className="stat-icon-wrapper" style={{ background: k.color+'1a', color: k.color }}>{k.icon}</div>
            <div className="stat-details">
              <p className="stat-label">{k.label}</p>
              <h3 className="stat-number" style={{ color: k.color }}>{k.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts + Table */}
      <div className="inspection-content">
        {/* Grade Distribution Bar Chart */}
        <div className="chart-card">
          <h3 className="section-title">Grade Distribution</h3>
          <p className="section-sub">How many batches fall into each quality grade</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gradeDist} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="grade" tick={{ fontSize:11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize:11 }} />
              <Tooltip
                formatter={(v, n, p) => [v, `${p.payload.label}`]}
                contentStyle={{ borderRadius:8, border:'1px solid #e5e7eb' }}
              />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {gradeDist.map((g, i) => <Cell key={i} fill={g.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Grade legend */}
          <div className="grade-legend">
            {GRADES.map(g => (
              <div key={g.label} className="gl-item">
                <span className="gl-dot" style={{ background: g.color }} />
                <span className="gl-grade" style={{ color: g.color }}>Grade {g.label}</span>
                <span className="gl-text">{g.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="table-card">
          <div className="table-header">
            <div className="filter-tabs">
              {[
                { key:'all',      label:'All',      count: inspections.length },
                { key:'approved', label:'Approved', count: approved, color:'#10b981' },
                { key:'marginal', label:'Marginal', count: marginal, color:'#f59e0b' },
                { key:'rejected', label:'Re-dye',   count: rejected, color:'#ef4444' },
                { key:'pending',  label:'Pending',  count: pending },
              ].map(t => (
                <button
                  key={t.key}
                  className={`filter-tab ${activeFilter === t.key ? 'active' : ''}`}
                  style={activeFilter === t.key && t.color ? { background: t.color, borderColor: t.color } : {}}
                  onClick={() => setActiveFilter(t.key)}
                >
                  {t.label}
                  <span className="tab-count">{t.count}</span>
                </button>
              ))}
            </div>
            <div className="table-toolbar">
              <div className="search-input">
                <Search size={15}/>
                <input
                  type="text" placeholder="Search color, lot…"
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="client-filter" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
                <option value="">All Clients</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="inspection-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Color</th>
                  <th>Client</th>
                  <th>Lot No.</th>
                  <th>ΔE Reading</th>
                  <th>Result vs Client Tolerance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={idx} className={`ci-row ci-row-${item.result.status}`}>
                    <td className="date-cell">📅 {item.date}</td>
                    <td className="color-cell">
                      <div className="color-indicator">
                        <span className="color-dot" />
                        <span>{item.color}</span>
                      </div>
                    </td>
                    <td>
                      <span className="client-badge">{item.client}</span>
                    </td>
                    <td className="lot-cell">{item.lotNo}</td>
                    <td><DeltaEGauge deltaE={item.deltaE} /></td>
                    <td><ToleranceChip client={item.client} deltaE={item.deltaE} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorInspection;
