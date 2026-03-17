import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Download, Calendar, FlaskConical, Cpu, RefreshCw, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';
import './BatchHistory.css';

const ITEMS_PER_PAGE = 8;

/* ── helper: map DB batch to display shape ── */
const normalizeBatch = (b) => ({
  id:         b.batchId,
  _id:        b._id,
  date:       b.date || b.createdAt?.slice(0,10) || '—',
  machine:    b.machine,
  party:      b.party,
  color:      b.color,
  lotNo:      b.lotNo,
  quantity:   typeof b.quantity === 'string' ? b.quantity : `${b.quantity} kg`,
  duration:   b.duration,
  status:     b.status,
  efficiency: b.efficiency ?? 0,
  deltaE:     b.deltaE ?? null,
  operator:   b.operator,
  recipe:     b.recipe  || { dyes: [], chemicals: [] },
  stages:     b.stages  || [],
  costs:      b.costs   || null,
});

/* ── PDF Certificate download ── */
const downloadPdfCertificate = async (batch) => {
  try {
    // The api.js file already has getCertificate which returns the URL string
    // We just need to open it or trigger a download
    const url = api.getCertificate(batch._id);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Certificate_${batch.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error("Failed to download PDF", err);
    alert("Failed to generate PDF Certificate. Please try again.");
  }
};

/* ── CSV download of filtered batches ── */
const downloadCSV = (batches) => {
  const headers = [
    'Batch ID', 'Date', 'Analysis Month', 'Machine', 'Party', 'Color', 'Lot No', 
    'Quantity', 'Duration', 'Status', 'Efficiency%', 'DeltaE', 'Operator',
    'Chemical Cost ($)', 'Utility Cost ($)', 'Total Cost ($)', 'Dyes Used', 'Chemicals Used'
  ];
  const rows = batches.map(b => {
    // Derive Month for easy pivot table analysis (e.g., "2026-03")
    let analysisMonthStr = '—';
    if (b.date !== '—') {
        const d = new Date(b.date);
        // If the batch is in-progress, we push the cost/completion analysis to the next month
        if (b.status === 'in-progress') {
            d.setMonth(d.getMonth() + 1);
        }
        analysisMonthStr = d.toISOString().substring(0, 7);
    }
    
    // Financials
    const chemCost = b.costs ? b.costs.chemicals : 0;
    const utilCost = b.costs ? b.costs.utilities : 0;
    const totCost  = b.costs ? b.costs.total : 0;
    
    // Recipes
    const dyesCount = b.recipe?.dyes?.length || 0;
    const chemCount = b.recipe?.chemicals?.length || 0;

    return [
      b.id, b.date, analysisMonthStr, b.machine, b.party, b.color, b.lotNo, b.quantity, 
      b.duration, b.status, b.efficiency, b.deltaE ?? '', b.operator,
      chemCost, utilCost, totCost, dyesCount, chemCount
    ];
  });
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `Batch_History_Analysis_${new Date().toISOString().slice(0,10)}.csv`,
  });
  document.body.appendChild(a); a.click(); a.remove();
};

/* ══════════════════════════════════════ COMPONENT ══════════════════════════════════════ */
const BatchHistory = () => {
  const [batches, setBatches]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [batchStats, setBatchStats]     = useState(null);
  const [lastRefresh, setLastRefresh]   = useState(null);

  const [searchQuery, setSearchQuery]   = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMachine, setFilterMachine] = useState('all');
  const [filterParty, setFilterParty]   = useState('all');
  const [sortBy, setSortBy]             = useState('date');
  const [sortOrder, setSortOrder]       = useState('desc');
  const [currentPage, setCurrentPage]   = useState(1);
  const [selectedBatch, setSelectedBatch] = useState(null);

  /* ── fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [raw, stats] = await Promise.all([
        api.getBatches(),
        api.getBatchStats(),
      ]);
      setBatches(raw.map(normalizeBatch));
      setBatchStats(stats);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── derived unique values for filter dropdowns ── */
  const uniqueMachines = [...new Set(batches.map(b => b.machine))].filter(Boolean).sort();
  const uniqueParties  = [...new Set(batches.map(b => b.party))].filter(Boolean).sort();

  /* ── filter + sort ── */
  const filtered = batches
    .filter(b => {
      const q = searchQuery.toLowerCase();
      if (q && !`${b.id} ${b.color} ${b.lotNo} ${b.party}`.toLowerCase().includes(q)) return false;
      if (filterStatus  !== 'all' && b.status  !== filterStatus)  return false;
      if (filterMachine !== 'all' && b.machine !== filterMachine) return false;
      if (filterParty   !== 'all' && b.party   !== filterParty)   return false;
      return true;
    })
    .sort((a, b) => {
      let av, bv;
      switch (sortBy) {
        case 'date':       av = new Date(a.date);     bv = new Date(b.date);     break;
        case 'efficiency': av = a.efficiency;          bv = b.efficiency;          break;
        case 'quantity':   av = parseFloat(a.quantity); bv = parseFloat(b.quantity); break;
        case 'deltaE':     av = a.deltaE ?? 999;       bv = b.deltaE ?? 999;       break;
        default: return 0;
      }
      return sortOrder === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const totalPages   = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const pageBatches  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getStatusClass = s => s === 'completed' ? 'status-completed' : s === 'rejected' ? 'status-rejected' : '';
  const getDeltaEClass = v => v == null ? '' : v <= 1 ? 'delta-good' : v <= 2 ? 'delta-warning' : 'delta-bad';

  const handleSort = (col) => {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('desc'); }
    setCurrentPage(1);
  };

  /* ══ RENDER ══ */
  return (
    <div className="batch-history">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Batch History</h1>
          <p className="page-subtitle">
            Live production records · all data from database
            {lastRefresh && <span style={{ color: '#9ca3af' }}> · {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="export-button" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
            onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="export-button" onClick={() => downloadCSV(filtered)} disabled={loading || filtered.length === 0}>
            <Download size={20} /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding:'12px 16px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#b91c1c', display:'flex', gap:8, alignItems:'center', marginBottom:16 }}>
          <AlertTriangle size={16} /> {error}
          <button onClick={fetchData} style={{ marginLeft:'auto', border:'none', background:'none', color:'#b91c1c', cursor:'pointer', fontWeight:600 }}>Retry</button>
        </div>
      )}

      {/* Summary Stats — pulled from /api/batches/stats */}
      <div className="history-stats">
        <div className="stat-card">
          <div className="stat-icon green"><Calendar size={24} /></div>
          <div className="stat-info">
            <p className="stat-label">Completed</p>
            <h3 className="stat-value">{loading ? '—' : batchStats?.completed ?? 0}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Cpu size={24} /></div>
          <div className="stat-info">
            <p className="stat-label">Avg Efficiency</p>
            <h3 className="stat-value">{loading ? '—' : `${batchStats?.avgEfficiency ?? 0}%`}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><FlaskConical size={24} /></div>
          <div className="stat-info">
            <p className="stat-label">Total Produced</p>
            <h3 className="stat-value">
              {loading ? '—' : `${(batchStats?.totalQuantity ?? 0).toFixed(0)} kg`}
            </h3>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <Search size={20} className="search-icon" />
        <input
          className="search-input"
          type="text"
          placeholder="Search by batch ID, color, lot no, or party…"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
        />
      </div>

      {/* Filters */}
      <div className="filters-section">
        {[
          { label: 'Status', value: filterStatus, setter: setFilterStatus,
            opts: [['all','All Status'],['completed','Completed'],['rejected','Rejected'],['in-progress','In Progress']] },
          { label: 'Machine', value: filterMachine, setter: setFilterMachine,
            opts: [['all','All Machines'], ...uniqueMachines.map(m => [m,m])] },
          { label: 'Party', value: filterParty, setter: setFilterParty,
            opts: [['all','All Parties'], ...uniqueParties.map(p => [p,p])] },
        ].map(({ label, value, setter, opts }) => (
          <div className="filter-group" key={label}>
            <label>{label}:</label>
            <select className="filter-select" value={value}
              onChange={e => { setter(e.target.value); setCurrentPage(1); }}>
              {opts.map(([v,t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
        ))}
        <div className="filter-group">
          <label>Sort by:</label>
          <select className="filter-select" value={sortBy} onChange={e => handleSort(e.target.value)}>
            <option value="date">Date</option>
            <option value="efficiency">Efficiency</option>
            <option value="quantity">Quantity</option>
            <option value="deltaE">Delta E</option>
          </select>
          <button
            className="filter-select"
            style={{ width: 36, padding: 0, textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Results count */}
      <div style={{ fontSize:13, color:'#9ca3af', marginBottom:8 }}>
        {loading ? 'Loading batches…' : `${filtered.length} batch${filtered.length !== 1 ? 'es' : ''} found`}
      </div>

      {/* Table */}
      <div className="batches-table-card">
        <div className="table-responsive">
          {loading ? (
            <div style={{ padding: 24 }}>
              {[1,2,3,4,5].map(k => (
                <div key={k} style={{ height: 44, marginBottom: 8, background: 'linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No batches match your filters.</div>
          ) : (
            <table className="batches-table">
              <thead>
                <tr>
                  <th>Batch ID</th><th>Date</th><th>Machine</th><th>Party</th>
                  <th>Color</th><th>Lot No</th><th>Quantity</th>
                  <th onClick={() => handleSort('efficiency')} style={{ cursor:'pointer' }}>
                    Efficiency {sortBy === 'efficiency' ? (sortOrder==='asc'?'↑':'↓') : ''}
                  </th>
                  <th onClick={() => handleSort('deltaE')} style={{ cursor:'pointer' }}>
                    ΔE {sortBy === 'deltaE' ? (sortOrder==='asc'?'↑':'↓') : ''}
                  </th>
                  <th>Status</th><th>Operator</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageBatches.map(batch => (
                  <tr key={batch._id}>
                    <td className="batch-id">{batch.id}</td>
                    <td>{batch.date}</td>
                    <td>{batch.machine}</td>
                    <td>{batch.party}</td>
                    <td>{batch.color}</td>
                    <td>{batch.lotNo}</td>
                    <td>{batch.quantity}</td>
                    <td>
                      <div className="efficiency-bar-small">
                        <div className="efficiency-fill-small" style={{ width: `${batch.efficiency}%` }} />
                        <span>{batch.efficiency}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`delta-badge ${getDeltaEClass(batch.deltaE)}`}>
                        {batch.deltaE != null ? batch.deltaE.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge-bh ${getStatusClass(batch.status)}`}>
                        {batch.status}
                      </span>
                    </td>
                    <td>{batch.operator}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn view" onClick={() => setSelectedBatch(batch)} title="View details">
                          <Eye size={16} />
                        </button>
                        <button className="action-btn download" onClick={() => downloadPdfCertificate(batch)} title="Download PDF Certificate">
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="pagination">
            <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && arr[idx-1] !== p - 1) acc.push('…');
                acc.push(p); return acc;
              }, [])
              .map((p, i) =>
                p === '…'
                  ? <span key={`ellipsis-${i}`} className="page-ellipsis">…</span>
                  : <button key={p} className={`page-btn ${currentPage === p ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
              )}
            <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedBatch && (
        <div className="modal-overlay" onClick={() => setSelectedBatch(null)}>
          <div className="batch-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-bh">
              <div>
                <h2>{selectedBatch.id}</h2>
                <p>{selectedBatch.date} · {selectedBatch.machine} · {selectedBatch.party}</p>
              </div>
              <button className="close-btn" onClick={() => setSelectedBatch(null)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              {/* Info grid */}
              <div className="detail-grid">
                {[
                  ['Color', selectedBatch.color], ['Lot No', selectedBatch.lotNo],
                  ['Quantity', selectedBatch.quantity], ['Duration', selectedBatch.duration],
                  ['Efficiency', `${selectedBatch.efficiency}%`], ['ΔE', selectedBatch.deltaE?.toFixed(2) ?? '—'],
                  ['Status', selectedBatch.status], ['Operator', selectedBatch.operator],
                ].map(([k, v]) => (
                  <div className="detail-item" key={k}>
                    <span className="detail-key">{k}</span>
                    <span className="detail-val">{v}</span>
                  </div>
                ))}
              </div>
              
              {/* Financials (if calculated) */}
              {selectedBatch.costs && (
                <div className="financials-section">
                  <h4>💰 Financials (Live Cost)</h4>
                  <div className="financials-grid">
                    <div className="fin-card">
                      <span className="fin-label">Chemicals & Dyes</span>
                      <span className="fin-value">${selectedBatch.costs.chemicals}</span>
                    </div>
                    <div className="fin-card">
                      <span className="fin-label">Machine Utilities</span>
                      <span className="fin-value">${selectedBatch.costs.utilities}</span>
                    </div>
                    <div className="fin-card total">
                      <span className="fin-label">Total Batch Cost</span>
                      <span className="fin-value">${selectedBatch.costs.total}</span>
                    </div>
                  </div>
                  {selectedBatch.status === 'rejected' && (
                    <div className="fin-warning">
                      ⚠️ This batch was rejected. The ${selectedBatch.costs.total} cost is a sunk loss requiring a re-dye.
                    </div>
                  )}
                </div>
              )}

              {/* Recipe */}
              {selectedBatch.recipe.dyes.length > 0 && (
                <div className="recipe-section">
                  <h4>🎨 Dyes</h4>
                  {selectedBatch.recipe.dyes.map((d, i) => (
                    <div key={i} className="recipe-row"><span>{d.name}</span><span>{d.qty}</span></div>
                  ))}
                </div>
              )}
              {selectedBatch.recipe.chemicals.length > 0 && (
                <div className="recipe-section">
                  <h4>⚗️ Chemicals</h4>
                  {selectedBatch.recipe.chemicals.map((c, i) => (
                    <div key={i} className="recipe-row"><span>{c.name}</span><span>{c.qty}</span></div>
                  ))}
                </div>
              )}
              {selectedBatch.stages.length > 0 && (
                <div className="recipe-section">
                  <h4>🔄 Stages</h4>
                  {selectedBatch.stages.map((s, i) => (
                    <div key={i} className="recipe-row">
                      <span>{i+1}. {s.name}</span>
                      <span>{s.duration} · {s.temp}</span>
                    </div>
                  ))}
                </div>
              )}
              <button className="download-report-btn" onClick={() => downloadPdfCertificate(selectedBatch)}>
                <Download size={16} /> Download Official PDF Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchHistory;
