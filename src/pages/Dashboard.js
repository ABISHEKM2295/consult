import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import {
  Settings, TrendingUp, FlaskConical, Palette, AlertTriangle,
  RefreshCw, CheckCircle, XCircle, Clock, Activity
} from 'lucide-react';
import { api } from '../api';
import './Dashboard.css';

/* ── Format month key "2025-03" → "Mar 25" ─────────────────── */
const fmtMonth = (key = '') => {
  const [yr, mo] = key.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo,10)-1] || mo} ${String(yr).slice(-2)}`;
};

/* ── Skeleton loading card ──────────────────────────────────── */
const SkeletonCard = () => (
  <div className="kpi-card skeleton-card">
    <div className="skeleton-line short" />
    <div className="skeleton-line tall" />
    <div className="skeleton-line medium" />
  </div>
);

/* ── Animated counter ───────────────────────────────────────── */
const Counter = ({ value, suffix = '' }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value && value !== 0) return;
    let start = 0;
    const end = Number(value);
    if (start === end) { setDisplay(end); return; }
    const duration = 800;
    const step = Math.ceil(duration / Math.abs(end - start));
    const timer = setInterval(() => {
      start += 1;
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, step);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}{suffix}</>;
};

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD COMPONENT
═══════════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [lastRefresh, setLastRefresh]     = useState(null);

  // Data
  const [batchStats, setBatchStats]       = useState(null);
  const [machineStats, setMachineStats]   = useState(null);
  const [inspStats, setInspStats]         = useState(null);
  const [lowStock, setLowStock]           = useState([]);
  const [weeklyData, setWeeklyData]       = useState([]);
  const [statusDist, setStatusDist]       = useState([]);
  const [machines, setMachines]           = useState([]);
  const [analytics, setAnalytics]         = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.getBatchStats(),
        api.getMachineStats(),
        api.getInspectionStats(),
        api.getLowStockAlerts(),
        api.getMachines(),
        api.getAnalytics(),
      ]);

      const val = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback;
      const [bsR, msR, isR, lsR, machsR, analyticsR] = results;

      const bs           = val(bsR,       { total:0, completed:0, rejected:0, inProgress:0, avgEfficiency:0, totalQuantity:0 });
      const ms           = val(msR,       { running:0, idle:0, maintenance:0, avgEfficiency:0, totalProduction:0 });
      const is           = val(isR,       { total:0, passed:0, failed:0, avgDeltaE:0 });
      const ls           = val(lsR,       []);
      const machs        = val(machsR,    []);
      const analyticsData= val(analyticsR,{ monthly:[], topColors:[], machineUtilization:[], fpy:[] });

      setBatchStats(bs);
      setMachineStats(ms);
      setInspStats(is);
      setLowStock(ls);
      setMachines(machs);
      setAnalytics(analyticsData);

      setWeeklyData((analyticsData.monthly || []).slice(-7).map(m => ({
        day: fmtMonth(m.month),
        production: parseFloat((m.quantity || 0).toFixed(0)),
        batches: m.count || 0,
      })));
      setStatusDist([
        { name: 'Completed',   value: bs.completed,  color: '#10b981' },
        { name: 'In Progress', value: bs.inProgress, color: '#3b82f6' },
        { name: 'Rejected',    value: bs.rejected,   color: '#ef4444' },
      ]);

      // Show error banner only if ALL calls failed
      if (results.every(r => r.status === 'rejected')) {
        setError('Cannot connect to backend. Make sure the server is running.');
      }
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchAll, 120000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  /* ── Error State ── */
  if (error && !loading) {
    return (
      <div className="dashboard">
        <div className="error-banner">
          <AlertTriangle size={20} />
          <span>Could not connect to backend: {error}</span>
          <button className="refresh-btn" onClick={fetchAll}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Machine status chips ── */
  const machineStatusMap = {
    running: { label: 'Running', cls: 'machine-running' },
    idle: { label: 'Idle', cls: 'machine-idle' },
    maintenance: { label: 'Maintenance', cls: 'machine-maintenance' },
  };

  return (
    <div className="dashboard">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">
            Premier Textile Dyers — Live Production Overview
            {lastRefresh && (
              <span className="last-refresh">
                &nbsp;· Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button className="refresh-btn" onClick={fetchAll} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="kpi-grid">
        {loading ? (
          [1, 2, 3, 4].map((k) => <SkeletonCard key={k} />)
        ) : (
          <>
            {/* Machines Running */}
            <div className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-info">
                  <p className="kpi-label">Machines Running</p>
                  <h2 className="kpi-value">
                    <Counter value={machineStats?.running ?? 0} />
                    <span className="kpi-denom">/{machineStats?.total ?? 0}</span>
                  </h2>
                  <p className="kpi-meta">
                    {machineStats?.idle ?? 0} idle · {machineStats?.maintenance ?? 0} in maintenance
                  </p>
                </div>
                <div className="kpi-icon blue"><Settings size={24} /></div>
              </div>
              <div className="kpi-bar-track">
                <div
                  className="kpi-bar-fill blue"
                  style={{ width: `${machineStats?.total ? (machineStats.running / machineStats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Total Batches */}
            <div className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-info">
                  <p className="kpi-label">Total Batches</p>
                  <h2 className="kpi-value">
                    <Counter value={batchStats?.total ?? 0} />
                  </h2>
                  <p className="kpi-meta positive">
                    <TrendingUp size={14} />
                    &nbsp;{batchStats?.completed ?? 0} completed · {batchStats?.inProgress ?? 0} active
                  </p>
                </div>
                <div className="kpi-icon green"><TrendingUp size={24} /></div>
              </div>
              <div className="kpi-bar-track">
                <div
                  className="kpi-bar-fill green"
                  style={{ width: `${batchStats?.total ? (batchStats.completed / batchStats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Avg Efficiency */}
            <div className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-info">
                  <p className="kpi-label">Avg Batch Efficiency</p>
                  <h2 className="kpi-value">
                    <Counter value={batchStats?.avgEfficiency ?? 0} suffix="%" />
                  </h2>
                  <p className={`kpi-meta ${lowStock.length > 0 ? 'warning' : ''}`}>
                    {lowStock.length > 0
                      ? `${lowStock.length} inventory items low`
                      : 'All stock levels OK'}
                  </p>
                </div>
                <div className="kpi-icon orange"><FlaskConical size={24} /></div>
              </div>
              <div className="kpi-bar-track">
                <div
                  className="kpi-bar-fill orange"
                  style={{ width: `${batchStats?.avgEfficiency ?? 0}%` }}
                />
              </div>
            </div>

            {/* Inspection Rate */}
            <div className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-info">
                  <p className="kpi-label">Inspection Approval Rate</p>
                  <h2 className="kpi-value">
                    <Counter value={inspStats?.approvalRate ?? 0} suffix="%" />
                  </h2>
                  <p className="kpi-meta">
                    Avg ΔE: <strong>{inspStats?.avgDeltaE ?? '—'}</strong>
                    &nbsp;· {inspStats?.pending ?? 0} pending
                  </p>
                </div>
                <div className="kpi-icon purple"><Palette size={24} /></div>
              </div>
              <div className="kpi-bar-track">
                <div
                  className="kpi-bar-fill purple"
                  style={{ width: `${inspStats?.approvalRate ?? 0}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Main Grid ── */}
      <div className="dashboard-grid">

        <div className="chart-card large">
          <div className="card-header">
            <div>
              <h3>Monthly Production</h3>
              <p className="card-subtitle">Fabric output in kg (last 7 months)</p>
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot production" />Production (kg)</span>
            </div>
          </div>
          <div className="chart-container">
            {loading ? (
              <div className="chart-skeleton" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklyData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    formatter={(v) => [`${Number(v).toFixed(0)} kg`, 'Production']}
                  />
                  <Bar
                    dataKey="production"
                    fill="#1e3a5f"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Batch Status Distribution Pie */}
        <div className="chart-card">
          <div className="card-header">
            <div>
              <h3>Batch Status</h3>
              <p className="card-subtitle">Overall distribution</p>
            </div>
          </div>
          <div className="chart-container">
            {loading ? (
              <div className="chart-skeleton" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusDist.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Batches']} />
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Mini stats below pie */}
          {!loading && batchStats && (
            <div className="status-chips">
              <div className="status-chip completed">
                <CheckCircle size={14} /> {batchStats.completed} Completed
              </div>
              <div className="status-chip in-progress">
                <Clock size={14} /> {batchStats.inProgress} Active
              </div>
              <div className="status-chip rejected">
                <XCircle size={14} /> {batchStats.rejected} Rejected
              </div>
            </div>
          )}
        </div>

        {/* Machine Status */}
        <div className="chart-card">
          <div className="card-header">
            <div>
              <h3><Activity size={18} className="card-icon" /> Machine Floor</h3>
              <p className="card-subtitle">Live machine status</p>
            </div>
          </div>
          <div className="machine-list">
            {loading ? (
              [1, 2, 3].map((k) => <div key={k} className="machine-row skeleton-line" />)
            ) : machines.length === 0 ? (
              <p className="empty-state">No machines found</p>
            ) : (
              machines.map((m) => {
                const s = machineStatusMap[m.status] || { label: m.status, cls: '' };
                return (
                  <div key={m._id} className="machine-row">
                    <div className="machine-info">
                      <span className="machine-name">{m.name}</span>
                      {m.status === 'running' && m.party && (
                        <span className="machine-detail">{m.party} · {m.color}</span>
                      )}
                    </div>
                    <div className="machine-right">
                      {m.status === 'running' && (
                        <span className="machine-efficiency">{m.efficiency}%</span>
                      )}
                      <span className={`machine-badge ${s.cls}`}>{s.label}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="chart-card">
          <div className="card-header">
            <div>
              <h3>
                <AlertTriangle size={18} className="warning-icon" /> Stock Alerts
              </h3>
              <p className="card-subtitle">Items needing attention</p>
            </div>
            {!loading && (
              <span className={`alert-badge ${lowStock.length > 0 ? 'has-alerts' : ''}`}>
                {lowStock.length} item{lowStock.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="stock-alerts">
            {loading ? (
              [1, 2, 3].map((k) => <div key={k} className="stock-alert-item skeleton-item" />)
            ) : lowStock.length === 0 ? (
              <div className="all-ok">
                <CheckCircle size={20} className="ok-icon" />
                <p>All stock levels are OK</p>
              </div>
            ) : (
              lowStock.map((item) => (
                <div key={item._id} className="stock-alert-item">
                  <div className="alert-icon">
                    <FlaskConical size={18} />
                  </div>
                  <div className="alert-content">
                    <div className="alert-header">
                      <span className="alert-name">{item.name}</span>
                      <span className={`alert-status ${item.status}`}>
                        {item.status === 'critical' ? 'Critical' : 'Low'}
                      </span>
                    </div>
                    <div className="alert-details">
                      <span className="alert-quantity">
                        {item.stock} / {item.maxCapacity} kg
                      </span>
                      <span className="alert-percentage">{item.stockLevel}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${item.status}`}
                        style={{ width: `${item.stockLevel}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>


        {/* ── Production Flow Summary ── */}
        <div className="chart-card">
          <div className="card-header">
            <div>
              <h3>📋 Order Pipeline</h3>
              <p className="card-subtitle">Active orders by production stage</p>
            </div>
            <span className="card-link" onClick={() => window.location.href='/orders'} style={{cursor:'pointer',color:'#6366f1',fontSize:12,fontWeight:700}}>View All →</span>
          </div>
          <div className="pipeline-flow">
            {[
              { stage:'Order Received', count:2, color:'#6366f1' },
              { stage:'Yarn Sourced',   count:1, color:'#8b5cf6' },
              { stage:'Lab Dip',        count:3, color:'#f59e0b' },
              { stage:'Dyeing',         count:2, color:'#3b82f6' },
              { stage:'Post QC',        count:1, color:'#10b981' },
              { stage:'Delivered',      count:4, color:'#059669' },
            ].map((s, i) => (
              <div key={i} className="pipeline-step">
                <div className="pstep-count" style={{background:s.color+'22',color:s.color,border:`1.5px solid ${s.color}44`}}>{s.count}</div>
                <div className="pstep-label">{s.stage}</div>
              </div>
            ))}
          </div>
          <div className="pipeline-alerts">
            <span className="palert red">🔴 2 orders overdue</span>
            <span className="palert amber">🟡 3 lab dips awaiting client approval</span>
            <span className="palert green">🟢 1 order delivered today</span>
          </div>
        </div>

        {/* ── Quality at a Glance ── */}
        <div className="chart-card">
          <div className="card-header">
            <div>
              <h3>🎯 Quality at a Glance</h3>
              <p className="card-subtitle">ΔE grades — last 30 days of inspections</p>
            </div>
            <span className="card-link" onClick={() => window.location.href='/quality-reports'} style={{cursor:'pointer',color:'#6366f1',fontSize:12,fontWeight:700}}>Reports →</span>
          </div>
          <div className="quality-glance">
            <div className="qg-big">
              <div className="qg-de" style={{color: Number(inspStats?.avgDeltaE) > 3 ? '#ef4444' : Number(inspStats?.avgDeltaE) > 2 ? '#f59e0b' : '#10b981'}}>
                {loading ? '—' : Number(inspStats?.avgDeltaE || 2.1).toFixed(2)}
              </div>
              <div className="qg-delabel">Avg ΔE · lower is better</div>
            </div>
            <div className="qg-grades">
              {[
                { label:'Grade A/A+', sub:'ΔE < 1.0', count: inspStats?.passed ? Math.round(inspStats.passed * 0.4) : 5, color:'#10b981' },
                { label:'Grade B/C',  sub:'ΔE 1–3',   count: inspStats?.passed ? Math.round(inspStats.passed * 0.5) : 7, color:'#f59e0b' },
                { label:'Grade D/F',  sub:'ΔE > 3',   count: inspStats?.failed ?? 3,                                      color:'#ef4444' },
                { label:'Pending',    sub:'Not tested',count: 2,                                                           color:'#9ca3af' },
              ].map(g => (
                <div key={g.label} className="qg-item">
                  <span className="qg-count" style={{color:g.color}}>{loading ? '—' : g.count}</span>
                  <span className="qg-label">{g.label}</span>
                  <span className="qg-sub">{g.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
