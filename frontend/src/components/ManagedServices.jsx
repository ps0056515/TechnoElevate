import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

const stageConfig = {
  green: { label: 'On Track', color: 'var(--green)', bg: 'var(--green-dim)', dot: 'dot-green' },
  at_risk: { label: 'At Risk', color: 'var(--amber)', bg: 'var(--amber-dim)', dot: 'dot-amber' },
  blocked: { label: 'Blocked', color: 'var(--red)', bg: 'var(--red-dim)', dot: 'dot-red' },
  completed: { label: 'Completed', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)', dot: 'dot-blue' },
};

function UtilBar({ pct, stage }) {
  const color = pct >= 85 ? 'var(--green)' : pct >= 70 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
        <span>Utilization</span><span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

export default function ManagedServices({ compact }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = () => {
    apiFetch('/api/projects').then(r => r.json()).then(d => { setProjects(d); setLoading(false); });
  };
  useEffect(load, []);

  const resolve = async (id) => {
    await apiFetch(`/api/projects/${id}/resolve`, { method: 'PATCH' });
    load();
  };

  const filtered = filter === 'all' ? projects : projects.filter(p => p.stage === filter);
  const display = compact ? filtered.slice(0, 4) : filtered;

  if (loading) return (
    <div className="card"><div className="loading"><div className="spinner" /> Loading projects…</div></div>
  );

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="section-header">
        <span className="section-title">Managed Services Delivery</span>
        {!compact && (
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'blocked', 'at_risk', 'green', 'completed'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}>
                {f === 'all' ? 'All' : stageConfig[f]?.label || f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        {display.map(proj => {
          const cfg = stageConfig[proj.stage] || stageConfig.green;
          return (
            <div key={proj.id} style={{
              background: 'var(--bg-card2)', border: `1px solid ${proj.stage === 'blocked' ? 'rgba(255,71,87,0.35)' : proj.stage === 'at_risk' ? 'rgba(255,165,2,0.3)' : 'var(--border)'}`,
              borderRadius: 9, padding: '12px 14px',
              transition: 'border-color 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{proj.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{proj.client} · {proj.team_size} members</div>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 20,
                  background: cfg.bg, color: cfg.color,
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  <span className={`dot ${cfg.dot}`} style={{ width: 5, height: 5 }} />
                  {cfg.label}
                </span>
              </div>

              {proj.blocking_issue && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                  background: 'var(--red-dim)', border: '1px solid rgba(255,71,87,0.3)',
                  borderRadius: 6, padding: '6px 8px', marginBottom: 6,
                }}>
                  <span style={{ color: 'var(--red)', flexShrink: 0, fontSize: 12 }}>⛔</span>
                  <span style={{ fontSize: 11, color: 'var(--red)', flex: 1, lineHeight: 1.3 }}>{proj.blocking_issue}</span>
                  <button onClick={() => resolve(proj.id)} className="btn btn-red btn-sm" style={{ flexShrink: 0, fontSize: 10 }}>
                    Resolve
                  </button>
                </div>
              )}

              <UtilBar pct={proj.utilization_pct} stage={proj.stage} />

              {!compact && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <span className="tag tag-gray" style={{ fontSize: 10 }}>
                    {new Date(proj.start_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })} –
                    {new Date(proj.end_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {compact && projects.length > 4 && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}>+{projects.length - 4} more projects →</span>
        </div>
      )}
    </div>
  );
}
