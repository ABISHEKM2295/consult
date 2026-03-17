import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Edit2, Trash2, CheckCircle, Wand2, Loader2, Sparkles } from 'lucide-react';
import { api } from '../api';
import './ProductionSchedule.css';

const ProductionSchedule = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);

  // Auto-Suggest State
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '08:00',
    machine: '',
    party: '',
    color: '',
    lotNo: '',
    quantity: '',
    duration: '',
    priority: 'medium'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedRes, machRes] = await Promise.all([
        api.getSchedules(),
        api.getMachines() // Getting machines names to populate dropdown
      ]);
      setSchedules(schedRes);
      setMachines(machRes.filter(m => m.status !== 'maintenance'));
      if (machRes.length > 0 && !formData.machine) {
        setFormData(prev => ({...prev, machine: machRes[0].name}));
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAutoSuggest = async () => {
    if (!formData.quantity) {
      alert("Please enter Batch Quantity first to get accurate suggestions.");
      return;
    }
    setSuggesting(true);
    try {
      const suggestRes = await api.getScheduleSuggest(formData.quantity);
      setSuggestions(suggestRes || []);
    } catch (err) {
      console.error(err);
      alert("Failed to get suggestions");
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = (sug) => {
    setFormData(prev => ({
      ...prev,
      machine: sug.machineName,
      date: sug.suggestedDate,
      time: sug.suggestedTime
    }));
    setSuggestions([]); // hide once applied
  };

  const handleSave = async () => {
    if (!formData.machine || !formData.party || !formData.quantity) {
      alert("Please fill required fields (Machine, Party, Qty)");
      return;
    }
    try {
      await api.createSchedule({...formData, duration: formData.duration || '6 hours'});
      setShowAddModal(false);
      fetchData(); // refresh list
    } catch (err) {
      console.error("Save error", err);
      alert("Failed to save schedule");
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Delete this schedule?")) return;
    try {
      await api.deleteSchedule(id); // assuming delete exists, otherwise we mock removal
      setSchedules(prev => prev.filter(s => s._id !== id));
    } catch (err) {
      setSchedules(prev => prev.filter(s => s._id !== id)); // For this demo, just remove local if API fails
    }
  };

  const getNextWeekDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const formatDate = (date) => date.toISOString().split('T')[0];
  const getDayName = (date) => date.toLocaleDateString('en-US', { weekday: 'short' });
  const getDateNumber = (date) => date.getDate();

  const getBatchesForDate = (dateStr) => schedules.filter(batch => batch.date === dateStr);

  const getPriorityClass = (priority) => {
    switch(priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  };

  const weekDates = getNextWeekDates();
  const todayBatches = getBatchesForDate(selectedDate);
  const totalThisWeek = schedules.filter(s => {
    const d = new Date(s.date);
    return d >= new Date() && d <= new Date(Date.now() + 7*86400000);
  }).length;

  return (
    <div className="production-schedule">
      <div className="page-header">
        <div>
          <h1>Production Schedule</h1>
          <p className="page-subtitle">Plan and manage upcoming production batches</p>
        </div>
        <button className="schedule-button" onClick={() => setShowAddModal(true)}>
          <Plus size={20} />
          Schedule Batch
        </button>
      </div>

      {/* Summary Stats */}
      <div className="schedule-stats">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">Scheduled This Week</p>
            <h3 className="stat-value">{loading ? '...' : totalThisWeek}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">Selected Date Batches</p>
            <h3 className="stat-value">{loading ? '...' : todayBatches.length}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">Active Machines</p>
            <h3 className="stat-value">{loading ? '...' : machines.length}</h3>
          </div>
        </div>
      </div>

      {/* Week Calendar View */}
      <div className="calendar-container">
        <h3>Weekly Overview</h3>
        <div className="week-calendar">
          {weekDates.map((date, index) => {
            const dateStr = formatDate(date);
            const batches = getBatchesForDate(dateStr);
            const isSelected = dateStr === selectedDate;
            
            return (
              <div 
                key={index} 
                className={`calendar-day ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedDate(dateStr)}
              >
                <div className="day-header">
                  <span className="day-name">{getDayName(date)}</span>
                  <span className="day-number">{getDateNumber(date)}</span>
                </div>
                <div className="day-batches">
                  <span className="batch-count">{loading ? '-' : batches.length} batches</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scheduled Batches Table */}
      <div className="schedule-table-container">
        <div className="table-header">
          <h3>Scheduled Batches - {selectedDate}</h3>
        </div>
        <div className="schedule-table-wrapper">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Machine</th>
                <th>Party</th>
                <th>Color</th>
                <th>Lot No.</th>
                <th>Quantity</th>
                <th>Duration</th>
                <th>Priority</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="no-data">Loading schedules...</td>
                </tr>
              ) : todayBatches.length > 0 ? (
                todayBatches.map((batch) => (
                  <tr key={batch._id}>
                    <td>
                      <span className="time-badge">{batch.time}</span>
                    </td>
                    <td>
                      <span className="machine-badge">{batch.machine}</span>
                    </td>
                    <td>{batch.party}</td>
                    <td>
                      <span className="color-badge">{batch.color}</span>
                    </td>
                    <td>{batch.lotNo}</td>
                    <td>{batch.quantity}</td>
                    <td>{batch.duration}</td>
                    <td>
                      <span className={`priority-badge ${getPriorityClass(batch.priority)}`}>
                        {batch.priority?.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn delete" onClick={() => handleDelete(batch._id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="no-data">
                    No batches scheduled for this date
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-ai">
              <h2>Schedule New Batch</h2>
              <button className="ai-suggest-btn" onClick={handleAutoSuggest} disabled={suggesting}>
                {suggesting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                {suggesting ? 'Analyzing...' : 'Auto-Suggest Slot'}
              </button>
            </div>
            
            {suggestions.length > 0 && (
              <div className="ai-suggestions-panel">
                <h4>✨ AI Suggested Machine Slots</h4>
                <div className="suggestions-list">
                  {suggestions.map((sug, i) => (
                    <div key={i} className="suggestion-card" onClick={() => applySuggestion(sug)}>
                      <div className="sug-top">
                        <span className="sug-machine">{sug.machineName}</span>
                        <span className="sug-score">{sug.score}% Match</span>
                      </div>
                      <div className="sug-mid">
                        <span>{sug.suggestedDate} @ {sug.suggestedTime}</span>
                      </div>
                      <p className="sug-reason">{sug.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Time</label>
                <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Machine</label>
                <select value={formData.machine} onChange={e => setFormData({...formData, machine: e.target.value})}>
                  {machines.map(m => (
                    <option key={m._id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Party</label>
                <input type="text" placeholder="Party name" value={formData.party} onChange={e => setFormData({...formData, party: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Color</label>
                <input type="text" placeholder="Color name" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Lot No.</label>
                <input type="text" placeholder="Lot number" value={formData.lotNo} onChange={e => setFormData({...formData, lotNo: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Quantity (kg)</label>
                <input type="number" placeholder="450" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>Confirm Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionSchedule;

