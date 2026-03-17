import React, { useState, useEffect, useCallback } from 'react';
import { Package, CheckCircle, Clock, Download, LogOut, RefreshCw } from 'lucide-react';
import { api } from '../api';
import './ClientPortal.css';

const STAGE_LABELS = {
  order_received:'Order Received', yarn_sourced:'Yarn Sourced', knitting:'Knitting',
  fabric_received:'Fabric Received', pre_qc:'Pre QC', reversed:'Reversed',
  lab_dip:'Lab Dip', dyeing:'Dyeing', post_qc:'Post QC', drying:'Drying', delivered:'Delivered',
};
const STAGE_PROGRESS = {
  order_received:5, yarn_sourced:15, knitting:25, fabric_received:35, pre_qc:45,
  reversed:55, lab_dip:65, dyeing:75, post_qc:85, drying:92, delivered:100,
};

const ClientPortal = ({ clientName, onLogout }) => {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = clientName ? { clientName } : {};
      const data = await api.getOrders(params);
      setOrders(data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [clientName]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const isOverdue = o => o.deadline && new Date() > new Date(o.deadline) && o.status !== 'completed';

  return (
    <div className="client-portal">
      {/* Header */}
      <div className="client-header">
        <div className="client-brand">
          <div className="client-logo">PTD</div>
          <div>
            <h2>Premier Textile Dyers</h2>
            <p>Client Portal {clientName ? `— ${clientName}` : ''}</p>
          </div>
        </div>
        <div className="client-header-right">
          <button className="client-refresh-btn" onClick={fetchOrders}><RefreshCw size={16}/></button>
          {onLogout && <button className="client-logout-btn" onClick={onLogout}><LogOut size={16}/> Sign Out</button>}
        </div>
      </div>

      <div className="client-body">
        {/* Summary */}
        <div className="client-summary">
          {[
            { label:'Total Orders',   value: orders.length,                                 color:'#6366f1' },
            { label:'In Progress',    value: orders.filter(o=>o.status==='active').length,  color:'#f59e0b' },
            { label:'Delivered',      value: orders.filter(o=>o.status==='completed').length, color:'#10b981' },
            { label:'Overdue',        value: orders.filter(isOverdue).length,               color:'#ef4444' },
          ].map(c => (
            <div className="client-kpi" key={c.label}>
              <h3 style={{color:c.color}}>{loading ? '—' : c.value}</h3>
              <p>{c.label}</p>
            </div>
          ))}
        </div>

        {error && <div className="client-error">⚠️ {error}</div>}

        {/* Order cards */}
        <h3 className="client-section-title">Your Orders</h3>
        {loading ? (
          [1,2,3].map(k => <div key={k} className="client-skeleton" />)
        ) : orders.length === 0 ? (
          <div className="client-empty"><Package size={40}/><p>No orders found.</p></div>
        ) : (
          <div className="client-orders-grid">
            {orders.map(order => {
              const progress = STAGE_PROGRESS[order.currentStage] || 0;
              const overdue  = isOverdue(order);
              return (
                <div key={order._id} className={`client-order-card ${overdue?'overdue':''} ${order.status==='completed'?'delivered':''}`}>
                  <div className="client-order-header">
                    <span className="client-order-no">{order.orderNo}</span>
                    {overdue && <span className="client-overdue">OVERDUE</span>}
                    {order.status === 'completed' && <span className="client-done">✓ Delivered</span>}
                  </div>
                  <h4 className="client-color">{order.targetColor}</h4>
                  <div className="client-order-meta">
                    <span>📦 {order.fabricType}</span>
                    <span>⚖️ {order.quantity} kg</span>
                    {order.deadline && <span style={{color:overdue?'#ef4444':'#6b7280'}}>📅 {new Date(order.deadline).toLocaleDateString()}</span>}
                  </div>

                  {/* Stage badge */}
                  <div className="client-stage-badge">{STAGE_LABELS[order.currentStage] || order.currentStage}</div>

                  {/* Progress bar */}
                  <div className="client-progress-wrap">
                    <div className="client-progress-bar">
                      <div
                        className="client-progress-fill"
                        style={{
                          width: `${progress}%`,
                          background: order.status==='completed' ? '#10b981' : overdue ? '#ef4444' : '#3b82f6'
                        }}
                      />
                    </div>
                    <span className="client-progress-pct">{progress}%</span>
                  </div>

                  {/* Download cert for delivered orders */}
                  {order.linkedBatchId && order.status === 'completed' && (
                    <a
                      className="client-download-btn"
                      href={`http://localhost:5000/api/batches/${order.linkedBatchId}/certificate`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download size={14}/> Download Quality Certificate
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientPortal;
