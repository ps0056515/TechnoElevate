import React, { useEffect, useState } from 'react';
import AdminModal from './admin/AdminModal.jsx';
import { Field, Input, Select, Row, Toggle } from './admin/FormField.jsx';
import { apiFetch } from '../api.js';
import ExportButton from './ExportButton.jsx';
import SendReportModal from './SendReportModal.jsx';
import { fmtRate, calcMargin, marginColor } from '../utils/marginUtils.js';

const EMPTY = { title: '', client: '', stage: 'intake', days_in_stage: 0, stalled: false, priority: 'MED', role_type: '', bill_rate: '', pay_rate: '', contract_id: '' };
const STAGES = ['intake', 'sourcing', 'submission', 'screening', 'interviewing', 'closure'];
const PRIORITIES = ['HIGH', 'MED', 'LOW'];

const stageColors = {
  intake: 'var(--text-muted)', sourcing: 'var(--purple)', submission: 'var(--accent-blue)',
  screening: 'var(--amber)', interviewing: 'var(--accent-cyan)', closure: 'var(--green)',
};
const priorityColors = { HIGH: 'var(--red)', MED: 'var(--amber)', LOW: 'var(--accent-blue)' };

export default function RequirementsPage() {
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('kanban');
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showSend, setShowSend] = useState(false);
  const [availableTalent, setAvailableTalent] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignTalentId, setAssignTalentId] = useState('');
  const [closureNotice, setClosureNotice] = useState(null);
  const [matchTarget, setMatchTarget] = useState(null);      // req being AI-matched
  const [matchResults, setMatchResults] = useState(null);    // { matches: [...] }
  const [matchLoading, setMatchLoading] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch('/api/admin/requirements')
      .then(r => r && r.json ? r.json() : [])
      .then(d => { setReqs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setReqs([]); setLoading(false); });
  };
  useEffect(() => {
    load();
    apiFetch('/api/talent/available').then(r => r.json()).then(setAvailableTalent).catch(() => {});
    apiFetch('/api/admin/contracts').then(r => r.json()).then(setContracts).catch(() => {});
  }, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (row) => { setForm({ ...row }); setModal('edit'); };

  const save = async () => {
    if (!form.title.trim()) return alert('Job Title is required');
    setSaving(true);
    const url = modal === 'edit' ? `/api/admin/requirements/${form.id}` : '/api/admin/requirements';
    await apiFetch(url, {
      method: modal === 'edit' ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false); setModal(null); load();
  };

  const del = async (id) => {
    if (!confirm('Delete this requirement?')) return;
    await apiFetch(`/api/admin/requirements/${id}`, { method: 'DELETE' });
    load();
  };

  const advance = async (id, currentStage) => {
    const idx = STAGES.indexOf(currentStage);
    if (idx >= STAGES.length - 1) return;
    const nextStage = STAGES[idx + 1];
    await apiFetch(`/api/pipeline/${id}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: nextStage }),
    });
    if (nextStage === 'closure') {
      const req = reqs.find(r => r.id === id);
      if (req?.assigned_talent_name) {
        setClosureNotice({ reqId: id, talentName: req.assigned_talent_name, client: req.client });
        setTimeout(() => setClosureNotice(null), 6000);
      }
    }
    load();
    apiFetch('/api/talent/available').then(r => r.json()).then(setAvailableTalent).catch(() => {});
  };

  const openAssign = (req) => {
    setAssignTarget(req);
    setAssignTalentId(req.assigned_talent_id ? String(req.assigned_talent_id) : '');
  };

  const doAssign = async () => {
    if (!assignTarget) return;
    await apiFetch(`/api/pipeline/${assignTarget.id}/assign`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talent_id: assignTalentId ? parseInt(assignTalentId) : null }),
    });
    setAssignTarget(null);
    load();
    apiFetch('/api/talent/available').then(r => r.json()).then(setAvailableTalent).catch(() => {});
  };

  const openMatch = async (req) => {
    setMatchTarget(req);
    setMatchResults(null);
    setMatchLoading(true);
    try {
      const res = await apiFetch(`/api/requirements/${req.id}/match-talent`);
      const data = await res.json();
      setMatchResults(data);
    } catch { setMatchResults({ error: 'Failed to get matches' }); }
    setMatchLoading(false);
  };

  const assignFromMatch = async (reqId, talentId) => {
    await apiFetch(`/api/pipeline/${reqId}/assign`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talent_id: talentId }),
    });
    setMatchTarget(null); setMatchResults(null);
    load();
    apiFetch('/api/talent/available').then(r => r.json()).then(setAvailableTalent).catch(() => {});
  };

  const rejectReq = async (req) => {
    const reason = prompt(`Rejection reason for "${req.title}":\n(e.g. "Budget freeze", "Role cancelled")`);
    if (reason === null) return;
    await apiFetch(`/api/pipeline/${req.id}/reject`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejection_reason: reason }),
    });
    load();
    apiFetch('/api/talent/available').then(r => r.json()).then(setAvailableTalent).catch(() => {});
  };

  const filtered = reqs.filter(r => {
    const matchSearch = !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.req_id?.toLowerCase().includes(search.toLowerCase()) || r.client?.toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === 'all' || r.priority === filterPriority;
    return matchSearch && matchPriority;
  });

  const byStage = (stage) => filtered.filter(r => r.stage === stage);
  const totalOpen = reqs.filter(r => r.stage !== 'closure').length;
  const stalledCount = reqs.filter(r => r.stalled).length;
  const highCount = reqs.filter(r => r.priority === 'HIGH').length;
  const ratedReqs = reqs.filter(r => parseFloat(r.bill_rate) > 0);
  const avgMargin = ratedReqs.length > 0
    ? Math.round(ratedReqs.reduce((sum, r) => sum + calcMargin(r.bill_rate, r.pay_rate), 0) / ratedReqs.length)
    : null;

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center' }}>
            Requirements
            <AiBadge />
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>Manage and track all open requirements through the pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton
            data={{
              title: 'Requirements Pipeline Report',
              sections: [{ heading: 'Requirements', rows: reqs.map(r => ({ 'Req ID': r.req_id, Title: r.title, Client: r.client, Stage: r.stage, Priority: r.priority, 'Days in Stage': r.days_in_stage, 'Role Type': r.role_type, 'Bill Rate': fmtRate(r.bill_rate), 'Pay Rate': fmtRate(r.pay_rate), 'Margin %': parseFloat(r.bill_rate) > 0 ? `${calcMargin(r.bill_rate, r.pay_rate)}%` : '—', Stalled: r.stalled ? 'Yes' : 'No' })) }],
            }}
            filename="requirements-report"
          />
          <button className="btn btn-secondary" onClick={() => setShowSend(true)} style={{ fontSize: 13 }}>📧 Send</button>
          <button onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')} className="btn btn-ghost">
            {viewMode === 'kanban' ? '☰ List View' : '⊞ Kanban View'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Requirement</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Open Reqs', value: totalOpen, color: 'var(--accent-blue)' },
          { label: 'HIGH Priority', value: highCount, color: 'var(--red)' },
          { label: 'Stalled', value: stalledCount, color: 'var(--amber)' },
          { label: 'Total Reqs', value: reqs.length, color: 'var(--green)' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
        <div className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${marginColor(avgMargin)}` }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>Avg Margin</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: marginColor(avgMargin) }}>{avgMargin !== null ? `${avgMargin}%` : '—'}</div>
        </div>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by Req ID, title, or client…"
          style={{
            flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-light)',
            borderRadius: 7, padding: '8px 12px', color: 'var(--text-primary)',
            fontSize: 13, fontFamily: 'var(--font)', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent-blue)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
        />
        {['all', 'HIGH', 'MED', 'LOW'].map(p => (
          <button key={p} onClick={() => setFilterPriority(p)}
            className={`btn btn-sm ${filterPriority === p ? 'btn-primary' : 'btn-ghost'}`}>
            {p === 'all' ? 'All Priority' : p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /> Loading requirements…</div>
      ) : viewMode === 'kanban' ? (
        // Kanban view
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, overflowX: 'auto' }}>
          {STAGES.map(stage => (
            <div key={stage} style={{ minWidth: 170 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                padding: '6px 8px', borderRadius: 6,
                background: 'var(--bg-card2)', border: `1px solid ${stageColors[stage]}33`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageColors[stage], flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: stageColors[stage], textTransform: 'uppercase', letterSpacing: 0.6 }}>{stage}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{byStage(stage).length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {byStage(stage).map(req => (
                  <div key={req.id} style={{
                    background: req.stalled ? 'rgba(255,71,87,0.05)' : 'var(--bg-card2)',
                    border: req.stalled ? '1px solid rgba(255,71,87,0.4)' : '1px solid var(--border)',
                    borderRadius: 7, padding: '9px 10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '1px 5px', borderRadius: 3 }}>{req.req_id}</span>
                      {req.stalled && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', background: 'var(--red-dim)', padding: '1px 5px', borderRadius: 3 }}>STALLED</span>}
                      {req.lead_company && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--purple)', background: 'rgba(165,94,234,0.12)', padding: '1px 5px', borderRadius: 3 }}>↑ {req.lead_company}</span>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 3 }}>{req.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{req.client}</div>
                    {req.days_in_stage > 0 && (
                      <div style={{ fontSize: 10, color: req.stalled ? 'var(--red)' : 'var(--text-muted)', marginTop: 4 }}>⏱ {req.days_in_stage}d in stage</div>
                    )}
                    {/* Assigned Talent badge */}
                    {req.assigned_talent_name
                      ? <div style={{ marginTop: 5, padding: '3px 6px', borderRadius: 4, background: 'rgba(46,213,115,0.1)', border: '1px solid rgba(46,213,115,0.3)', fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>
                          👤 {req.assigned_talent_name}
                        </div>
                      : <button onClick={() => openAssign(req)} style={{ marginTop: 5, width: '100%', padding: '3px 0', background: 'rgba(0,170,255,0.06)', border: '1px dashed rgba(0,170,255,0.3)', borderRadius: 4, fontSize: 10, color: 'var(--accent-blue)', cursor: 'pointer' }}>
                          + Assign Talent
                        </button>
                    }
                    {/* Contract badge */}
                    {req.contract_sow_id && (
                      <div style={{ marginTop: 4, fontSize: 9, color: 'var(--amber)', background: 'rgba(255,165,2,0.1)', border: '1px solid rgba(255,165,2,0.25)', padding: '2px 5px', borderRadius: 3 }}>
                        📄 {req.contract_sow_id}
                      </div>
                    )}
                    {parseFloat(req.bill_rate) > 0 && (() => {
                      const pct = calcMargin(req.bill_rate, req.pay_rate);
                      return (
                        <div style={{ marginTop: 5, padding: '3px 6px', borderRadius: 4, background: `${marginColor(pct)}22`, border: `1px solid ${marginColor(pct)}55`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Margin</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: marginColor(pct) }}>{pct}%</span>
                        </div>
                      );
                    })()}
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <span className={`tag ${req.priority === 'HIGH' ? 'tag-red' : req.priority === 'MED' ? 'tag-amber' : 'tag-gray'}`} style={{ fontSize: 9 }}>{req.priority}</span>
                      <span className="tag tag-gray" style={{ fontSize: 9 }}>{req.role_type}</span>
                    </div>
                    {req.rejection_reason && (
                      <div style={{ marginTop: 4, fontSize: 9, color: 'var(--red)', background: 'var(--red-dim)', padding: '2px 5px', borderRadius: 3 }}>
                        ↩ {req.rejection_reason}
                      </div>
                    )}
                    {/* AI Match button — only show if no talent assigned */}
                    {!req.assigned_talent_name && (
                      <button onClick={() => openMatch(req)} style={{
                        marginTop: 6, width: '100%', padding: '4px 0',
                        background: 'linear-gradient(135deg, rgba(165,94,234,0.08), rgba(79,124,255,0.08))',
                        border: '1px solid rgba(165,94,234,0.35)',
                        borderRadius: 4, fontSize: 10, color: 'var(--purple)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}>
                        🤖 Match Talent
                        <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--purple)', background: 'rgba(165,94,234,0.18)', border: '1px solid rgba(165,94,234,0.35)', borderRadius: 3, padding: '1px 4px', letterSpacing: 0.5 }}>AI</span>
                      </button>
                    )}
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => openEdit(req)} style={{ flex: 1, padding: '3px 0', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 4, fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}
                        onMouseEnter={e => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-muted)'; }}>
                        Edit
                      </button>
                      {stage !== 'closure' && (
                        <button onClick={() => advance(req.id, req.stage)} style={{ flex: 1, padding: '3px 0', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 4, fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}
                          onMouseEnter={e => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                          onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-muted)'; }}>
                          Next →
                        </button>
                      )}
                      {['screening', 'interviewing'].includes(stage) && (
                        <button onClick={() => rejectReq(req)} style={{ padding: '3px 6px', background: 'transparent', border: '1px solid rgba(255,71,87,0.4)', borderRadius: 4, fontSize: 10, color: 'var(--red)', cursor: 'pointer' }}>
                          ✕ Reject
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List view
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card2)' }}>
                {['Req ID', 'Title', 'Client', 'Stage', 'Priority', 'Days', 'Role Type', 'Lead', 'Assigned To', 'Contract', 'Bill Rate', 'Pay Rate', 'Margin', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(req => (
                <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 14px' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{req.req_id}</span></td>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{req.title}{req.stalled && <span style={{ color: 'var(--red)', fontSize: 10, marginLeft: 6 }}>⚠ stalled</span>}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{req.client}</td>
                  <td style={{ padding: '10px 14px' }}><span style={{ color: stageColors[req.stage], fontWeight: 600, textTransform: 'capitalize' }}>{req.stage}</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ color: priorityColors[req.priority], fontWeight: 700 }}>{req.priority}</span></td>
                  <td style={{ padding: '10px 14px', color: req.days_in_stage > 3 ? 'var(--amber)' : 'var(--text-muted)' }}>{req.days_in_stage}d</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{req.role_type}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {req.lead_company
                      ? <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--purple)', background: 'rgba(165,94,234,0.12)', padding: '2px 6px', borderRadius: 4 }}>↑ {req.lead_company}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {req.assigned_talent_name
                      ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>👤 {req.assigned_talent_name}</span>
                      : <button onClick={() => openAssign(req)} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 10, color: 'var(--accent-blue)' }}>+ Assign</button>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {req.contract_sow_id
                      ? <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)', background: 'rgba(255,165,2,0.1)', padding: '2px 6px', borderRadius: 4 }}>📄 {req.contract_sow_id}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500 }}>{fmtRate(req.bill_rate)}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 500 }}>{fmtRate(req.pay_rate)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {parseFloat(req.bill_rate) > 0 ? (() => {
                      const pct = calcMargin(req.bill_rate, req.pay_rate);
                      return <span style={{ fontWeight: 700, color: marginColor(pct) }}>{pct}%</span>;
                    })() : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(req)} className="btn btn-ghost btn-sm" style={{ padding: '3px 9px' }}>Edit</button>
                      <button onClick={() => del(req.id)} className="btn btn-sm" style={{ padding: '3px 9px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No requirements match your filter.</div>
          )}
        </div>
      )}

      {/* Closure notice toast */}
      {closureNotice && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: 'var(--green)', color: '#fff', borderRadius: 10,
          padding: '14px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          maxWidth: 320, fontSize: 13, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Requirement Closed!</div>
          <div>Engagement auto-created for <strong>{closureNotice.talentName}</strong> at <strong>{closureNotice.client}</strong>.</div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>Check Engagements page for the new checklist.</div>
        </div>
      )}

      {/* Assign Talent modal */}
      {assignTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, minWidth: 360, maxWidth: 440, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Assign Talent</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {assignTarget.req_id} · {assignTarget.title} · {assignTarget.client}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Select Engineer</label>
              <select
                value={assignTalentId}
                onChange={e => setAssignTalentId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border-light)', background: 'var(--bg-input, var(--bg-card2))', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font)' }}
              >
                <option value="">— Unassign / None —</option>
                {availableTalent.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.role} ({t.status}){t.pay_rate > 0 ? ` · $${Number(t.pay_rate).toLocaleString('en-US')}/mo` : ''}
                  </option>
                ))}
              </select>
            </div>
            {assignTalentId && (() => {
              const t = availableTalent.find(x => String(x.id) === String(assignTalentId));
              if (!t || !t.pay_rate) return null;
              const billRate = parseFloat(assignTarget.bill_rate);
              if (!billRate) return <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Set a bill rate on this requirement to see margin preview.</div>;
              const pct = calcMargin(billRate, t.pay_rate);
              return (
                <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 6, background: `${marginColor(pct)}15`, border: `1px solid ${marginColor(pct)}40`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Projected Margin</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: marginColor(pct) }}>{pct}%</span>
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setAssignTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doAssign}>Save Assignment</button>
            </div>
          </div>
        </div>
      )}

      {showSend && (
        <SendReportModal
          reportType="Requirements Pipeline"
          data={{ title: 'Requirements Pipeline Report', sections: [{ heading: 'Requirements', rows: reqs.map(r => ({ 'Req ID': r.req_id, Title: r.title, Client: r.client, Stage: r.stage, Priority: r.priority, 'Days in Stage': r.days_in_stage, 'Bill Rate': fmtRate(r.bill_rate), 'Pay Rate': fmtRate(r.pay_rate), 'Margin %': parseFloat(r.bill_rate) > 0 ? `${calcMargin(r.bill_rate, r.pay_rate)}%` : '—' })) }] }}
          onClose={() => setShowSend(false)}
        />
      )}

      {modal && (
        <AdminModal title={modal === 'edit' ? 'Edit Requirement' : 'Add Requirement'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          {/* Req ID — show as badge in edit, auto-generated notice in add */}
          <div style={{ marginBottom: 14, padding: '7px 12px', background: 'var(--bg-hover)', borderRadius: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Req ID</span>
            {modal === 'edit'
              ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)' }}>{form.req_id}</span>
              : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Auto-generated on save</span>}
          </div>
          <Row>
            <Field label="Priority"><Select value={form.priority} onChange={set('priority')} options={PRIORITIES} /></Field>
            <Field label="Role Type"><Input value={form.role_type} onChange={set('role_type')} placeholder="e.g. Full Stack" /></Field>
          </Row>
          <Field label="Job Title" required><Input value={form.title} onChange={set('title')} placeholder="e.g. Senior React Developer" /></Field>
          <Row>
            <Field label="Client"><Input value={form.client} onChange={set('client')} placeholder="e.g. Tesla" /></Field>
          </Row>
          <Row>
            <Field label="Stage"><Select value={form.stage} onChange={set('stage')} options={STAGES} /></Field>
            <Field label="Days in Stage"><Input type="number" value={form.days_in_stage} onChange={set('days_in_stage')} /></Field>
          </Row>
          <Row>
            <Field label="Bill Rate / Mo ($)" hint="What the client is billed monthly">
              <Input type="number" value={form.bill_rate} onChange={set('bill_rate')} placeholder="e.g. 16000" />
            </Field>
            <Field label="Pay Rate / Mo ($)" hint="Expected engineer cost monthly">
              <Input type="number" value={form.pay_rate} onChange={set('pay_rate')} placeholder="e.g. 9500" />
            </Field>
          </Row>
          {parseFloat(form.bill_rate) > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: `${marginColor(calcMargin(form.bill_rate, form.pay_rate))}15`, border: `1px solid ${marginColor(calcMargin(form.bill_rate, form.pay_rate))}40`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estimated Margin</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: marginColor(calcMargin(form.bill_rate, form.pay_rate)) }}>
                {calcMargin(form.bill_rate, form.pay_rate)}%
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 8, color: 'var(--text-muted)' }}>
                  (${(parseFloat(form.bill_rate) - parseFloat(form.pay_rate || 0)).toLocaleString('en-US')}/mo)
                </span>
              </span>
            </div>
          )}
          {contracts.length > 0 && (
            <Field label="Link to Contract (optional)">
              <select
                value={form.contract_id || ''}
                onChange={e => set('contract_id')(e.target.value || null)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border-light)', background: 'var(--bg-input, var(--bg-card2))', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font)' }}
              >
                <option value="">— Not linked —</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>{c.sow_id} · {c.client}</option>
                ))}
              </select>
            </Field>
          )}
          <Toggle label="Mark as Stalled" value={form.stalled} onChange={set('stalled')} />
        </AdminModal>
      )}

      {/* ── AI Match Talent Modal ─────────────────────────────────────────── */}
      {matchTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>AI Talent Match</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{matchTarget.req_id} · {matchTarget.title} · {matchTarget.client}</div>
              </div>
              <button onClick={() => { setMatchTarget(null); setMatchResults(null); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
            </div>

            {matchLoading && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ marginBottom: 12 }} />
                Analysing bench talent with GPT-4o…
              </div>
            )}

            {matchResults?.error && (
              <div style={{ color: 'var(--red)', padding: 16, textAlign: 'center' }}>{matchResults.error}</div>
            )}

            {matchResults?.message && !matchResults?.matches?.length && (
              <div style={{ color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>{matchResults.message}</div>
            )}

            {matchResults?.matches?.map((m, i) => (
              <div key={m.talent_id} style={{
                border: `1px solid ${i === 0 ? 'var(--green)' : 'var(--border)'}`,
                borderRadius: 8, padding: '12px 14px', marginBottom: 10,
                background: i === 0 ? 'rgba(46,213,115,0.04)' : 'var(--bg-card2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {i === 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'var(--green-dim)', padding: '2px 6px', borderRadius: 4 }}>⭐ BEST MATCH</span>}
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{m.name}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 16, color: m.match_score >= 70 ? 'var(--green)' : m.match_score >= 45 ? 'var(--amber)' : 'var(--red)' }}>
                    {m.match_score}%
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{m.match_reason}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: m.gap ? 6 : 0 }}>
                  {m.skill_overlap?.map(s => (
                    <span key={s} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(79,124,255,0.1)', color: 'var(--accent-blue)', border: '1px solid rgba(79,124,255,0.2)' }}>{s}</span>
                  ))}
                </div>
                {m.gap && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>⚠ Gap: {m.gap}</div>}
                <button
                  onClick={() => assignFromMatch(matchTarget.id, m.talent_id)}
                  style={{ marginTop: 10, padding: '5px 14px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Assign {m.name} →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AiBadge() {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase',
      background: 'linear-gradient(135deg, rgba(165,94,234,0.15), rgba(79,124,255,0.15))',
      color: 'var(--purple)', border: '1px solid rgba(165,94,234,0.4)',
      borderRadius: 4, padding: '2px 6px', marginLeft: 7, verticalAlign: 'middle',
    }}>✦ AI</span>
  );
}
