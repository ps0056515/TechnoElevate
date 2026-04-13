import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';
import AdminModal from './admin/AdminModal.jsx';
import { Field, Input, Select, Row } from './admin/FormField.jsx';

const STATUS_OPTS = [
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];
const statusColors = { pending: 'var(--text-muted)', sent: 'var(--accent-blue)', paid: 'var(--green)', overdue: 'var(--red)' };
const fmt = (v) => '$' + parseFloat(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const EMPTY = { contract_id: '', client: '', amount: '', issued_date: '', due_date: '', paid_date: '', status: 'pending', notes: '' };

export default function InvoicesPanel() {
  const [invoices, setInvoices] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/api/admin/invoices').then(r => r.json()),
      apiFetch('/api/admin/contracts').then(r => r.json()),
    ]).then(([inv, con]) => { setInvoices(Array.isArray(inv) ? inv : []); setContracts(Array.isArray(con) ? con : []); setLoading(false); });
  };
  useEffect(load, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (row) => {
    setForm({ ...row, issued_date: row.issued_date?.split('T')[0] || '', due_date: row.due_date?.split('T')[0] || '', paid_date: row.paid_date?.split('T')[0] || '' });
    setModal('edit');
  };

  const save = async () => {
    if (!form.client.trim() || !form.amount) return alert('Client and amount are required');
    setSaving(true);
    const url = modal === 'edit' ? `/api/admin/invoices/${form.id}` : '/api/admin/invoices';
    await apiFetch(url, { method: modal === 'edit' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false); setModal(null); load();
  };

  const del = async (id) => {
    if (!confirm('Delete this invoice?')) return;
    await apiFetch(`/api/admin/invoices/${id}`, { method: 'DELETE' });
    load();
  };

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const totalPending = invoices.filter(i => ['pending', 'sent'].includes(i.status)).reduce((s, i) => s + parseFloat(i.amount || 0), 0);

  return (
    <div>
      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Collected', value: fmt(totalPaid), color: 'var(--green)', bg: 'var(--green-dim)' },
          { label: 'Outstanding', value: fmt(totalPending), color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
          { label: 'Overdue', value: fmt(totalOverdue), color: 'var(--red)', bg: 'var(--red-dim)' },
        ].map(p => (
          <div key={p.label} style={{ flex: 1, background: p.bg, border: `1px solid ${p.color}33`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: p.color, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{p.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: p.color }}>{p.value}</div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={openAdd}>+ New Invoice</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {['all', 'pending', 'sent', 'paid', 'overdue'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoice table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card2)' }}>
              {['Invoice #', 'Client', 'SOW', 'Amount', 'Issued', 'Due', 'Paid On', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No invoices found.</td></tr>
            ) : filtered.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--accent-blue)' }}>{inv.invoice_number}</td>
                <td style={{ padding: '10px 14px' }}>{inv.client}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{inv.sow_id || '—'}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--green)' }}>{fmt(inv.amount)}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{inv.issued_date ? new Date(inv.issued_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                <td style={{ padding: '10px 14px', color: inv.status === 'overdue' ? 'var(--red)' : 'var(--text-muted)' }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                <td style={{ padding: '10px 14px', color: 'var(--green)' }}>{inv.paid_date ? new Date(inv.paid_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontWeight: 700, color: statusColors[inv.status], textTransform: 'capitalize' }}>{inv.status}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(inv)} className="btn btn-ghost btn-sm" style={{ padding: '3px 9px' }}>Edit</button>
                    <button onClick={() => del(inv.id)} className="btn btn-sm" style={{ padding: '3px 9px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <AdminModal title={modal === 'edit' ? 'Edit Invoice' : 'New Invoice'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          {modal === 'edit' && (
            <div style={{ marginBottom: 14, padding: '7px 12px', background: 'var(--bg-hover)', borderRadius: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice — </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)' }}>{form.invoice_number}</span>
            </div>
          )}
          <Row>
            <Field label="Client" required><Input value={form.client} onChange={set('client')} placeholder="e.g. Tesla" /></Field>
            <Field label="Amount ($)" required><Input type="number" value={form.amount} onChange={set('amount')} placeholder="e.g. 16000" /></Field>
          </Row>
          <Field label="Link to Contract (optional)">
            <select value={form.contract_id || ''} onChange={e => set('contract_id')(e.target.value || null)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border-light)', background: 'var(--bg-input, var(--bg-card2))', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font)' }}>
              <option value="">— None —</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.sow_id} · {c.client}</option>)}
            </select>
          </Field>
          <Row>
            <Field label="Issued Date"><Input type="date" value={form.issued_date} onChange={set('issued_date')} /></Field>
            <Field label="Due Date"><Input type="date" value={form.due_date} onChange={set('due_date')} /></Field>
          </Row>
          <Row>
            <Field label="Status"><Select value={form.status} onChange={set('status')} options={STATUS_OPTS} /></Field>
            <Field label="Paid On (if paid)"><Input type="date" value={form.paid_date || ''} onChange={set('paid_date')} /></Field>
          </Row>
          <Field label="Notes"><Input value={form.notes || ''} onChange={set('notes')} placeholder="Optional notes…" /></Field>
        </AdminModal>
      )}
    </div>
  );
}
