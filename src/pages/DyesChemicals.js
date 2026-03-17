import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { Plus, Search, RefreshCw, AlertTriangle, FlaskConical, X } from 'lucide-react';
import { api } from '../api';
import './DyesChemicals.css';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_LABELS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };

/* build weekly chart from inventory weekly usage data */
const buildWeeklyChart = (items) => {
  return DAYS.map(day => ({
    day: DAY_LABELS[day],
    dyes:      items.filter(i => i.category === 'Dye').reduce((s, i) => s + (i.weeklyUsage?.[day] || 0), 0),
    chemicals: items.filter(i => i.category === 'Chemical').reduce((s, i) => s + (i.weeklyUsage?.[day] || 0), 0),
  }));
};

const DyesChemicals = () => {
  const [activeTab, setActiveTab]     = useState('all');
  const [search, setSearch]           = useState('');
  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'Dye', stock: 0, costPerKg: 15.0 });
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInventory();
      setItems(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
    const interval = setInterval(fetchInventory, 120000);
    return () => clearInterval(interval);
  }, [fetchInventory]);

  /* ── derived data ── */
  const weeklyData    = buildWeeklyChart(items);
  const totalItems    = items.length;
  const dyesCount     = items.filter(i => i.category === 'Dye').length;
  const chemCount     = items.filter(i => i.category === 'Chemical').length;
  const lowStockCount = items.filter(i => i.status !== 'ok').length;

  const filteredItems = items.filter(item => {
    const matchTab    = activeTab === 'all' || item.category.toLowerCase() === activeTab.slice(0, -1);
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const getStatusClass = (s) => s === 'ok' ? 'status-ok' : s === 'low' ? 'status-low' : 'status-critical';
  const getStatusText  = (s, lvl) => s === 'ok' ? 'OK' : `🔻 ${lvl}%`;

  /* ── sort: critical first, then low, then ok ── */
  const sortedItems = [...filteredItems].sort((a, b) => {
    const order = { critical: 0, low: 1, ok: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const handleAddItem = async (e) => {
    e.preventDefault();
    setModalSubmitting(true);
    try {
      // The API call to add to inventory
      await api.createInventoryItem(newItem);
      setShowAddModal(false);
      setNewItem({ name: '', category: 'Dye', stock: 0, costPerKg: 15.0 });
      fetchInventory(); // refresh list
    } catch (err) {
      alert(err.message || 'Error creating item');
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <div className="dyes-chemicals">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Dyes &amp; Chemicals Inventory</h1>
          <p className="page-subtitle">
            Weekly usage tracking and live stock management
            {lastRefresh && <span style={{ color: '#9ca3af' }}> · Updated {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="refresh-btn-dc" onClick={fetchInventory} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="add-item-button" onClick={() => setShowAddModal(true)}>
            <Plus size={20} /> Add Item
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner-dc">
          <AlertTriangle size={18} /> {error}
          <button className="retry-link-dc" onClick={fetchInventory}>Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="inventory-summary">
        {[
          { label: 'Total Items',   value: loading ? '—' : totalItems,    icon: '📦', cls: 'purple' },
          { label: 'Dyes',          value: loading ? '—' : dyesCount,     icon: '💜', cls: 'pink' },
          { label: 'Chemicals',     value: loading ? '—' : chemCount,     icon: '🔵', cls: 'blue' },
          { label: 'Low/Critical',  value: loading ? '—' : lowStockCount, icon: '⚠️', cls: 'orange' },
        ].map(c => (
          <div className="summary-card" key={c.label}>
            <div className={`summary-icon ${c.cls}`}><span>{c.icon}</span></div>
            <div className="summary-info">
              <p className="summary-label">{c.label}</p>
              <h3 className="summary-value">{c.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Usage Chart — derived live from inventory weeklyUsage fields */}
      <div className="chart-section">
        <div className="chart-header">
          <h3>Weekly Usage Trend</h3>
          <p className="chart-sub">Cumulative grams used per category per day</p>
        </div>
        {loading ? (
          <div className="chart-skeleton-dc" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                formatter={(v, n) => [v.toLocaleString() + ' g', n]}
              />
              <Legend iconType="circle" iconSize={10} />
              <Bar dataKey="dyes"      fill="#a855f7" name="Dyes"      radius={[4,4,0,0]} />
              <Bar dataKey="chemicals" fill="#3b82f6" name="Chemicals" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Inventory Table */}
      <div className="inventory-table-section">
        <div className="table-controls">
          <div className="tabs">
            {['all','dyes','chemicals'].map(t => (
              <button
                key={t}
                className={`tab ${activeTab === t ? 'active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t === 'all' ? 'All Items' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search items…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 24 }}>
              {[1,2,3,4,5].map(k => (
                <div key={k} style={{ height: 44, marginBottom: 8, background: 'linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8 }} />
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
              <FlaskConical size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>No items found{search ? ` matching "${search}"` : ''}.</p>
            </div>
          ) : (
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item._id} className={item.status === 'critical' ? 'row-critical' : item.status === 'low' ? 'row-low' : ''}>
                    <td className="item-name">{item.name}</td>
                    <td>
                      <span className={`category-badge ${item.category.toLowerCase()}`}>{item.category}</span>
                    </td>
                    {DAYS.map(d => (
                      <td key={d}>{(item.weeklyUsage?.[d] || 0).toLocaleString()}</td>
                    ))}
                    <td className="stock-cell">
                      <span className={getStatusClass(item.status)}>{item.stock} kg</span>
                    </td>
                    <td className="status-cell">
                      <span className={`status-indicator ${getStatusClass(item.status)}`}>
                        {getStatusText(item.status, item.stockLevel)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="dc-modal" onClick={e => e.stopPropagation()}>
            <div className="dc-modal-header">
              <h2>Add New Inventory Item</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="dc-modal-form">
              <div className="form-group">
                <label>Item Name</label>
                <input 
                  type="text" 
                  value={newItem.name} 
                  onChange={e => setNewItem({...newItem, name: e.target.value})} 
                  placeholder="e.g. Reactive Yellow"
                  required 
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select 
                    value={newItem.category} 
                    onChange={e => setNewItem({...newItem, category: e.target.value})}
                  >
                    <option value="Dye">Dye</option>
                    <option value="Chemical">Chemical</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Initial Stock (kg)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={newItem.stock} 
                    onChange={e => setNewItem({...newItem, stock: parseFloat(e.target.value)})} 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Cost per kg (USD)</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={newItem.costPerKg} 
                  onChange={e => setNewItem({...newItem, costPerKg: parseFloat(e.target.value)})} 
                  required 
                />
              </div>

              <div className="dc-modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="save-btn" disabled={modalSubmitting}>
                  {modalSubmitting ? 'Saving...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DyesChemicals;
