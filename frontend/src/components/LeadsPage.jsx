import React, { useEffect, useState } from 'react';
import AdminModal from './admin/AdminModal.jsx';
import AdminTable from './admin/AdminTable.jsx';
import { Field, Input, Select, Textarea, Row } from './admin/FormField.jsx';
import { apiFetch } from '../api.js';

const EMPTY = {
  company_name: '', contact_name: '', contact_email: '', contact_phone: '',
  source: '', status: 'new', estimated_value: '', notes: '', follow_up_date: '',
};
const STATUS_OPTS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];
const SOURCE_OPTS = ['Referral', 'LinkedIn', 'Cold Outreach', 'Inbound', 'Event', 'Partner', 'Other'];
const statusColors = {
  new: 'var(--text-muted)', contacted: 'var(--accent-blue)', qualified: 'var(--purple)',
  proposal_sent: 'var(--amber)', negotiation: 'var(--accent-cyan)', won: 'var(--green)', lost: 'var(--red)',
};

export default function LeadsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    try {
      const res = await apiFetch('/api/leads');
      const data = await res.json();
      setRows(data);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (row) => { setForm({ ...row, follow_up_date: row.follow_up_date?.split('T')[0] || '' }); setModal('edit'); };

  const save = async () => {
    if (!form.company_name.trim()) return alert('Company name is required');
    setSaving(true);
    try {
      if (modal === 'edit') {
        await apiFetch(`/api/leads/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await apiFetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      await load();
      setModal(null);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    try {
      await apiFetch(`/api/leads/${id}`, { method: 'DELETE' });
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter);

  const totalValue = rows.filter(r => r.status !== 'lost').reduce((s, r) => s + (parseFloat(r.estimated_value) || 0), 0);
  const wonCount = rows.filter(r => r.status === 'won').length;
  const hotCount = rows.filter(r => ['negotiation', 'proposal_sent'].includes(r.status)).length;

  const columns = [
    { key: 'company_name', label: 'Company', render: v => <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span> },
    { key: 'contact_name', label: 'Contact' },
    { key: 'contact_email', label: 'Email', render: v => <span style={{ color: 'var(--accent-blue)', fontSize: 11 }}>{v}</span> },
    { key: 'source', label: 'Source', render: v => <span className="tag tag-gray" style={{ fontSize: 10 }}>{v}</span> },
    {
      key: 'status', label: 'Status',
      render: v => <span style={{ color: statusColors[v], fontWeight: 700, textTransform: 'capitalize' }}>{v?.replace('_', ' ')}</span>
    },
    {
      key: 'estimated_value', label: 'Est. Value',
      render: v => <span style={{ color: 'var(--green)', fontWeight: 600 }}>{v ? '$' + parseFloat(v).toLocaleString() : '—'}</span>
    },
    {
      key: 'follow_up_date', label: 'Follow Up',
      render: v => {
        if (!v) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        const d = new Date(v); const today = new Date();
        const overdue = d < today;
        return <span style={{ color: overdue ? 'var(--red)' : 'var(--text-secondary)', fontWeight: overdue ? 600 : 400 }}>
          {overdue ? '⚠ ' : ''}{d.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        </span>;
      }
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Leads</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>Track and manage your sales pipeline</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Lead</button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Leads', value: rows.length, color: 'var(--accent-blue)' },
          { label: 'Pipeline Value', value: '$' + (totalValue / 1000).toFixed(0) + 'k', color: 'var(--green)' },
          { label: 'Hot (Proposal/Neg)', value: hotCount, color: 'var(--amber)' },
          { label: 'Won This Quarter', value: wonCount, color: 'var(--accent-cyan)' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {['all', ...STATUS_OPTS.map(s => s.value)].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}>
            {f === 'all' ? `All (${rows.length})` : STATUS_OPTS.find(s => s.value === f)?.label}
            {f !== 'all' && ` (${rows.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <AdminTable key={filter} columns={columns} rows={filtered} loading={loading} onEdit={openEdit} onDelete={del} pageSize={10} />
      </div>

      {modal && (
        <AdminModal title={modal === 'edit' ? 'Edit Lead' : 'Add New Lead'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Row>
            <Field label="Company Name" required><Input value={form.company_name} onChange={set('company_name')} placeholder="e.g. Tesla" /></Field>
            <Field label="Contact Name"><Input value={form.contact_name} onChange={set('contact_name')} placeholder="e.g. John Smith" /></Field>
          </Row>
          <Row>
            <Field label="Email"><Input type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="john@company.com" /></Field>
            <Field label="Phone"><Input value={form.contact_phone} onChange={set('contact_phone')} placeholder="+1 555 000 0000" /></Field>
          </Row>
          <Row>
            <Field label="Status"><Select value={form.status} onChange={set('status')} options={STATUS_OPTS} /></Field>
            <Field label="Source"><Select value={form.source} onChange={set('source')} options={SOURCE_OPTS} /></Field>
          </Row>
          <Row>
            <Field label="Estimated Value ($)"><Input type="number" value={form.estimated_value} onChange={set('estimated_value')} placeholder="250000" /></Field>
            <Field label="Follow-up Date"><Input type="date" value={form.follow_up_date} onChange={set('follow_up_date')} /></Field>
          </Row>
          <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} placeholder="Key details about this lead…" rows={2} /></Field>
        </AdminModal>
      )}
    </div>
  );
}
