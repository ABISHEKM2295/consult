import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, X, RefreshCw, AlertTriangle, Package,
  Clock, CheckCircle, ChevronDown, ArrowRight
} from 'lucide-react';
import { api } from '../api';
import './Orders.css';

/* ── 11 Stages ───────────────────────────────────────────────── */
const STAGES = [
  { key: 'order_received',  label: 'Order Received',  icon: '📋', color: '#6366f1' },
  { key: 'yarn_sourced',    label: 'Yarn Sourced',    icon: '🧵', color: '#8b5cf6' },
  { key: 'knitting',        label: 'Knitting',        icon: '⚙️', color: '#ec4899' },
  { key: 'fabric_received', label: 'Fabric Received', icon: '📦', color: '#f59e0b' },
  { key: 'pre_qc',          label: 'Pre QC',          icon: '🔍', color: '#f97316' },
  { key: 'reversed',        label: 'Reversed',        icon: '🔄', color: '#10b981' },
  { key: 'lab_dip',         label: 'Lab Dip',         icon: '🧪', color: '#14b8a6' },
  { key: 'dyeing',          label: 'Dyeing',          icon: '🎨', color: '#3b82f6' },
  { key: 'post_qc',         label: 'Post QC',         icon: '✅', color: '#22c55e' },
  { key: 'drying',          label: 'Drying',          icon: '💨', color: '#64748b' },
  { key: 'delivered',       label: 'Delivered',       icon: '🚚', color: '#059669' },
];

/* ── Per-stage business conditions ──────────────────────────── */
const STAGE_CONDITIONS = {
  order_received: {
    title: 'Yarn Sourcing Confirmation',
    description: 'Before moving to Yarn Sourced, confirm yarn specifications and supplier details.',
    fields: [
      { name: 'yarnSupplier',      label: 'Yarn Supplier Name',         type: 'text',   required: true },
      { name: 'yarnQtyOrdered',    label: 'Quantity Ordered (kg)',       type: 'number', required: true },
      { name: 'yarnDeliveryDate',  label: 'Expected Delivery Date',      type: 'date',   required: true },
    ],
    blockField: null,
  },
  yarn_sourced: {
    title: 'Yarn Receipt & Quality Check',
    description: 'Confirm yarn received at facility. Quality must be acceptable before knitting.',
    fields: [
      { name: 'receivedWeight',    label: 'Received Weight (kg)',        type: 'number', required: true },
      { name: 'receivedDate',      label: 'Date Received',               type: 'date',   required: true },
      { name: 'yarnQualityGrade',  label: 'Yarn Quality Grade',          type: 'select', required: true,
        options: ['A-Grade (Proceed)', 'B-Grade (Proceed with caution)', 'Rejected (Cannot proceed)'] },
    ],
    blockField: 'yarnQualityGrade',
    blockValue: 'Rejected (Cannot proceed)',
    blockMessage: 'Yarn has been rejected. Cannot proceed to knitting. Return yarn to supplier.',
  },
  knitting: {
    title: 'Knitting Completion',
    description: 'Confirm knitting is complete and fabric is ready to dispatch to dyeing unit.',
    fields: [
      { name: 'knittingMachineId', label: 'Knitting Machine ID',         type: 'text',   required: true },
      { name: 'fabricWeightOut',   label: 'Fabric Weight Produced (kg)', type: 'number', required: true },
      { name: 'knittingDoneDate',  label: 'Completion Date',             type: 'date',   required: true },
      { name: 'knittingNotes',     label: 'Knitting Notes',              type: 'text',   required: false },
    ],
    blockField: null,
  },
  fabric_received: {
    title: 'Fabric Receipt & Pre-QC Readiness',
    description: 'Confirm fabric has arrived at the dyeing facility and is ready for Pre-QC inspection.',
    fields: [
      { name: 'fabricReceivedWeight', label: 'Fabric Weight at Receipt (kg)', type: 'number', required: true },
      { name: 'fabricReceivedDate',   label: 'Date Received',                  type: 'date',   required: true },
      { name: 'visualDefects',        label: 'Visual Defects Observed',         type: 'select', required: true,
        options: ['None', 'Minor pilling (acceptable)', 'Major defects (flag for QC)'] },
    ],
    blockField: null,
  },
  pre_qc: {
    title: 'Pre-QC Inspection',
    description: 'Inspect for knitting defects, GSM, structure. Fabric MUST PASS before reversing.',
    fields: [
      { name: 'preQcInspector',   label: 'Inspector Name',              type: 'text',   required: true },
      { name: 'gsmReading',       label: 'GSM Reading',                 type: 'number', required: true },
      { name: 'fabricStructure',  label: 'Fabric Structure',            type: 'select', required: true,
        options: ['Uniform (OK)', 'Slight variation (acceptable)', 'Non-uniform (flag)'] },
      { name: 'preQcDecision',    label: 'QC Decision',                 type: 'select', required: true,
        options: ['PASS — Proceed to Reversal', 'FAIL — Return to Knitting Unit'] },
      { name: 'preQcRemarks',     label: 'Remarks',                     type: 'text',   required: false },
    ],
    blockField: 'preQcDecision',
    blockValue: 'FAIL — Return to Knitting Unit',
    blockMessage: '🚫 Pre-QC FAILED. Fabric cannot proceed. Raise a rejection notice with the knitting unit. The order is put on hold.',
  },
  reversed: {
    title: 'Fabric Reversal Confirmation',
    description: 'The fabric must be reversed (inside-out) so dyeing imperfections stay on the inner surface.',
    fields: [
      { name: 'reversedBy',       label: 'Reversed By (Operator)',      type: 'text',   required: true },
      { name: 'reversalVerified', label: 'Reversal Status',             type: 'select', required: true,
        options: ['Confirmed — fabric fully reversed', 'Pending — not yet reversed'] },
    ],
    blockField: 'reversalVerified',
    blockValue: 'Pending — not yet reversed',
    blockMessage: '⚠️ Reversal must be completed and confirmed before lab dip development can begin.',
  },
  lab_dip: {
    title: 'Lab Dip Client Approval',
    description: 'Lab dip must be approved by the client. The approved recipe is locked for production.',
    fields: [
      { name: 'labDipRef',        label: 'Lab Dip Reference No.',       type: 'text',   required: true },
      { name: 'labDipAttempts',   label: 'No. of Attempts Made',        type: 'number', required: true },
      { name: 'deltaEAchieved',   label: 'ΔE Achieved (CIEDE2000)',     type: 'number', required: true },
      { name: 'clientApproval',   label: 'Client Approval',             type: 'select', required: true,
        options: ['Approved — recipe locked', 'Pending client response', 'Rejected — needs revision'] },
      { name: 'approvedRecipeCode', label: 'Approved Recipe Code',      type: 'text',   required: false },
    ],
    blockField: 'clientApproval',
    blockValue: 'Rejected — needs revision',
    blockMessage: '🚫 Client has rejected the lab dip. A new attempt is required before dyeing can start.',
    blockValues: ['Pending client response', 'Rejected — needs revision'],
  },
  dyeing: {
    title: 'Dyeing Completion',
    description: 'Confirm dyeing has been completed using the approved recipe.',
    fields: [
      { name: 'dyeingMachine',    label: 'Dyeing Machine Used',         type: 'text',   required: true },
      { name: 'dyeingOperator',   label: 'Operator Name',               type: 'text',   required: true },
      { name: 'dyeingTempC',      label: 'Dyeing Temperature (°C)',     type: 'number', required: true },
      { name: 'dyeingDurationHr', label: 'Process Duration (hrs)',       type: 'number', required: true },
      { name: 'dyeingDate',       label: 'Completion Date',             type: 'date',   required: true },
    ],
    blockField: null,
  },
  post_qc: {
    title: 'Post-QC Shade Inspection',
    description: 'Measure ΔE against the approved lab dip. Shade must be within tolerance to proceed.',
    fields: [
      { name: 'postQcInspector',  label: 'Inspector Name',              type: 'text',   required: true },
      { name: 'postDeltaE',       label: 'ΔE Reading (CIEDE2000)',      type: 'number', required: true },
      { name: 'toleranceLimit',   label: 'Client Tolerance (ΔE ≤)',     type: 'number', required: true },
      { name: 'postQcDecision',   label: 'Shade Approval',              type: 'select', required: true,
        options: ['APPROVED — within tolerance', 'REJECTED — re-dyeing required'] },
      { name: 'postQcRemarks',    label: 'Remarks',                     type: 'text',   required: false },
    ],
    blockField: 'postQcDecision',
    blockValue: 'REJECTED — re-dyeing required',
    blockMessage: '🚫 Post-QC REJECTED. Shade is out of tolerance. Fabric must be re-dyed or rejected. Cannot proceed to drying.',
  },
  drying: {
    title: 'Drying & Packing Confirmation',
    description: 'Confirm fabric is dried, rolled/folded, and packed for dispatch.',
    fields: [
      { name: 'dryingMethod',     label: 'Drying Method',               type: 'select', required: true,
        options: ['Tumble Dry', 'Air Dry', 'Stenter Machine'] },
      { name: 'finalWeightKg',    label: 'Final Weight After Drying (kg)', type: 'number', required: true },
      { name: 'rollCount',        label: 'No. of Rolls / Pieces',        type: 'number', required: true },
      { name: 'packedBy',         label: 'Packed By (Operator)',         type: 'text',   required: true },
    ],
    blockField: null,
  },
};

const EMPTY_FORM = {
  clientName:'', fabricType:'', yarnSpec:'', targetColor:'',
  colorRef:'', quantity:'', deadline:'', notes:''
};

/* ── CSV download of filtered orders ── */
const downloadCSV = (ordersList) => {
  const headers = [
    'Order No', 'Client', 'Analysis Month', 'Target Color', 'Fabric Type', 
    'Quantity (kg)', 'Current Stage', 'Deadline', 'Status'
  ];
  
  const rows = ordersList.map(o => {
    // Derive Analysis Month: if not delivered, mathematically shift to next month for pipeline projection report
    let analysisMonthStr = '—';
    // Use createdAt or current date as baseline
    const baseDate = o.createdAt || new Date().toISOString(); 
    if (baseDate) {
        const d = new Date(baseDate);
        if (o.currentStage !== 'delivered') {
            d.setMonth(d.getMonth() + 1);
        }
        analysisMonthStr = d.toISOString().substring(0, 7);
    }
    
    return [
      o.orderNo, o.clientName, analysisMonthStr, o.targetColor, o.fabricType || '—', 
      o.quantity, o.currentStage, o.deadline ? o.deadline.substring(0,10) : '—', 
      o.currentStage === 'delivered' ? 'Completed' : 'In Progress'
    ];
  });

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `Order_Pipeline_Analysis_${new Date().toISOString().slice(0,10)}.csv`,
  });
  document.body.appendChild(a); a.click(); a.remove();
};

/* ── Helpers ─────────────────────────────────────────────────── */
const stageIdx  = (key) => STAGES.findIndex(s => s.key === key);
const stageInfo = (key) => STAGES.find(s => s.key === key) || STAGES[0];
const pct       = (o)   => Math.round((stageIdx(o.currentStage) / (STAGES.length - 1)) * 100);
const isOverdue = (o)   => o.deadline && new Date() > new Date(o.deadline) && o.status !== 'completed';

/* ── Stage-Advance Modal with business conditions ────────────── */
const AdvanceModal = ({ order, onConfirm, onClose, loading }) => {
  const currIdx  = stageIdx(order.currentStage);
  const currSt   = stageInfo(order.currentStage);
  const nextSt   = STAGES[currIdx + 1];
  const cond     = STAGE_CONDITIONS[order.currentStage];
  const [fields, setFields] = useState({});
  const [error, setError]   = useState('');

  const setField = (name, val) => setFields(p => ({ ...p, [name]: val }));

  const handleSubmit = () => {
    setError('');
    // 1. Check all required fields filled
    const missing = cond.fields.filter(f => f.required && !fields[f.name]?.toString().trim());
    if (missing.length) {
      setError('Please fill in: ' + missing.map(f => f.label).join(', '));
      return;
    }
    // 2. Check block conditions (single or multiple block values)
    const blockVals = cond.blockValues || (cond.blockValue ? [cond.blockValue] : []);
    if (cond.blockField && blockVals.includes(fields[cond.blockField])) {
      setError(cond.blockMessage);
      return;
    }
    // 3. All good — advance with notes summary
    const notes = Object.entries(fields)
      .map(([k, v]) => {
        const f = cond.fields.find(f => f.name === k);
        return f ? `${f.label}: ${v}` : null;
      })
      .filter(Boolean).join(' | ');
    onConfirm(notes);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="advance-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="advance-modal-header">
          <div>
            <h2>{cond?.title || 'Advance Stage'}</h2>
            <p className="advance-sub">{order.orderNo} · {order.clientName}</p>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20}/></button>
        </div>

        {/* Stage transition */}
        <div className="adv-transition">
          <div className="adv-chip" style={{ borderColor: currSt.color }}>
            <span>{currSt.icon}</span>
            <span style={{ color: currSt.color }}>{currSt.label}</span>
          </div>
          <div className="adv-arrow">
            <ArrowRight size={22} strokeWidth={2.5} color="#1e3a5f" />
          </div>
          <div className="adv-chip next-chip" style={{ borderColor: nextSt.color, background: nextSt.color + '15' }}>
            <span>{nextSt.icon}</span>
            <span style={{ color: nextSt.color, fontWeight: 700 }}>{nextSt.label}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="adv-progress-wrap">
          <div className="adv-progress-bar">
            <div className="adv-progress-fill" style={{ width: `${((currIdx + 1) / (STAGES.length - 1)) * 100}%`, background: nextSt.color }} />
          </div>
          <span className="adv-progress-label">Stage {currIdx + 2} of {STAGES.length} after advance</span>
        </div>

        {/* Body — business condition form */}
        <div className="advance-modal-body">
          <p className="cond-desc">{cond?.description}</p>

          {cond?.fields.map(f => (
            <div className="form-group" key={f.name} style={{ marginBottom: 12 }}>
              <label>{f.label}{f.required && <span className="req-star"> *</span>}</label>
              {f.type === 'select' ? (
                <select value={fields[f.name] || ''} onChange={e => setField(f.name, e.target.value)}>
                  <option value="">— Select —</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type}
                  step={f.type === 'number' ? 'any' : undefined}
                  value={fields[f.name] || ''}
                  onChange={e => setField(f.name, e.target.value)}
                  placeholder={f.label}
                />
              )}
            </div>
          ))}

          {error && (
            <div className="adv-error">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="advance-modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-advance"
            style={{ background: nextSt.color }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '⏳ Advancing…' : `${nextSt.icon} Confirm & Move to ${nextSt.label}`}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Main ────────────────────────────────────────────────────── */
const Orders = () => {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [search, setSearch]           = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [selected, setSelected]       = useState(null);
  const [advTarget, setAdvTarget]     = useState(null);
  const [advLoading, setAdvLoading]   = useState(false);
  const [toast, setToast]             = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const toastRef = useRef(null);

  const showToast = (msg, color = '#10b981') => {
    setToast({ msg, color });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.getOrders(search ? { search } : {});
      setOrders(data); setLastRefresh(new Date());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const o = await api.createOrder(form);
      setOrders(p => [o, ...p]);
      setShowModal(false); setForm(EMPTY_FORM);
      showToast(`✅ ${o.orderNo} created!`);
    } catch(e) { showToast('❌ ' + e.message, '#ef4444'); }
  };

  const handleAdvanceConfirm = async (notes) => {
    if (!advTarget) return;
    setAdvLoading(true);
    try {
      const updated = await api.advanceOrder(advTarget._id, { notes });
      setOrders(p => p.map(o => o._id === updated._id ? updated : o));
      if (selected?._id === updated._id) setSelected(updated);
      const st = stageInfo(updated.currentStage);
      showToast(`${st.icon} Moved to ${st.label}`, st.color);
      setAdvTarget(null);
    } catch(e) { showToast('❌ ' + e.message, '#ef4444'); }
    finally { setAdvLoading(false); }
  };

  const visible = orders.filter(o => {
    if (filterStage && o.currentStage !== filterStage) return false;
    return true;
  });

  const total   = orders.length;
  const overdue = orders.filter(isOverdue).length;
  const done    = orders.filter(o => o.status === 'completed').length;

  return (
    <div className="orders-page">
      {/* Toast */}
      {toast && <div className="orders-toast" style={{ background: toast.color }}>{toast.msg}</div>}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Order Lifecycle</h1>
          <p className="page-subtitle">
            Track every order through 11 production stages
            {lastRefresh && <span style={{color:'#9ca3af'}}> · {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="orders-header-btns">
          <button className="orders-refresh-btn" onClick={fetchOrders} title="Refresh"><RefreshCw size={15}/></button>
          <button className="orders-new-btn" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }} onClick={() => downloadCSV(visible)}>📥 Export Pipeline CSV</button>
          <button className="orders-new-btn" onClick={() => setShowModal(true)}><Plus size={16}/> New Order</button>
        </div>
      </div>

      {error && <div className="orders-error"><AlertTriangle size={15}/> {error}</div>}

      {/* KPIs */}
      <div className="orders-kpi-row">
        {[
          { label:'Total',       value: total,              icon: <Package size={18}/>,       color:'#6366f1' },
          { label:'In Progress', value: total-done-overdue, icon: <Clock size={18}/>,         color:'#f59e0b' },
          { label:'Overdue',     value: overdue,            icon: <AlertTriangle size={18}/>,  color:'#ef4444' },
          { label:'Delivered',   value: done,               icon: <CheckCircle size={18}/>,   color:'#10b981' },
        ].map(k => (
          <div className="orders-kpi" key={k.label}>
            <div className="orders-kpi-icon" style={{background: k.color+'1a', color: k.color}}>{k.icon}</div>
            <div><p>{k.label}</p><h3 style={{color: k.color}}>{loading?'—':k.value}</h3></div>
          </div>
        ))}
      </div>

      {/* Search + Stage Filter */}
      <div className="orders-toolbar">
        <input
          className="orders-search"
          placeholder="🔍  Search by client, color, order no…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="orders-stage-filter"
          value={filterStage}
          onChange={e => setFilterStage(e.target.value)}
        >
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
        </select>
      </div>

      {/* Stage filter pills */}
      <div className="stage-pills">
        <button
          className={`stage-pill ${!filterStage ? 'active-pill' : ''}`}
          onClick={() => setFilterStage('')}
        >
          All <span className="pill-count">{total}</span>
        </button>
        {STAGES.map(s => {
          const cnt = orders.filter(o => o.currentStage === s.key).length;
          if (!cnt) return null;
          return (
            <button
              key={s.key}
              className={`stage-pill ${filterStage === s.key ? 'active-pill' : ''}`}
              style={filterStage === s.key ? { background: s.color, color: '#fff', borderColor: s.color } : {}}
              onClick={() => setFilterStage(filterStage === s.key ? '' : s.key)}
            >
              {s.icon} {s.label} <span className="pill-count" style={filterStage === s.key ? {background:'#ffffff33'} : {}}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Order Cards Grid */}
      {loading ? (
        <div className="orders-grid">
          {[1,2,3,4].map(k => <div key={k} className="order-card-skeleton" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="orders-empty">No orders found</div>
      ) : (
        <div className="orders-grid">
          {visible.map(order => {
            const st  = stageInfo(order.currentStage);
            const idx = stageIdx(order.currentStage);
            const p   = pct(order);
            const overdue = isOverdue(order);
            const cond = STAGE_CONDITIONS[order.currentStage];
            return (
              <div
                key={order._id}
                className={`order-card ${overdue ? 'order-card-overdue' : ''} ${order.status === 'completed' ? 'order-card-done' : ''}`}
                onClick={() => setSelected(order)}
              >
                {/* Card top row */}
                <div className="oc-top">
                  <div>
                    <span className="oc-no">{order.orderNo}</span>
                    {overdue && <span className="oc-overdue-badge">OVERDUE</span>}
                  </div>
                  <div className="oc-stage-badge" style={{ background: st.color + '1a', color: st.color, borderColor: st.color + '55' }}>
                    {st.icon} {st.label}
                  </div>
                </div>

                {/* Client + details */}
                <div className="oc-client">{order.clientName}</div>
                <div className="oc-meta">
                  <span>🎨 {order.targetColor}</span>
                  <span>⚖️ {order.quantity} kg</span>
                  {order.fabricType && <span>🧶 {order.fabricType}</span>}
                </div>
                {order.deadline && (
                  <div className="oc-deadline" style={{ color: overdue ? '#ef4444' : '#6b7280' }}>
                    📅 {new Date(order.deadline).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                  </div>
                )}

                {/* Progress bar */}
                <div className="oc-progress-wrap">
                  <div className="oc-progress-bar">
                    <div className="oc-progress-fill" style={{ width: `${p}%`, background: st.color }} />
                  </div>
                  <span className="oc-progress-label">{p}% · Stage {idx + 1}/{STAGES.length}</span>
                </div>

                {/* Advance button */}
                {order.currentStage !== 'delivered' && (
                  <button
                    className="oc-advance-btn"
                    style={{ borderColor: st.color, color: st.color }}
                    onClick={e => { e.stopPropagation(); setAdvTarget(order); }}
                  >
                    {STAGES[idx + 1]?.icon} Advance to {STAGES[idx + 1]?.label}
                    <ChevronDown size={13} style={{ transform: 'rotate(-90deg)', marginLeft: 3 }} />
                  </button>
                )}

                {/* Stage condition hint */}
                {cond && order.currentStage !== 'delivered' && (
                  <div className="oc-cond-hint">
                    ⚙️ {cond.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stage-Advance Confirmation Modal */}
      {advTarget && (
        <AdvanceModal
          order={advTarget}
          onConfirm={handleAdvanceConfirm}
          onClose={() => setAdvTarget(null)}
          loading={advLoading}
        />
      )}

      {/* Detail Sidebar */}
      {selected && (
        <div className="order-sidebar-overlay" onClick={() => setSelected(null)}>
          <div className="order-sidebar" onClick={e => e.stopPropagation()}>
            <div className="sidebar-header">
              <div>
                <h3>{selected.orderNo}</h3>
                <p>{selected.clientName} · {selected.targetColor}</p>
              </div>
              <button className="close-btn" onClick={() => setSelected(null)}><X size={20}/></button>
            </div>
            <div className="sidebar-body">
              {/* Current stage highlight */}
              {(() => {
                const st = stageInfo(selected.currentStage);
                return (
                  <div className="sidebar-stage-banner" style={{ background: st.color + '18', borderLeft: `4px solid ${st.color}` }}>
                    <div>
                      <div style={{ fontWeight: 700, color: st.color }}>{st.icon} {st.label}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        Stage {stageIdx(selected.currentStage) + 1} of {STAGES.length} · {pct(selected)}% complete
                      </div>
                    </div>
                    {isOverdue(selected) && <span className="oc-overdue-badge">OVERDUE</span>}
                  </div>
                );
              })()}

              {/* Details */}
              {[
                ['Fabric Type',  selected.fabricType],
                ['Yarn Spec',    selected.yarnSpec],
                ['Quantity',     `${selected.quantity} kg`],
                ['Color Ref',    selected.colorRef],
                ['Deadline',     selected.deadline ? new Date(selected.deadline).toLocaleDateString('en-GB') : '—'],
                ['Status',       selected.status],
              ].map(([k,v]) => (
                <div className="sidebar-row" key={k}>
                  <span className="sidebar-label">{k}</span>
                  <span className="sidebar-value">{v || '—'}</span>
                </div>
              ))}
              {selected.notes && <div className="sidebar-notes"><strong>Notes:</strong> {selected.notes}</div>}

              {/* Stage condition requirement */}
              {STAGE_CONDITIONS[selected.currentStage] && selected.currentStage !== 'delivered' && (
                <div className="sidebar-next-step">
                  <p className="sidebar-section-title">Next Required Action</p>
                  <div className="next-step-box">
                    <div className="next-step-title">{STAGE_CONDITIONS[selected.currentStage].title}</div>
                    <div className="next-step-desc">{STAGE_CONDITIONS[selected.currentStage].description}</div>
                    <ul className="next-step-fields">
                      {STAGE_CONDITIONS[selected.currentStage].fields
                        .filter(f => f.required)
                        .map(f => <li key={f.name}>{f.label}</li>)}
                    </ul>
                  </div>
                  {selected.currentStage !== 'delivered' && (
                    <button
                      className="sidebar-advance-btn"
                      style={{ background: stageInfo(selected.currentStage).color }}
                      onClick={() => setAdvTarget(selected)}
                    >
                      {STAGES[stageIdx(selected.currentStage)+1]?.icon} Advance to {STAGES[stageIdx(selected.currentStage)+1]?.label}
                    </button>
                  )}
                </div>
              )}

              {/* Stage History Timeline */}
              {selected.stageHistory?.length > 0 && (
                <>
                  <p className="sidebar-section-title" style={{ marginTop: 16 }}>Stage History</p>
                  <div className="history-timeline">
                    {[...selected.stageHistory].reverse().map((h, i) => {
                      const st = stageInfo(h.stage);
                      return (
                        <div key={i} className="history-item">
                          <div className="history-dot" style={{ background: st.color }}>{st.icon}</div>
                          <div className="history-content">
                            <div className="history-stage" style={{ color: st.color }}>{st.label}</div>
                            <div className="history-time">{h.enteredAt ? new Date(h.enteredAt).toLocaleString('en-GB') : ''}</div>
                            {h.notes && <div className="history-notes">{h.notes}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Full Pipeline */}
              <p className="sidebar-section-title" style={{ marginTop: 14 }}>Full Pipeline</p>
              <div className="pipeline-track">
                {STAGES.map((s, i) => {
                  const curr = stageIdx(selected.currentStage);
                  const isDone = i < curr;
                  const isActive = i === curr;
                  return (
                    <div key={s.key} className={`pipeline-step ${isDone?'done':''} ${isActive?'active':''}`}>
                      <div className="pipeline-dot" style={{ background: isActive?s.color : isDone?'#10b981':'#e5e7eb' }} />
                      <span className="pipeline-label">{s.icon} {s.label}</span>
                      {isDone   && <span style={{ color:'#10b981', fontSize:10, marginLeft:'auto' }}>✓ Done</span>}
                      {isActive && <span style={{ color:s.color,   fontSize:10, marginLeft:'auto', fontWeight:700 }}>← Now</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="orders-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-o">
              <h2>📋 New Order</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={22}/></button>
            </div>
            <form className="orders-form" onSubmit={handleCreate}>
              <div className="orders-form-grid">
                {[
                  ['clientName',  'Client / Brand Name *', 'text',   'e.g. LUX, Modenik'],
                  ['fabricType',  'Fabric Type *',          'text',   'e.g. Single Jersey, Fleece'],
                  ['yarnSpec',    'Yarn Specification',     'text',   'e.g. 30/1 Carded Cotton'],
                  ['targetColor', 'Target Color *',         'text',   'e.g. Navy Blue'],
                  ['colorRef',    'Color Reference',        'text',   'e.g. Pantone 19-4024'],
                  ['quantity',    'Quantity (kg) *',        'number', ''],
                  ['deadline',    'Delivery Deadline',      'date',   ''],
                ].map(([name, label, type, ph]) => (
                  <div className="form-group" key={name}>
                    <label>{label}</label>
                    <input
                      type={type} placeholder={ph}
                      value={form[name]}
                      onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
                      required={label.includes('*')}
                      min={type==='number' ? 1 : undefined}
                    />
                  </div>
                ))}
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Notes / Special Requirements</label>
                  <textarea rows={3} value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Any special client requirements…" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-submit">📋 Create Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
