import React, { useState, useEffect } from 'react';
import { getToken, clearToken, apiFetch } from './api.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ThemePicker from './components/ThemePicker.jsx';
import Sidebar from './components/Sidebar.jsx';
import TalentPage from './components/TalentPage.jsx';
import ContractsPage from './components/ContractsPage.jsx';
import ProjectsPage from './components/ProjectsPage.jsx';
import AdminPage from './components/AdminPage.jsx';
import LeadsPage from './components/LeadsPage.jsx';
import RequirementsPage from './components/RequirementsPage.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import LoginPage from './components/LoginPage.jsx';
import Client360Page from './components/Client360Page.jsx';
import BdOperationsPage from './components/BdOperationsPage.jsx';

const PAGE_TITLES = {
  Leads: 'Leads',
  Requirements: 'Requirements',
  Talent: 'Talent',
  Contracts: 'Contracts',
  Projects: 'Projects',
  'Client 360': 'Client 360°',
  'BD Operations': 'BD Operations',
  Admin: 'Data Management',
  Settings: 'Settings',
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeNav, setActiveNav] = useState('BD Operations');
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setCheckingSession(false); return; }
    apiFetch('/api/auth/me')
      .then(r => r?.json())
      .then(data => { if (data?.id) setUser(data); else clearToken(); })
      .catch(() => clearToken())
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => { clearToken(); setUser(null); setActiveNav('BD Operations'); };
  const handleUpdateUser = (updated) => setUser(prev => ({ ...prev, ...updated }));

  if (checkingSession) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0c0e18', color: '#555a8a', fontSize: 14 }}>
      Loading…
    </div>
  );

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const renderContent = () => {
    if (activeNav === 'Settings') return <SettingsPage user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
    if (activeNav === 'Admin') return <AdminPage />;
    if (activeNav === 'Client 360') return <Client360Page />;
    if (activeNav === 'BD Operations') return <BdOperationsPage user={user} />;
    if (activeNav === 'Leads') return <LeadsPage />;
    if (activeNav === 'Requirements') return <RequirementsPage />;
    if (activeNav === 'Talent') return <TalentPage />;
    if (activeNav === 'Contracts') return <ContractsPage />;
    if (activeNav === 'Projects') return <ProjectsPage />;
    return <BdOperationsPage user={user} />;
  };

  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-base)', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{PAGE_TITLES[activeNav] || 'BD Operations'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Operations Platform</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600,
              color: 'var(--accent-blue)'
            }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <ThemePicker compact />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.role}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
            </div>
            {/* Avatar — click to go to settings */}
            <div
              onClick={() => setActiveNav('Settings')}
              title="Settings"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: user.color || 'linear-gradient(135deg, #4f7cff, #a55eea)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff',
                cursor: 'pointer', transition: 'opacity 0.15s',
                boxShadow: activeNav === 'Settings' ? '0 0 0 2px var(--accent-blue)' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >{initials}</div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          <ErrorBoundary key={activeNav}>
            {renderContent()}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
