import React, { useEffect, useState } from 'react';
import AdminModal from './admin/AdminModal.jsx';
import { Field, Input, Select, Row, Toggle } from './admin/FormField.jsx';
import { apiFetch } from '../api.js';
import ExportButton from './ExportButton.jsx';
import SendReportModal from './SendReportModal.jsx';

const EMPTY = { req_id: '', title: '', client: '', stage: 'intake', days_in_stage: 0, stalled: false, priority: 'MED', role_type: '' };
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

  const load = () => {
    setLoading(true);
    apiFetch('/api/admin/requirements').then(r => r.json()).then(d => { setReqs(d); setLoading(false); });
  };
  useEffect(load, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (row) => { setForm({ ...row }); setModal('edit'); };

  const save = async () => {
    if (!form.req_id.trim() || !form.title.trim()) return alert('Req ID and Title are required');
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
    await apiFetch(`/api/pipeline/${id}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: STAGES[idx + 1] }),
    });
    load();
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

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Requirements</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>Manage and track all open requirements through the pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton
            data={{
              title: 'Requirements Pipeline Report',
              sections: [{ heading: 'Requirements', rows: reqs.map(r => ({ 'Req ID': r.req_id, Title: r.title, Client: r.client, Stage: r.stage, Priority: r.priority, 'Days in Stage': r.days_in_stage, 'Role Type': r.role_type, Stalled: r.stalled ? 'Yes' : 'No' })) }],
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '1px 5px', borderRadius: 3 }}>{req.req_id}</span>
                      {req.stalled && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', background: 'var(--red-dim)', padding: '1px 5px', borderRadius: 3 }}>STALLED</span>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 3 }}>{req.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{req.client}</div>
                    {req.days_in_stage > 0 && (
                      <div style={{ fontSize: 10, color: req.stalled ? 'var(--red)' : 'var(--text-muted)', marginTop: 4 }}>⏱ {req.days_in_stage}d in stage</div>
                    )}
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <span className={`tag ${req.priority === 'HIGH' ? 'tag-red' : req.priority === 'MED' ? 'tag-amber' : 'tag-gray'}`} style={{ fontSize: 9 }}>{req.priority}</span>
                      <span className="tag tag-gray" style={{ fontSize: 9 }}>{req.role_type}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 7 }}>
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
                {['Req ID', 'Title', 'Client', 'Stage', 'Priority', 'Days', 'Role Type', ''].map(h => (
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

      {showSend && (
        <SendReportModal
          reportType="Requirements Pipeline"
          data={{ title: 'Requirements Pipeline Report', sections: [{ heading: 'Requirements', rows: reqs.map(r => ({ 'Req ID': r.req_id, Title: r.title, Client: r.client, Stage: r.stage, Priority: r.priority, 'Days in Stage': r.days_in_stage })) }] }}
          onClose={() => setShowSend(false)}
        />
      )}

      {modal && (
        <AdminModal title={modal === 'edit' ? 'Edit Requirement' : 'Add Requirement'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Row>
            <Field label="Req ID" required><Input value={form.req_id} onChange={set('req_id')} placeholder="e.g. Req-450" /></Field>
            <Field label="Priority"><Select value={form.priority} onChange={set('priority')} options={PRIORITIES} /></Field>
          </Row>
          <Field label="Job Title" required><Input value={form.title} onChange={set('title')} placeholder="e.g. Senior React Developer" /></Field>
          <Row>
            <Field label="Client"><Input value={form.client} onChange={set('client')} placeholder="e.g. Tesla" /></Field>
            <Field label="Role Type"><Input value={form.role_type} onChange={set('role_type')} placeholder="e.g. Full Stack" /></Field>
          </Row>
          <Row>
            <Field label="Stage"><Select value={form.stage} onChange={set('stage')} options={STAGES} /></Field>
            <Field label="Days in Stage"><Input type="number" value={form.days_in_stage} onChange={set('days_in_stage')} /></Field>
          </Row>
          <Toggle label="Mark as Stalled" value={form.stalled} onChange={set('stalled')} />
        </AdminModal>
      )}
    </div>
  );
}
