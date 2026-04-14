import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

const stageConfig = {
  green: { label: 'On Track', color: 'var(--green)', bg: 'var(--green-dim)', dot: 'dot-green' },
  at_risk: { label: 'At Risk', color: 'var(--amber)', bg: 'var(--amber-dim)', dot: 'dot-amber' },
  blocked: { label: 'Blocked', color: 'var(--red)', bg: 'var(--red-dim)', dot: 'dot-red' },
  completed: { label: 'Completed', color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)', dot: 'dot-blue' },
};

const PHASES = ['discovery', 'design', 'development', 'testing', 'uat', 'go_live', 'delivered'];
const phaseColors = { discovery: 'var(--text-muted)', design: 'var(--purple)', development: 'var(--accent-blue)', testing: 'var(--amber)', uat: 'var(--accent-cyan)', go_live: 'var(--green)', delivered: 'var(--green)' };

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
  const [expandedId, setExpandedId] = useState(null);
  const [milestones, setMilestones] = useState({});
  const [team, setTeam] = useState({});
  const [availTalent, setAvailTalent] = useState([]);
  const [newMilestone, setNewMilestone] = useState({});
  const [addingTeam, setAddingTeam] = useState({});

  const load = () => {
    apiFetch('/api/projects')
      .then(r => r && r.json ? r.json() : [])
      .then(d => { setProjects(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setProjects([]); setLoading(false); });
    apiFetch('/api/talent/available')
      .then(r => r && r.json ? r.json() : [])
      .then(d => setAvailTalent(Array.isArray(d) ? d : []))
      .catch(() => {});
  };
  useEffect(load, []);

  const resolve = async (id) => {
    await apiFetch(`/api/projects/${id}/resolve`, { method: 'PATCH' });
    load();
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    const [ms, tm] = await Promise.all([
      apiFetch(`/api/projects/${id}/milestones`).then(r => r.json()).catch(() => []),
      apiFetch(`/api/projects/${id}/team`).then(r => r.json()).catch(() => []),
    ]);
    setMilestones(prev => ({ ...prev, [id]: ms }));
    setTeam(prev => ({ ...prev, [id]: tm }));
  };

  const addMilestone = async (projId) => {
    const nm = newMilestone[projId] || {};
    if (!nm.title) return;
    await apiFetch(`/api/projects/${projId}/milestones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nm) });
    const ms = await apiFetch(`/api/projects/${projId}/milestones`).then(r => r.json());
    setMilestones(prev => ({ ...prev, [projId]: ms }));
    setNewMilestone(prev => ({ ...prev, [projId]: {} }));
  };

  const toggleMilestone = async (projId, msId, done) => {
    await apiFetch(`/api/projects/milestones/${msId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: done }) });
    const ms = await apiFetch(`/api/projects/${projId}/milestones`).then(r => r.json());
    setMilestones(prev => ({ ...prev, [projId]: ms }));
  };

  const addTeamMember = async (projId) => {
    const talentId = addingTeam[projId];
    if (!talentId) return;
    await apiFetch(`/api/projects/${projId}/team`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ talent_id: talentId }) });
    const tm = await apiFetch(`/api/projects/${projId}/team`).then(r => r.json());
    setTeam(prev => ({ ...prev, [projId]: tm }));
    setAddingTeam(prev => ({ ...prev, [projId]: '' }));
    load();
  };

  const removeTeamMember = async (projId, talentId) => {
    await apiFetch(`/api/projects/${projId}/team/${talentId}`, { method: 'DELETE' });
    const tm = await apiFetch(`/api/projects/${projId}/team`).then(r => r.json());
    setTeam(prev => ({ ...prev, [projId]: tm }));
    load();
  };

  const updatePhase = async (projId, phase) => {
    await apiFetch(`/api/admin/projects/${projId}/phase`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phase }) });
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

              {/* Phase selector */}
              {!compact && (
                <div style={{ marginTop: 6, marginBottom: 4 }}>
                  <select
                    value={proj.phase || 'discovery'}
                    onChange={e => updatePhase(proj.id, e.target.value)}
                    style={{ fontSize: 10, padding: '3px 7px', borderRadius: 5, border: `1px solid ${phaseColors[proj.phase || 'discovery']}55`, background: 'var(--bg-card)', color: phaseColors[proj.phase || 'discovery'], fontWeight: 700, cursor: 'pointer' }}
                  >
                    {PHASES.map(p => <option key={p} value={p}>{p.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
              )}

              <UtilBar pct={proj.utilization_pct} stage={proj.stage} />

              {!compact && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <span className="tag tag-gray" style={{ fontSize: 10 }}>
                    {new Date(proj.start_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })} –
                    {new Date(proj.end_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </span>
                  <button
                    onClick={() => toggleExpand(proj.id)}
                    style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 9px', borderRadius: 5, border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--accent-blue)', cursor: 'pointer' }}
                  >
                    {expandedId === proj.id ? 'Hide ▲' : 'Team & Milestones ▼'}
                  </button>
                </div>
              )}

              {/* Expanded: Team + Milestones */}
              {!compact && expandedId === proj.id && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {/* Team */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Team Members</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(team[proj.id] || []).map(m => (
                        <div key={m.talent_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                          <span style={{ color: 'var(--green)' }}>👤</span>
                          <span style={{ fontWeight: 600, flex: 1 }}>{m.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{m.talent_role}</span>
                          <button onClick={() => removeTeamMember(proj.id, m.talent_id)} style={{ fontSize: 9, color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <select
                          value={addingTeam[proj.id] || ''}
                          onChange={e => setAddingTeam(prev => ({ ...prev, [proj.id]: e.target.value }))}
                          style={{ flex: 1, fontSize: 10, padding: '3px 6px', borderRadius: 5, border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                        >
                          <option value="">+ Add engineer…</option>
                          {availTalent.map(t => <option key={t.id} value={t.id}>{t.name} ({t.status})</option>)}
                        </select>
                        <button onClick={() => addTeamMember(proj.id)} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 5, background: 'var(--accent-blue)', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
                      </div>
                    </div>
                  </div>

                  {/* Milestones */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Milestones</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(milestones[proj.id] || []).map(ms => (
                        <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            onClick={() => toggleMilestone(proj.id, ms.id, !ms.completed)}
                            style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${ms.completed ? 'var(--green)' : 'var(--border-light)'}`, background: ms.completed ? 'var(--green)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', flexShrink: 0 }}
                          >{ms.completed && '✓'}</div>
                          <span style={{ fontSize: 11, flex: 1, color: ms.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: ms.completed ? 'line-through' : 'none' }}>{ms.title}</span>
                          {ms.due_date && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(ms.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>}
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <input
                          value={newMilestone[proj.id]?.title || ''}
                          onChange={e => setNewMilestone(prev => ({ ...prev, [proj.id]: { ...prev[proj.id], title: e.target.value } }))}
                          placeholder="New milestone…"
                          style={{ flex: 1, fontSize: 10, padding: '3px 6px', borderRadius: 5, border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                          onKeyDown={e => e.key === 'Enter' && addMilestone(proj.id)}
                        />
                        <input
                          type="date"
                          value={newMilestone[proj.id]?.due_date || ''}
                          onChange={e => setNewMilestone(prev => ({ ...prev, [proj.id]: { ...prev[proj.id], due_date: e.target.value } }))}
                          style={{ fontSize: 10, padding: '3px 6px', borderRadius: 5, border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)', width: 110 }}
                        />
                        <button onClick={() => addMilestone(proj.id)} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 5, background: 'var(--accent-blue)', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
                      </div>
                    </div>
                  </div>
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
