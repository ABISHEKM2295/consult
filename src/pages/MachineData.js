import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, Plus, X, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../api';
import './MachineData.css';

const STAGES = ['TD Load', 'Dyeing', 'Soap Run', 'Soap Steam', 'Unload'];

const statusMap = {
  running:     { label: 'Running',     cls: 'status-running' },
  idle:        { label: 'Idle',        cls: 'status-idle' },
  maintenance: { label: 'Maintenance', cls: 'status-maintenance' },
};

/* ══ small skeleton ═══════════════════════════════════════════ */
const CardSkeleton = () => (
  <div className="machine-card skeleton-card-m">
    <div className="sk-line short" /><div className="sk-line tall" /><div className="sk-line" /><div className="sk-line" />
  </div>
);

/* ══ MAIN COMPONENT ═══════════════════════════════════════════ */
const MachineData = () => {
  const [machines, setMachines]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [completing, setCompleting]   = useState(null);
  const [newlyAdded, setNewlyAdded]   = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [form, setForm] = useState({
    machineId: '', party: '', color: '', lotNo: '',
    quantity: '', stage: 'TD Load', expectedDuration: ''
  });

  /* ── fetch all machines from DB ── */
  const fetchMachines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMachines();
      setMachines(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMachines();
    const interval = setInterval(fetchMachines, 60000); // auto-refresh every 60s
    return () => clearInterval(interval);
  }, [fetchMachines]);

  /* ── derived stats (from live data, same source as dashboard) ── */
  const runningMachines  = machines.filter(m => m.status === 'running');
  const runningCount     = runningMachines.length;
  const totalCount       = machines.length;
  const avgEfficiency    = runningCount > 0
    ? Math.round(runningMachines.reduce((s, m) => s + m.efficiency, 0) / runningCount)
    : 0;
  const totalProduction  = runningMachines.reduce((s, m) => s + (parseFloat(m.quantity) || 0), 0);

  /* ── add job → PUT /api/machines/:id/job ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const target = machines.find(m => m._id === form.machineId);
    if (!target) return;
    try {
      const updated = await fetch(`http://localhost:5000/api/machines/${form.machineId}/job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          party: form.party,
          color: form.color,
          lotNo: form.lotNo,
          quantity: form.quantity,
          stage: form.stage,
        }),
      }).then(r => r.json());
      setMachines(prev => prev.map(m => m._id === updated._id ? updated : m));
      setNewlyAdded(updated._id);
      setTimeout(() => setNewlyAdded(null), 3000);
      setShowModal(false);
      setForm({ machineId: '', party: '', color: '', lotNo: '', quantity: '', stage: 'TD Load', expectedDuration: '' });
    } catch (e) {
      alert('Failed to assign job: ' + e.message);
    }
  };

  /* ── complete job → PUT /api/machines/:id/complete ── */
  const handleComplete = async (machineId) => {
    setCompleting(machineId);
    try {
      const updated = await fetch(`http://localhost:5000/api/machines/${machineId}/complete`, {
        method: 'PUT',
      }).then(r => r.json());
      setMachines(prev => prev.map(m => m._id === updated._id ? updated : m));
    } catch (e) {
      alert('Failed to complete job: ' + e.message);
    } finally {
      setCompleting(null);
    }
  };

  const availableMachines = machines.filter(m => m.status !== 'running');

  /* ══ RENDER ════════════════════════════════════════════════ */
  return (
    <div className="machine-data">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Machine Running Data</h1>
          <p className="page-subtitle">
            Real-time production monitoring
            {lastRefresh && <span className="last-refresh"> · Updated {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="header-btns">
          <button className="refresh-btn-m" onClick={fetchMachines} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="add-job-button" onClick={() => setShowModal(true)}>
            <Plus size={20} /> Add Job
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner-m">
          <AlertTriangle size={18} /> Backend error: {error}
          <button onClick={fetchMachines} className="retry-link">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Activity size={24} /></div>
          <div className="stat-info">
            <p className="stat-label">Running</p>
            <h3 className="stat-value">{loading ? '—' : `${runningCount}/${totalCount}`}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Activity size={24} /></div>
          <div className="stat-info">
            <p className="stat-label">Avg Efficiency</p>
            <h3 className="stat-value">{loading ? '—' : `${avgEfficiency}%`}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Clock size={24} /></div>
          <div className="stat-info">
            <p className="stat-label">Total Production</p>
            <h3 className="stat-value">{loading ? '—' : `${totalProduction.toLocaleString()} kg`}</h3>
          </div>
        </div>
      </div>

      {/* Machine Cards */}
      <div className="machines-grid">
        {loading
          ? [1,2,3,4,5,6].map(k => <CardSkeleton key={k} />)
          : machines.length === 0
            ? <p className="empty-machines">No machines found. Add machines via the backend seed.</p>
            : machines.map(machine => {
                const s = statusMap[machine.status] || { label: machine.status, cls: '' };
                const isNew = newlyAdded === machine._id;
                return (
                  <div
                    key={machine._id}
                    className={`machine-card ${machine.status} ${isNew ? 'newly-added' : ''}`}
                  >
                    <div className="machine-header">
                      <div className="machine-id-badge">{machine.machineId}</div>
                      <span className={`status-badge ${s.cls}`}>
                        <span className="status-dot" />{s.label}
                      </span>
                    </div>

                    <h3 className="machine-name">{machine.name}</h3>

                    {machine.status === 'running' ? (
                      <>
                        <div className="machine-details">
                          {[
                            ['Party',    machine.party],
                            ['Colour',   machine.color],
                            ['Lot No.',  machine.lotNo],
                            ['Quantity', machine.quantity ? `${machine.quantity} kg` : '—'],
                            ['Stage',    machine.stage],
                          ].map(([label, val]) => (
                            <div className="detail-row" key={label}>
                              <span className="detail-label">{label}</span>
                              {label === 'Stage'
                                ? <span className="stage-badge">{val}</span>
                                : <span className="detail-value">{val || '—'}</span>}
                            </div>
                          ))}
                        </div>
                        <div className="efficiency-section">
                          <div className="efficiency-header">
                            <span className="efficiency-label">Efficiency</span>
                            <span className="efficiency-value">{machine.efficiency}%</span>
                          </div>
                          <div className="efficiency-bar">
                            <div className="efficiency-fill" style={{ width: `${machine.efficiency}%` }} />
                          </div>
                          {machine.startTime && (
                            <div className="runtime">
                              Started: {new Date(machine.startTime).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                        <button
                          className="complete-btn"
                          onClick={() => handleComplete(machine._id)}
                          disabled={completing === machine._id}
                        >
                          <CheckCircle size={14} />
                          {completing === machine._id ? 'Completing…' : 'Mark Complete'}
                        </button>
                      </>
                    ) : (
                      <div className="machine-status-message">
                        {machine.status === 'idle'
                          ? <p>No active job</p>
                          : <p>Under maintenance</p>}
                      </div>
                    )}
                  </div>
                );
              })
        }
      </div>

      {/* Add Job Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Job</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="job-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="machineId">Select Machine *</label>
                  <select
                    id="machineId" name="machineId"
                    value={form.machineId}
                    onChange={e => setForm(p => ({ ...p, machineId: e.target.value }))}
                    required
                  >
                    <option value="">Choose a machine</option>
                    {availableMachines.map(m => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.machineId}) — {m.status}
                      </option>
                    ))}
                  </select>
                </div>
                {[
                  ['party', 'Party Name *', 'text', 'e.g., LUX, Modenik'],
                  ['color', 'Color *', 'text', 'e.g., Navy Blue, Olive'],
                  ['lotNo', 'Lot Number *', 'text', 'e.g., 2384/2385'],
                  ['quantity', 'Quantity (kg) *', 'number', 'e.g., 450'],
                  ['expectedDuration', 'Expected Duration (hrs) *', 'number', 'e.g., 6'],
                ].map(([name, label, type, placeholder]) => (
                  <div className="form-group" key={name}>
                    <label htmlFor={name}>{label}</label>
                    <input
                      id={name} name={name} type={type}
                      placeholder={placeholder}
                      value={form[name]}
                      onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
                      required min={type === 'number' ? 1 : undefined}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <label htmlFor="stage">Starting Stage *</label>
                  <select
                    id="stage" name="stage"
                    value={form.stage}
                    onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}
                    required
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Add Job</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MachineData;
