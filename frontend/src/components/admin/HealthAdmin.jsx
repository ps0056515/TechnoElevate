import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api.js';

const unitLabel = { '%': '%', 'USD': '$', 'days': 'd', 'count': '' };
const trendColors = { up: 'var(--green)', down: 'var(--red)', flat: 'var(--text-muted)' };
const trendIcons = { up: '↑', down: '↓', flat: '—' };

export default function HealthAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});

  const load = () => {
    setLoading(true);
    apiFetch('/api/health').then(r => r && r.json ? r.json() : []).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => { setRows([]); setLoading(false); });
  };
  useEffect(load, []);

  const update = async (row) => {
    const val = editing[row.id];
    if (val === undefined || val === '') return;
    setSaving(s => ({ ...s, [row.id]: true }));
    await apiFetch(`/api/health/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric_value: val }),
    });
    setSaving(s => ({ ...s, [row.id]: false }));
    setEditing(e => { const n = { ...e }; delete n[row.id]; return n; });
    load();
  };

  if (loading) return <div className="loading"><div className="spinner" /> Loading…</div>;

  return (
    <div>
      <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--bg-card2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
        💡 Click any value to edit it directly. Changes update the dashboard KPIs immediately.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {rows.map(row => {
          const isEditing = editing[row.id] !== undefined;
          const prefix = row.metric_unit === 'USD' ? '$' : '';
          const suffix = row.metric_unit !== 'USD' ? (unitLabel[row.metric_unit] || '') : '';
          return (
            <div key={row.id} style={{
              background: 'var(--bg-card2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                {row.metric_label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isEditing ? (
                  <>
                    <input
                      type="number"
                      value={editing[row.id]}
                      onChange={e => setEditing(ed => ({ ...ed, [row.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') update(row); if (e.key === 'Escape') setEditing(ed => { const n = { ...ed }; delete n[row.id]; return n; }); }}
                      style={{
                        flex: 1, background: 'var(--bg-card)', border: '1px solid var(--accent-blue)',
                        borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)',
                        fontSize: 18, fontWeight: 700, fontFamily: 'var(--font)', outline: 'none',
                      }}
                      autoFocus
                    />
                    <button onClick={() => update(row)} className="btn btn-primary btn-sm" disabled={saving[row.id]}>
                      {saving[row.id] ? '…' : 'Save'}
                    </button>
                    <button onClick={() => setEditing(ed => { const n = { ...ed }; delete n[row.id]; return n; })} className="btn btn-ghost btn-sm">✕</button>
                  </>
                ) : (
                  <>
                    <span
                      onClick={() => setEditing(ed => ({ ...ed, [row.id]: row.metric_value }))}
                      title="Click to edit"
                      style={{
                        fontSize: 28, fontWeight: 800, color: 'var(--accent-blue)',
                        cursor: 'pointer', flex: 1,
                        borderBottom: '1px dashed var(--border-light)',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.target.style.color = 'var(--accent-cyan)'}
                      onMouseLeave={e => e.target.style.color = 'var(--accent-blue)'}
                    >
                      {prefix}{parseFloat(row.metric_value).toLocaleString()}{suffix}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: trendColors[row.trend] }}>
                      {trendIcons[row.trend]}
                    </span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Last updated: {new Date(row.updated_at).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
