import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

const STAGES = [
  { key: 'intake', label: 'Intake', color: 'var(--text-secondary)' },
  { key: 'sourcing', label: 'Sourcing', color: 'var(--purple)' },
  { key: 'submission', label: 'Submission', color: 'var(--accent-blue)' },
  { key: 'screening', label: 'Screening', color: 'var(--amber)' },
  { key: 'interviewing', label: 'Interviewing', color: 'var(--accent-cyan)' },
  { key: 'closure', label: 'Closure', color: 'var(--green)' },
];

const STAGE_KEYS = STAGES.map(s => s.key);

export default function Pipeline() {
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    apiFetch('/api/pipeline')
      .then(r => r && r.json ? r.json() : [])
      .then(d => { setReqs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setReqs([]); setLoading(false); });
  };
  useEffect(load, []);

  const advance = async (id, currentStage) => {
    const idx = STAGE_KEYS.indexOf(currentStage);
    if (idx >= STAGE_KEYS.length - 1) return;
    const nextStage = STAGE_KEYS[idx + 1];
    await apiFetch(`/api/pipeline/${id}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: nextStage }),
    });
    load();
  };

  const byStage = (key) => reqs.filter(r => r.stage === key);

  if (loading) return (
    <div className="card"><div className="loading"><div className="spinner" /> Loading pipeline…</div></div>
  );

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="section-header">
        <span className="section-title">Professional Services Pipeline</span>
        <button className="btn btn-primary btn-sm">+ Add requirement</button>
      </div>

      {/* Stage totals bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, background: 'var(--bg-card2)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {STAGES.map((stage, idx) => {
          const count = byStage(stage.key).length;
          return (
            <div key={stage.key} style={{
              flex: 1, padding: '8px 10px', textAlign: 'center',
              borderRight: idx < STAGES.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: stage.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>{stage.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, overflowX: 'auto' }}>
        {STAGES.map(stage => (
          <div key={stage.key} style={{ minWidth: 160 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              padding: '6px 8px', borderRadius: 6,
              background: 'var(--bg-card2)', border: `1px solid ${stage.color}33`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>{stage.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{byStage(stage.key).length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {byStage(stage.key).map(req => (
                <div key={req.id} style={{
                  background: req.stalled ? 'rgba(255,71,87,0.05)' : 'var(--bg-card2)',
                  border: req.stalled ? '1px solid rgba(255,71,87,0.4)' : '1px solid var(--border)',
                  borderRadius: 7, padding: '9px 10px',
                  transition: 'border-color 0.15s',
                  cursor: 'default',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: 'var(--accent-blue)',
                      background: 'var(--accent-blue-dim)', padding: '1px 5px', borderRadius: 3,
                    }}>{req.req_id}</span>
                    {req.stalled && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', background: 'var(--red-dim)', padding: '1px 5px', borderRadius: 3 }}>STALLED</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 3 }}>{req.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{req.client}</div>
                  {req.days_in_stage > 0 && (
                    <div style={{ fontSize: 10, color: req.stalled ? 'var(--red)' : 'var(--text-muted)', marginTop: 4 }}>
                      ⏱ {req.days_in_stage}d in stage
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <span className={`tag ${req.priority === 'HIGH' ? 'tag-red' : req.priority === 'MED' ? 'tag-amber' : 'tag-gray'}`} style={{ fontSize: 9 }}>
                      {req.priority}
                    </span>
                    <span className="tag tag-gray" style={{ fontSize: 9 }}>{req.role_type}</span>
                  </div>
                  {stage.key !== 'closure' && (
                    <button
                      onClick={() => advance(req.id, req.stage)}
                      style={{
                        marginTop: 7, width: '100%', padding: '4px 0',
                        background: 'transparent', border: '1px solid var(--border-light)',
                        borderRadius: 4, fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-muted)'; }}
                    >
                      Advance →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
