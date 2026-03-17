import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard        from './pages/Dashboard';
import MachineData      from './pages/MachineData';
import DyesChemicals    from './pages/DyesChemicals';
import ColorInspection  from './pages/ColorInspection';
import ColorRecipes     from './pages/ColorRecipes';
import QualityReports   from './pages/QualityReports';
import StandardsTracking from './pages/StandardsTracking';
import ProductionSchedule from './pages/ProductionSchedule';
import Alerts           from './pages/Alerts';
import BatchHistory     from './pages/BatchHistory';
import Orders           from './pages/Orders';
import LabDip           from './pages/LabDip';
import ClientPortal     from './pages/ClientPortal';
import Login            from './pages/Login';
import './App.css';

function App() {
  const [auth, setAuth] = useState({ loggedIn: false, role: 'admin', clientName: '' });

  useEffect(() => {
    const stored = localStorage.getItem('ptdAuth');
    if (stored) {
      try { setAuth({ ...JSON.parse(stored), loggedIn: true }); } catch {}
    }
  }, []);

  const handleLogin = useCallback((data) => {
    const authData = { loggedIn: true, role: data.role || 'admin', clientName: data.clientName || '', username: data.username };
    setAuth(authData);
    localStorage.setItem('ptdAuth', JSON.stringify({ role: authData.role, clientName: authData.clientName, username: authData.username }));
    localStorage.setItem('isAuthenticated', 'true');
  }, []);

  const handleLogout = useCallback(() => {
    setAuth({ loggedIn: false, role: 'admin', clientName: '' });
    localStorage.removeItem('ptdAuth');
    localStorage.removeItem('isAuthenticated');
  }, []);

  if (!auth.loggedIn) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  // Client role: only show client portal
  if (auth.role === 'client') {
    return (
      <Router>
        <Routes>
          <Route path="/client-portal" element={<ClientPortal clientName={auth.clientName} onLogout={handleLogout} />} />
          <Route path="*" element={<Navigate to="/client-portal" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/"                   element={<Dashboard />} />
          <Route path="/machine-data"       element={<MachineData />} />
          <Route path="/dyes-chemicals"     element={<DyesChemicals />} />
          <Route path="/color-inspection"   element={<ColorInspection />} />
          <Route path="/color-recipes"      element={<ColorRecipes />} />
          <Route path="/quality-reports"    element={<QualityReports />} />
          <Route path="/standards-tracking" element={<StandardsTracking />} />
          <Route path="/production-schedule" element={<ProductionSchedule />} />
          <Route path="/alerts"             element={<Alerts />} />
          <Route path="/batch-history"      element={<BatchHistory />} />
          <Route path="/orders"             element={<Orders />} />
          <Route path="/lab-dip"            element={<LabDip />} />
          <Route path="/client-portal"      element={<ClientPortal clientName={auth.clientName} onLogout={handleLogout} />} />
          <Route path="*"                   element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
