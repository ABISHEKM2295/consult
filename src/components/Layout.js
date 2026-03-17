import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Settings, FlaskConical, ChevronLeft, Bell, User, Search,
  Calendar, History, LogOut, BookOpen, BarChart3, Shield, Users,
  ClipboardList, Package2, Microscope
} from 'lucide-react';
import { api } from '../api';
import './Layout.css';

const Layout = ({ children, onLogout }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target))
        setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const alerts = await api.getAlerts({ read: false });
      setUnreadCount(alerts.length);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUnread();
    const iv = setInterval(fetchUnread, 60000);
    return () => clearInterval(iv);
  }, [fetchUnread]);

  const handleLogout = () => {
    setShowUserMenu(false);
    if (onLogout) onLogout();
  };

  /*
   * Navigation follows the real production lifecycle:
   * Dashboard → Orders → Lab Dip → Recipes → Schedule → Machine → Dyes
   *           → (QC) Color Inspection → Quality Reports → Standards
   *           → (Mgmt) Batch History → Alerts → Client Portal
   *
   * { section } entries render as divider labels.
   */
  const NAV = [
    { icon: LayoutDashboard, label: 'Dashboard',       path: '/' },

    { section: 'PRODUCTION FLOW' },
    { icon: ClipboardList,   label: 'Orders',          path: '/orders' },
    { icon: FlaskConical,    label: 'Lab Dip',         path: '/lab-dip' },
    { icon: BookOpen,        label: 'Color Recipes',   path: '/color-recipes' },
    { icon: Calendar,        label: 'Prod. Schedule',  path: '/production-schedule' },
    { icon: Settings,        label: 'Machine Data',    path: '/machine-data' },
    { icon: Package2,        label: 'Dyes & Chemicals',path: '/dyes-chemicals' },

    { section: 'QUALITY CONTROL' },
    { icon: Microscope,      label: 'Color Inspection',path: '/color-inspection' },
    { icon: BarChart3,       label: 'Quality Reports', path: '/quality-reports' },
    { icon: Shield,          label: 'Standards',       path: '/standards-tracking' },

    { section: 'MANAGEMENT' },
    { icon: History,         label: 'Batch History',   path: '/batch-history' },
    { icon: Bell,            label: 'Alerts',          path: '/alerts', badge: true },
    { icon: Users,           label: 'Client Portal',   path: '/client-portal' },
  ];

  return (
    <div className="layout">
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <img src="/images/ptd logo.png" alt="PTD Logo" className="logo-image" />
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, idx) => {
            /* ── section divider ── */
            if (item.section) {
              return isSidebarCollapsed
                ? <div key={`s${idx}`} className="nav-divider-collapsed" />
                : <div key={`s${idx}`} className="nav-section-label">{item.section}</div>;
            }

            const Icon     = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <span className="nav-icon-wrap">
                  <Icon size={20} />
                  {item.badge && unreadCount > 0 && (
                    <span className="nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </span>
                {!isSidebarCollapsed && <span className="nav-label">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <button
          className="sidebar-toggle"
          onClick={() => setIsSidebarCollapsed(c => !c)}
        >
          <ChevronLeft size={20} className={isSidebarCollapsed ? 'rotated' : ''} />
        </button>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="search-bar">
            <Search size={18} />
            <input type="text" placeholder="Search orders, batches, colors, lot numbers…" />
          </div>
          <div className="header-actions">
            <button className="icon-button" onClick={() => { navigate('/alerts'); fetchUnread(); }}>
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
            <div className="user-menu-container" ref={userMenuRef}>
              <button className="icon-button user-button" onClick={() => setShowUserMenu(v => !v)}>
                <User size={20} />
              </button>
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <div className="user-avatar"><User size={20} /></div>
                    <div className="user-details">
                      <div className="user-name">Administrator</div>
                      <div className="user-role">System Admin</div>
                    </div>
                  </div>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item logout-item" onClick={handleLogout}>
                    <LogOut size={18} /><span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
