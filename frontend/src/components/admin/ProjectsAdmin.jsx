import React, { useEffect, useState } from 'react';
import AdminModal from './AdminModal.jsx';
import AdminTable from './AdminTable.jsx';
import { Field, Input, Select, Textarea, Row } from './FormField.jsx';
import { apiFetch } from '../../api.js';

const EMPTY = { name: '', client: '', stage: 'green', blocking_issue: '', team_size: 0, start_date: '', end_date: '', utilization_pct: 0, industry: '', sector: '', geography: '' };

const INDUSTRIES = ['FinTech', 'HealthTech', 'Retail', 'Manufacturing', 'Technology', 'BFSI', 'Telecom', 'Other'];
const STAGES = [
  { value: 'green', label: 'On Track' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];
const stageColors = { green: 'var(--green)', at_risk: 'var(--amber)', blocked: 'var(--red)', completed: 'var(--accent-blue)' };
const stageLabels = { green: 'On Track', at_risk: 'At Risk', blocked: 'Blocked', completed: 'Completed' };

export default function ProjectsAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch('/api/admin/projects').then(r => r.json()).then(d => { setRows(d); setLoading(false); });
  };
  useEffect(load, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (row) => {
    setForm({
      ...row,
      start_date: row.start_date?.split('T')[0] || '',
      end_date: row.end_date?.split('T')[0] || '',
    });
    setModal('edit');
  };

  const save = async () => {
    if (!form.name.trim()) return alert('Project name is required');
    setSaving(true);
    const url = modal === 'edit' ? `/api/admin/projects/${form.id}` : '/api/admin/projects';
    await apiFetch(url, {
      method: modal === 'edit' ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false); setModal(null); load();
  };

  const del = async (id) => { await apiFetch(`/api/admin/projects/${id}`, { method: 'DELETE' }); load(); };

  const columns = [
    { key: 'name', label: 'Project' },
    { key: 'client', label: 'Client' },
    { key: 'stage', label: 'Stage', render: v => <span style={{ color: stageColors[v], fontWeight: 600 }}>{stageLabels[v] || v}</span> },
    { key: 'team_size', label: 'Team', render: v => <span style={{ color: 'var(--text-secondary)' }}>{v} members</span> },
    {
      key: 'utilization_pct', label: 'Util%',
      render: v => <span style={{ color: v >= 85 ? 'var(--green)' : v >= 70 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>{v}%</span>
    },
    { key: 'blocking_issue', label: 'Blocking Issue', render: v => v ? <span style={{ color: 'var(--red)' }}>{v}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'industry', label: 'Industry', render: v => v ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--accent-blue)', color: '#fff' }}>{v}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Project</button>
      </div>
      <AdminTable columns={columns} rows={rows} loading={loading} onEdit={openEdit} onDelete={del} />

      {modal && (
        <AdminModal title={modal === 'edit' ? 'Edit Project' : 'Add Project'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Row>
            <Field label="Project Name" required><Input value={form.name} onChange={set('name')} placeholder="e.g. Project Alpha" /></Field>
            <Field label="Client"><Input value={form.client} onChange={set('client')} placeholder="e.g. Tesla" /></Field>
          </Row>
          <Row>
            <Field label="Stage"><Select value={form.stage} onChange={set('stage')} options={STAGES} /></Field>
            <Field label="Team Size"><Input type="number" value={form.team_size} onChange={set('team_size')} /></Field>
          </Row>
          <Row>
            <Field label="Start Date"><Input type="date" value={form.start_date} onChange={set('start_date')} /></Field>
            <Field label="End Date"><Input type="date" value={form.end_date} onChange={set('end_date')} /></Field>
          </Row>
          <Field label="Utilization %"><Input type="number" value={form.utilization_pct} onChange={set('utilization_pct')} placeholder="0–100" /></Field>
          <Field label="Blocking Issue (leave blank if none)">
            <Textarea value={form.blocking_issue || ''} onChange={set('blocking_issue')} placeholder="Describe the blocking issue…" rows={2} />
          </Field>
          <Row>
            <Field label="Industry">
              <Select value={form.industry || ''} onChange={set('industry')} options={[{ value: '', label: 'Select industry…' }, ...INDUSTRIES.map(i => ({ value: i, label: i }))]} />
            </Field>
            <Field label="Sector"><Input value={form.sector || ''} onChange={set('sector')} placeholder="e.g. Payments, EMR, E-Commerce" /></Field>
          </Row>
          <Field label="Geography"><Input value={form.geography || ''} onChange={set('geography')} placeholder="e.g. US West, APAC, India" /></Field>
        </AdminModal>
      )}
    </div>
  );
}
