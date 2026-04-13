import React, { useEffect, useState } from 'react';
import AdminModal from './AdminModal.jsx';
import AdminTable from './AdminTable.jsx';
import { Field, Input, Select, Row, Toggle } from './FormField.jsx';
import { apiFetch } from '../../api.js';
import { marginColor } from '../../utils/marginUtils.js';

const EMPTY = { sow_id: '', client: '', start_date: '', end_date: '', value: '', status: 'active', invoice_overdue: false, invoice_amount: '', utilization_pct: '' };
const STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
];
const statusColors = { active: 'var(--green)', expiring_soon: 'var(--amber)', expired: 'var(--red)' };

const fmtMoney = (v) => v ? '$' + parseFloat(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';

export default function ContractsAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch('/api/admin/contracts').then(r => r.json()).then(d => { setRows(d); setLoading(false); });
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
    if (!form.client.trim()) return alert('Client is required');
    setSaving(true);
    const url = modal === 'edit' ? `/api/admin/contracts/${form.id}` : '/api/admin/contracts';
    await apiFetch(url, {
      method: modal === 'edit' ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false); setModal(null); load();
  };

  const del = async (id) => { await apiFetch(`/api/admin/contracts/${id}`, { method: 'DELETE' }); load(); };

  const columns = [
    { key: 'sow_id', label: 'SOW ID', render: v => <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span> },
    { key: 'client', label: 'Client' },
    { key: 'status', label: 'Status', render: v => <span style={{ color: statusColors[v], fontWeight: 600, textTransform: 'capitalize' }}>{v?.replace('_', ' ')}</span> },
    { key: 'end_date', label: 'Expires', render: v => v ? new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
    { key: 'value', label: 'Value', render: v => <span style={{ color: 'var(--green)' }}>{fmtMoney(v)}</span> },
    {
      key: 'invoice_overdue', label: 'Invoice',
      render: (v, row) => v ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>Overdue {fmtMoney(row.invoice_amount)}</span> : <span style={{ color: 'var(--text-muted)' }}>OK</span>
    },
    { key: 'utilization_pct', label: 'Util%', render: v => <span style={{ color: v >= 80 ? 'var(--green)' : 'var(--amber)' }}>{v}%</span> },
    { key: 'linked_req_count', label: 'Reqs', render: v => <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{v || 0}</span> },
    { key: 'avg_margin', label: 'Avg Margin', render: v => v != null ? <span style={{ fontWeight: 700, color: marginColor(Math.round(parseFloat(v))) }}>{Math.round(parseFloat(v))}%</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Contract</button>
      </div>
      <AdminTable columns={columns} rows={rows} loading={loading} onEdit={openEdit} onDelete={del} />

      {modal && (
        <AdminModal title={modal === 'edit' ? 'Edit Contract' : 'Add Contract'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          {modal === 'edit' && (
            <div style={{ marginBottom: 14, padding: '7px 12px', background: 'var(--bg-hover)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>SOW ID — </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)' }}>{form.sow_id}</span>
            </div>
          )}
          <Field label="Client" required><Input value={form.client} onChange={set('client')} placeholder="e.g. Tesla" /></Field>
          <Row>
            <Field label="Start Date"><Input type="date" value={form.start_date} onChange={set('start_date')} /></Field>
            <Field label="End Date"><Input type="date" value={form.end_date} onChange={set('end_date')} /></Field>
          </Row>
          <Row>
            <Field label="Contract Value ($)"><Input type="number" value={form.value} onChange={set('value')} placeholder="480000" /></Field>
            <Field label="Status"><Select value={form.status} onChange={set('status')} options={STATUS_OPTS} /></Field>
          </Row>
          <Row>
            <Field label="Utilization %"><Input type="number" value={form.utilization_pct} onChange={set('utilization_pct')} placeholder="0–100" /></Field>
            <Field label="Overdue Invoice Amount ($)"><Input type="number" value={form.invoice_amount} onChange={set('invoice_amount')} placeholder="0" /></Field>
          </Row>
          <Toggle label="Invoice Overdue" value={form.invoice_overdue} onChange={set('invoice_overdue')} />
        </AdminModal>
      )}
    </div>
  );
}
