import React, { useEffect, useState } from 'react';
import AdminModal from './AdminModal.jsx';
import AdminTable from './AdminTable.jsx';
import { Field, Input, Select, Textarea, Row, Toggle } from './FormField.jsx';
import { apiFetch } from '../../api.js';

const EMPTY = { priority: 'MED', entity_name: '', entity_type: 'requirement', entity_id: '', issue_description: '', action_label: '', days_stalled: 0, resolved: false };
const PRIORITIES = ['HIGH', 'MED', 'LOW'];
const ENTITY_TYPES = ['requirement', 'contract', 'project', 'talent'];
const priorityColors = { HIGH: 'var(--red)', MED: 'var(--amber)', LOW: 'var(--accent-blue)' };

export default function AttentionAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch('/api/admin/attention').then(r => r.json()).then(d => { setRows(d); setLoading(false); });
  };
  useEffect(load, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (row) => { setForm({ ...row }); setModal('edit'); };

  const save = async () => {
    if (!form.entity_name.trim() || !form.issue_description.trim()) return alert('Entity Name and Issue Description are required');
    setSaving(true);
    const url = modal === 'edit' ? `/api/admin/attention/${form.id}` : '/api/admin/attention';
    await apiFetch(url, {
      method: modal === 'edit' ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false); setModal(null); load();
  };

  const del = async (id) => { await apiFetch(`/api/admin/attention/${id}`, { method: 'DELETE' }); load(); };

  const columns = [
    { key: 'priority', label: 'Priority', render: v => <span style={{ color: priorityColors[v], fontWeight: 700 }}>{v}</span> },
    { key: 'entity_name', label: 'Entity' },
    { key: 'entity_type', label: 'Type', render: v => <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{v}</span> },
    { key: 'issue_description', label: 'Issue' },
    { key: 'action_label', label: 'Action Button' },
    { key: 'days_stalled', label: 'Days', render: v => v > 0 ? <span style={{ color: 'var(--amber)' }}>{v}d</span> : '—' },
    { key: 'resolved', label: 'Resolved', render: v => v ? <span style={{ color: 'var(--green)' }}>Yes</span> : <span style={{ color: 'var(--text-muted)' }}>No</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Issue</button>
      </div>
      <AdminTable columns={columns} rows={rows} loading={loading} onEdit={openEdit} onDelete={del} />

      {modal && (
        <AdminModal title={modal === 'edit' ? 'Edit Issue' : 'Add Attention Issue'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Row>
            <Field label="Priority"><Select value={form.priority} onChange={set('priority')} options={PRIORITIES} /></Field>
            <Field label="Entity Type"><Select value={form.entity_type} onChange={set('entity_type')} options={ENTITY_TYPES} /></Field>
          </Row>
          <Row>
            <Field label="Entity Name" required><Input value={form.entity_name} onChange={set('entity_name')} placeholder="e.g. Req-402" /></Field>
            <Field label="Entity ID"><Input value={form.entity_id} onChange={set('entity_id')} placeholder="e.g. Req-402" /></Field>
          </Row>
          <Field label="Issue Description" required>
            <Textarea value={form.issue_description} onChange={set('issue_description')} placeholder="Describe the issue clearly…" rows={2} />
          </Field>
          <Row>
            <Field label="Action Button Label"><Input value={form.action_label} onChange={set('action_label')} placeholder="e.g. Source Now" /></Field>
            <Field label="Days Stalled"><Input type="number" value={form.days_stalled} onChange={set('days_stalled')} /></Field>
          </Row>
          <Toggle label="Already Resolved" value={form.resolved} onChange={set('resolved')} />
        </AdminModal>
      )}
    </div>
  );
}
