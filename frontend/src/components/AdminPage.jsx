import React, { useState } from 'react';
import TalentAdmin from './admin/TalentAdmin.jsx';
import RequirementsAdmin from './admin/RequirementsAdmin.jsx';
import ProjectsAdmin from './admin/ProjectsAdmin.jsx';
import ContractsAdmin from './admin/ContractsAdmin.jsx';
import AttentionAdmin from './admin/AttentionAdmin.jsx';
import HealthAdmin from './admin/HealthAdmin.jsx';

const TABS = [
  { key: 'talent', label: '👤 Talent', desc: 'Manage all talent records — add, edit, update status' },
  { key: 'requirements', label: '📋 Requirements', desc: 'Add and track requirements through the pipeline' },
  { key: 'projects', label: '▣ Projects', desc: 'Manage delivery projects and blocking issues' },
  { key: 'contracts', label: '📄 Contracts', desc: 'Maintain SOWs, expiry dates, and invoices' },
  { key: 'attention', label: '⚡ Attention Issues', desc: 'Create and manage priority attention alerts' },
  { key: 'health', label: '📊 KPI Metrics', desc: 'Update dashboard health metric values' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('talent');
  const current = TABS.find(t => t.key === tab);

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'linear-gradient(135deg, #4f7cff, #a55eea)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>⚙</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Data Management</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-card2)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
            Admin Panel
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Add, edit, and delete records across all modules. Changes reflect on the dashboard immediately.
        </p>
      </div>

      {/* Tab strip */}
      <div style={{
        display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 1,
        borderBottom: '1px solid var(--border)', marginBottom: 20,
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? 'var(--accent-blue)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--text-secondary)',
            border: 'none', borderRadius: '6px 6px 0 0',
            padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s', marginBottom: -1,
            borderBottom: tab === t.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Current section description */}
      {current && (
        <div style={{
          padding: '10px 14px', marginBottom: 16,
          background: 'var(--bg-card2)', border: '1px solid var(--border)',
          borderRadius: 8, borderLeft: '3px solid var(--accent-blue)',
          fontSize: 13, color: 'var(--text-secondary)',
        }}>
          {current.desc}
        </div>
      )}

      {/* Panel */}
      <div className="card" style={{ padding: '16px 20px' }}>
        {tab === 'talent' && <TalentAdmin />}
        {tab === 'requirements' && <RequirementsAdmin />}
        {tab === 'projects' && <ProjectsAdmin />}
        {tab === 'contracts' && <ContractsAdmin />}
        {tab === 'attention' && <AttentionAdmin />}
        {tab === 'health' && <HealthAdmin />}
      </div>
    </div>
  );
}
