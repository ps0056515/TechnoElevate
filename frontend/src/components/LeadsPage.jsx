import React, { useEffect, useState } from 'react';
import AdminModal from './admin/AdminModal.jsx';
import AdminTable from './admin/AdminTable.jsx';
import { Field, Input, Select, Textarea, Row } from './admin/FormField.jsx';
import { apiFetch } from '../api.js';
import { calcMargin, marginColor } from '../utils/marginUtils.js';

const EMPTY = {
  company_name: '', contact_name: '', contact_email: '', contact_phone: '',
  source: '', status: 'new', estimated_value: '', notes: '', follow_up_date: '',
};
const REQ_EMPTY = { title: '', role_type: '', priority: 'HIGH', bill_rate: '', pay_rate: '' };

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
const PRIORITIES = ['HIGH', 'MED', 'LOW'];
const ROLE_TYPES = ['Frontend', 'Backend', 'Full Stack', 'DevOps', 'Cloud', 'Data', 'AI/ML', 'Mobile', 'QA', 'Security', 'PM', 'BA', 'Design', 'Architecture', 'Other'];

const statusColors = {
  new: 'var(--text-muted)', contacted: 'var(--accent-blue)', qualified: 'var(--purple)',
  proposal_sent: 'var(--amber)', negotiation: 'var(--accent-cyan)', won: 'var(--green)', lost: 'var(--red)',
};

const stageColors = {
  intake: 'var(--text-muted)', sourcing: 'var(--purple)', submission: 'var(--accent-blue)',
  screening: 'var(--amber)', interviewing: 'var(--accent-cyan)', closure: 'var(--green)',
};

export default function LeadsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);       // 'add' | 'edit' | 'convert' | 'view_reqs'
  const [form, setForm] = useState(EMPTY);
  const [reqForm, setReqForm] = useState(REQ_EMPTY);
  const [activeLead, setActiveLead] = useState(null);
  const [linkedReqs, setLinkedReqs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [reqCounts, setReqCounts] = useState({});
  const [proposalModal, setProposalModal] = useState(null);  // lead row
  const [proposal, setProposal] = useState(null);
  const [proposalLoading, setProposalLoading] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch('/api/leads');
      const data = await res.json();
      setRows(data);
      // fetch req counts for all leads
      const allReqs = await apiFetch('/api/admin/requirements').then(r => r.json());
      const counts = {};
      allReqs.forEach(r => { if (r.lead_id) counts[r.lead_id] = (counts[r.lead_id] || 0) + 1; });
      setReqCounts(counts);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const setR = (k) => (v) => setReqForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (row) => { setForm({ ...row, follow_up_date: row.follow_up_date?.split('T')[0] || '' }); setModal('edit'); };

  const openConvert = (lead) => {
    setActiveLead(lead);
    setReqForm({ ...REQ_EMPTY });
    setModal('convert');
  };

  const openViewReqs = async (lead) => {
    setActiveLead(lead);
    setLinkedReqs([]);
    setModal('view_reqs');
    try {
      const data = await apiFetch(`/api/leads/${lead.id}/requirements`).then(r => r.json());
      setLinkedReqs(data);
    } catch (err) { console.error(err); }
  };

  const save = async () => {
    if (!form.company_name.trim()) return alert('Company name is required');
    setSaving(true);
    try {
      if (modal === 'edit') {
        await apiFetch(`/api/leads/${form.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await apiFetch('/api/leads', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      await load();
      setModal(null);
    } catch (err) {
      console.error('Save failed:', err);
    } finally { setSaving(false); }
  };

  const saveReq = async () => {
    if (!reqForm.title.trim()) return alert('Job title is required');
    setSaving(true);
    try {
      await apiFetch('/api/admin/requirements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reqForm.title,
          client: activeLead.company_name,
          stage: 'intake',
          priority: reqForm.priority,
          role_type: reqForm.role_type,
          bill_rate: reqForm.bill_rate || 0,
          pay_rate: reqForm.pay_rate || 0,
          lead_id: activeLead.id,
        }),
      });
      await load();
      setModal(null);
    } catch (err) {
      console.error('Convert failed:', err);
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    try {
      await apiFetch(`/api/leads/${id}`, { method: 'DELETE' });
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (err) { console.error('Delete failed:', err); }
  };

  const openProposal = async (lead) => {
    setProposalModal(lead);
    setProposal(null);
    setProposalLoading(true);
    try {
      const res = await apiFetch(`/api/leads/${lead.id}/draft-proposal`, { method: 'POST' });
      const data = await res.json();
      if (data.error) { alert('AI Error: ' + data.error); setProposalModal(null); }
      else setProposal(data);
    } catch { alert('Failed to generate proposal'); setProposalModal(null); }
    setProposalLoading(false);
  };

  const copyProposal = () => {
    if (!proposal) return;
    const text = [
      `PROPOSAL: ${proposal.title}`,
      `Company: ${proposal.company}`,
      '',
      'EXECUTIVE SUMMARY',
      proposal.executive_summary,
      '',
      'SCOPE OF WORK',
      ...(proposal.scope_of_work || []).map((s, i) => `${i + 1}. ${s}`),
      '',
      'TEAM COMPOSITION',
      ...(proposal.team_composition || []).map(t => `• ${t}`),
      '',
      `ENGAGEMENT MODEL: ${proposal.engagement_model}`,
      `TIMELINE: ${proposal.timeline}`,
      `ESTIMATED VALUE: ${proposal.estimated_value}`,
      '',
      'KEY TERMS',
      ...(proposal.terms || []).map(t => `• ${t}`),
      '',
      'NEXT STEPS',
      ...(proposal.next_steps || []).map((s, i) => `${i + 1}. ${s}`),
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => alert('Proposal copied to clipboard!'));
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
      render: v => <span style={{ color: 'var(--green)', fontWeight: 600 }}>{v ? '$' + parseFloat(v).toLocaleString('en-US') : '—'}</span>
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
    {
      key: 'id', label: 'Requirements',
      render: (v, row) => {
        const count = reqCounts[v] || 0;
        return (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {count > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); openViewReqs(row); }}
                style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)44', borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                {count} req{count > 1 ? 's' : ''}
              </button>
            )}
            {row.status === 'won' && (
              <button
                onClick={(e) => { e.stopPropagation(); openConvert(row); }}
                style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green)44', borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                + Req
              </button>
            )}
            {['qualified', 'proposal_sent', 'negotiation', 'won'].includes(row.status) && (
              <button
                onClick={(e) => { e.stopPropagation(); openProposal(row); }}
                style={{ background: 'linear-gradient(135deg, rgba(165,94,234,0.12), rgba(79,124,255,0.1))', color: 'var(--purple)', border: '1px solid rgba(165,94,234,0.35)', borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title="AI-draft a proposal/SOW for this lead"
              >
                🤖 Proposal
                <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--purple)', background: 'rgba(165,94,234,0.18)', border: '1px solid rgba(165,94,234,0.3)', borderRadius: 3, padding: '1px 4px', letterSpacing: 0.5 }}>AI</span>
              </button>
            )}
          </div>
        );
      }
    },
  ];

  const marginPct = calcMargin(reqForm.bill_rate, reqForm.pay_rate);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center' }}>
            Leads
            <AiBadge />
          </h2>
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

      {/* Add / Edit Lead modal */}
      {(modal === 'add' || modal === 'edit') && (
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

      {/* Convert Won Lead → Requirement modal */}
      {modal === 'convert' && activeLead && (
        <AdminModal
          title="Convert Lead to Requirement"
          onClose={() => setModal(null)}
          onSave={saveReq}
          saving={saving}
          saveLabel="Create Requirement"
        >
          {/* Lead context banner */}
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--green-dim)', borderRadius: 8, border: '1px solid var(--green)33' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>Won Lead</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{activeLead.company_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeLead.contact_name} · Est. ${parseFloat(activeLead.estimated_value || 0).toLocaleString('en-US')}</div>
          </div>

          {/* Req ID — auto-generated notice */}
          <div style={{ marginBottom: 14, padding: '7px 12px', background: 'var(--bg-hover)', borderRadius: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Req ID</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Auto-generated on save</span>
          </div>

          {/* Client pre-filled */}
          <Field label="Client">
            <div style={{ padding: '8px 10px', background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 7, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
              {activeLead.company_name}
            </div>
          </Field>

          <Field label="Job Title" required>
            <Input value={reqForm.title} onChange={setR('title')} placeholder="e.g. Senior React Developer" />
          </Field>
          <Row>
            <Field label="Role Type">
              <Select value={reqForm.role_type} onChange={setR('role_type')} options={ROLE_TYPES} />
            </Field>
            <Field label="Priority">
              <Select value={reqForm.priority} onChange={setR('priority')} options={PRIORITIES} />
            </Field>
          </Row>
          <Row>
            <Field label="Bill Rate / Mo ($)" hint="Monthly rate billed to client">
              <Input type="number" value={reqForm.bill_rate} onChange={setR('bill_rate')} placeholder="e.g. 16000" />
            </Field>
            <Field label="Pay Rate / Mo ($)" hint="Expected engineer cost">
              <Input type="number" value={reqForm.pay_rate} onChange={setR('pay_rate')} placeholder="e.g. 9500" />
            </Field>
          </Row>
          {parseFloat(reqForm.bill_rate) > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: `${marginColor(marginPct)}15`, border: `1px solid ${marginColor(marginPct)}40`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estimated Margin</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: marginColor(marginPct) }}>
                {marginPct}%
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 8, color: 'var(--text-muted)' }}>
                  (${(parseFloat(reqForm.bill_rate) - parseFloat(reqForm.pay_rate || 0)).toLocaleString('en-US')}/mo)
                </span>
              </span>
            </div>
          )}
        </AdminModal>
      )}

      {/* View linked requirements modal */}
      {modal === 'view_reqs' && activeLead && (
        <AdminModal
          title={`Requirements — ${activeLead.company_name}`}
          onClose={() => setModal(null)}
          onSave={null}
        >
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{linkedReqs.length} requirement{linkedReqs.length !== 1 ? 's' : ''} from this lead</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setModal(null); setTimeout(() => openConvert(activeLead), 50); }}
            >
              + Add Another Req
            </button>
          </div>
          {linkedReqs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {linkedReqs.map(r => {
                const pct = calcMargin(r.bill_rate, r.pay_rate);
                return (
                  <div key={r.id} style={{ padding: '10px 14px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '2px 7px', borderRadius: 4 }}>{r.req_id}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: stageColors[r.stage], textTransform: 'capitalize' }}>{r.stage}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{r.title}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                      <span className="tag tag-gray" style={{ fontSize: 10 }}>{r.role_type || 'Role TBD'}</span>
                      {parseFloat(r.bill_rate) > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: marginColor(pct) }}>{pct}% margin</span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {r.bill_rate > 0 ? `$${Number(r.bill_rate).toLocaleString('en-US')}/mo` : 'Rate TBD'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminModal>
      )}

      {/* ── AI Proposal Modal ──────────────────────────────────────────────── */}
      {proposalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 620, maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 22 }}>📋</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>AI Proposal Draft</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{proposalModal.company_name} · ${parseFloat(proposalModal.estimated_value || 0).toLocaleString('en-US')}</div>
              </div>
              <button onClick={() => { setProposalModal(null); setProposal(null); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
            </div>

            {proposalLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ marginBottom: 14 }} />
                Drafting proposal with GPT-4o…
              </div>
            )}

            {proposal && (
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--accent-blue)' }}>{proposal.title}</h3>

                <Section label="Executive Summary" content={proposal.executive_summary} />

                <ListSection label="Scope of Work" items={proposal.scope_of_work} numbered />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <InfoBox label="Engagement Model" value={proposal.engagement_model} />
                  <InfoBox label="Timeline" value={proposal.timeline} />
                  <InfoBox label="Estimated Value" value={proposal.estimated_value} color="var(--green)" />
                </div>

                <ListSection label="Team Composition" items={proposal.team_composition} />
                <ListSection label="Key Terms" items={proposal.terms} />
                <ListSection label="Next Steps" items={proposal.next_steps} numbered />

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={copyProposal}>📋 Copy to Clipboard</button>
                  <button className="btn btn-ghost" onClick={() => openProposal(proposalModal)}>🔄 Regenerate</button>
                  <button className="btn btn-ghost" onClick={() => { setProposalModal(null); setProposal(null); }}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers for proposal layout ────────────────────────────────────────────
function Section({ label, content }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg-card2)', borderRadius: 6, border: '1px solid var(--border)' }}>{content}</div>
    </div>
  );
}
function ListSection({ label, items, numbered }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 }}>{label}</div>
      <div style={{ padding: '10px 14px', background: 'var(--bg-card2)', borderRadius: 6, border: '1px solid var(--border)' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: i < items.length - 1 ? 6 : 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent-blue)', fontWeight: 700, minWidth: 16 }}>{numbered ? `${i + 1}.` : '•'}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function InfoBox({ label, value, color }) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--bg-card2)', borderRadius: 6, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--text-primary)' }}>{value}</div>
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
