import React, { useEffect, useState } from 'react';
import AdminModal from './AdminModal.jsx';
import AdminTable from './AdminTable.jsx';
import { Field, Input, Select, Row } from './FormField.jsx';
import { apiFetch } from '../../api.js';

const EMPTY = { name: '', role: '', status: 'bench', bench_start_date: '', idle_hours: 0, current_client: '', skills: '', pay_rate: '' };
const STATUS_OPTS = ['bench', 'in_process', 'interviewing', 'offered', 'deployed'];

const statusColors = {
  bench: 'var(--text-muted)', in_process: 'var(--amber)',
  interviewing: 'var(--accent-blue)', offered: 'var(--green)', deployed: 'var(--accent-cyan)',
};

export default function TalentAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch('/api/admin/talent').then(r => r && r.json ? r.json() : []).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => { setRows([]); setLoading(false); });
  };
  useEffect(load, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (row) => {
    setForm({ ...row, skills: Array.isArray(row.skills) ? row.skills.join(', ') : (row.skills || '') });
    setModal('edit');
  };

  const save = async () => {
    if (!form.name.trim()) return alert('Name is required');
    setSaving(true);
    const url = modal === 'edit' ? `/api/admin/talent/${form.id}` : '/api/admin/talent';
    const method = modal === 'edit' ? 'PUT' : 'POST';
    await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    setModal(null);
    load();
  };

  const del = async (id) => {
    await apiFetch(`/api/admin/talent/${id}`, { method: 'DELETE' });
    load();
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    {
      key: 'status', label: 'Status',
      render: (v) => <span style={{ color: statusColors[v], fontWeight: 600, textTransform: 'capitalize' }}>{v?.replace('_', ' ')}</span>
    },
    { key: 'current_client', label: 'Client' },
    {
      key: 'idle_hours', label: 'Idle Hrs',
      render: (v) => v > 0 ? <span style={{ color: 'var(--amber)' }}>{v}h</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>
    },
    {
      key: 'skills', label: 'Skills',
      render: (v) => {
        const arr = Array.isArray(v) ? v : [];
        return <span style={{ color: 'var(--text-muted)' }}>{arr.slice(0, 2).join(', ')}{arr.length > 2 ? ` +${arr.length - 2}` : ''}</span>;
      }
    },
    {
      key: 'pay_rate', label: 'Pay Rate / Mo',
      render: (v) => v > 0 ? <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>${Number(v).toLocaleString()}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Talent</button>
      </div>
      <AdminTable columns={columns} rows={rows} loading={loading} onEdit={openEdit} onDelete={del} />

      {modal && (
        <AdminModal title={modal === 'edit' ? 'Edit Talent' : 'Add Talent'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Row>
            <Field label="Full Name" required><Input value={form.name} onChange={set('name')} placeholder="e.g. John Doe" /></Field>
            <Field label="Role / Title"><Input value={form.role} onChange={set('role')} placeholder="e.g. MERN Developer" /></Field>
          </Row>
          <Row>
            <Field label="Status">
              <Select value={form.status} onChange={set('status')} options={STATUS_OPTS} />
            </Field>
            <Field label="Idle Hours"><Input type="number" value={form.idle_hours} onChange={set('idle_hours')} placeholder="0" /></Field>
          </Row>
          <Row>
            <Field label="Current Client"><Input value={form.current_client} onChange={set('current_client')} placeholder="e.g. Tesla" /></Field>
            <Field label="Bench Start Date"><Input type="date" value={form.bench_start_date?.split('T')[0] || ''} onChange={set('bench_start_date')} /></Field>
          </Row>
          <Field label="Skills (comma-separated)">
            <Input value={form.skills} onChange={set('skills')} placeholder="React, Node.js, MongoDB" />
          </Field>
          <Field label="Pay Rate / Mo ($)" hint="Monthly cost to company for this engineer">
            <Input type="number" value={form.pay_rate} onChange={set('pay_rate')} placeholder="e.g. 9500" />
          </Field>
        </AdminModal>
      )}
    </div>
  );
}
