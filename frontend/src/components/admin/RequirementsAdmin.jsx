import React, { useEffect, useState } from 'react';
import AdminModal from './AdminModal.jsx';
import AdminTable from './AdminTable.jsx';
import { Field, Input, Select, Row, Toggle } from './FormField.jsx';

const EMPTY = { req_id: '', title: '', client: '', stage: 'intake', days_in_stage: 0, stalled: false, priority: 'MED', role_type: '' };
const STAGES = ['intake', 'sourcing', 'submission', 'screening', 'interviewing', 'closure'];
const PRIORITIES = ['HIGH', 'MED', 'LOW'];

const priorityColors = { HIGH: 'var(--red)', MED: 'var(--amber)', LOW: 'var(--accent-blue)' };
const stageColors = {
  intake: 'var(--text-muted)', sourcing: 'var(--purple)', submission: 'var(--accent-blue)',
  screening: 'var(--amber)', interviewing: 'var(--accent-cyan)', closure: 'var(--green)',
};

export default function RequirementsAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/requirements').then(r => r.json()).then(d => { setRows(d); setLoading(false); });
  };
  useEffect(load, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (row) => { setForm({ ...row }); setModal('edit'); };

  const save = async () => {
    if (!form.req_id.trim() || !form.title.trim()) return alert('Req ID and Title are required');
    setSaving(true);
    const url = modal === 'edit' ? `/api/admin/requirements/${form.id}` : '/api/admin/requirements';
    await fetch(url, {
      method: modal === 'edit' ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setModal(null);
    load();
  };

  const del = async (id) => { await fetch(`/api/admin/requirements/${id}`, { method: 'DELETE' }); load(); };

  const columns = [
    { key: 'req_id', label: 'Req ID', render: v => <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{v}</span> },
    { key: 'title', label: 'Title' },
    { key: 'client', label: 'Client' },
    { key: 'stage', label: 'Stage', render: v => <span style={{ color: stageColors[v], fontWeight: 600, textTransform: 'capitalize' }}>{v}</span> },
    { key: 'priority', label: 'Priority', render: v => <span style={{ color: priorityColors[v], fontWeight: 700 }}>{v}</span> },
    { key: 'days_in_stage', label: 'Days', render: (v, row) => <span style={{ color: row.stalled ? 'var(--red)' : 'var(--text-secondary)' }}>{v}d{row.stalled ? ' ⚠' : ''}</span> },
    { key: 'role_type', label: 'Role Type' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Requirement</button>
      </div>
      <AdminTable columns={columns} rows={rows} loading={loading} onEdit={openEdit} onDelete={del} />

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
