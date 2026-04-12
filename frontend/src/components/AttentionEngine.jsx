import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

const priorityConfig = {
  HIGH: { dot: 'dot-red', badge: 'badge-red', label: 'HIGH', btnClass: 'btn-red' },
  MED: { dot: 'dot-amber', badge: 'badge-amber', label: 'MED', btnClass: 'btn-amber' },
  LOW: { dot: 'dot-blue', badge: 'badge-blue', label: 'LOW', btnClass: 'btn-ghost' },
};

export default function AttentionEngine() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const load = () => {
    apiFetch('/api/attention').then(r => r.json()).then(d => { setIssues(d); setLoading(false); });
  };
  useEffect(load, []);

  const resolve = async (id) => {
    await apiFetch(`/api/attention/${id}/resolve`, { method: 'PATCH' });
    setIssues(prev => prev.filter(i => i.id !== id));
  };

  const highCount = issues.filter(i => i.priority === 'HIGH').length;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        background: 'linear-gradient(90deg, rgba(255,71,87,0.06) 0%, transparent 60%)',
      }}>
        <span className="dot dot-red pulse" />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Attention Engine — Priority Issues
        </span>
        {highCount > 0 && (
          <span className="badge badge-red">{highCount} critical</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm">Configure rules ›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {loading ? (
            <div className="loading"><div className="spinner" /> Loading issues…</div>
          ) : issues.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--green)', fontWeight: 600 }}>
              ✓ All clear — no priority issues
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '90px 200px 1fr 140px',
                padding: '8px 16px', gap: 12,
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
              }}>
                <span>Priority</span><span>Entity</span><span>Issue</span><span>Action</span>
              </div>
              {issues.map((issue, idx) => {
                const cfg = priorityConfig[issue.priority] || priorityConfig.LOW;
                return (
                  <div key={issue.id} style={{
                    display: 'grid', gridTemplateColumns: '90px 200px 1fr 140px',
                    padding: '11px 16px', gap: 12, alignItems: 'center',
                    borderBottom: idx < issues.length - 1 ? '1px solid var(--border)' : 'none',
                    background: issue.priority === 'HIGH' ? 'rgba(255,71,87,0.02)' : 'transparent',
                    transition: 'background 0.15s',
                  }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = issue.priority === 'HIGH' ? 'rgba(255,71,87,0.02)' : 'transparent'}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`dot ${cfg.dot}`} />
                      <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{issue.entity_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {issue.entity_type.charAt(0).toUpperCase() + issue.entity_type.slice(1)}
                        {issue.days_stalled > 0 && ` · ${issue.days_stalled} days`}
                      </div>
                    </div>

                    <div style={{
                      fontSize: 13, fontWeight: 500,
                      color: issue.priority === 'HIGH' ? 'var(--red)' : issue.priority === 'MED' ? 'var(--amber)' : 'var(--text-secondary)',
                    }}>
                      {issue.issue_description}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className={`btn btn-sm ${cfg.btnClass}`} onClick={() => resolve(issue.id)}>
                        {issue.action_label}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
