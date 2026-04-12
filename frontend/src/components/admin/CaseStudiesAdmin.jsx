import React, { useEffect, useState } from 'react';
import AdminModal from './AdminModal.jsx';
import AdminTable from './AdminTable.jsx';
import { Field, Input, Select, Textarea, Row } from './FormField.jsx';
import { apiFetch } from '../../api.js';

const INDUSTRIES = ['FinTech', 'HealthTech', 'Retail', 'Manufacturing', 'Technology', 'BFSI', 'Telecom', 'Other'];

const EMPTY = {
  project_id: '',
  title: '',
  client: '',
  industry: '',
  sector: '',
  challenge: '',
  solution: '',
  results: '',
  metrics: '',
  tags: '',
  published: false,
};

function metricsToString(metrics) {
  if (!metrics || typeof metrics !== 'object') return '';
  return Object.entries(metrics).map(([k, v]) => `${k}: ${v}`).join('\n');
}

function stringToMetrics(str) {
  if (!str?.trim()) return {};
  return Object.fromEntries(
    str.split('\n')
      .map(line => line.split(':').map(s => s.trim()))
      .filter(parts => parts.length >= 2)
      .map(([k, ...rest]) => [k, rest.join(':').trim()])
  );
}

export default function CaseStudiesAdmin() {
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/api/admin/case-studies').then(r => r.json()),
      apiFetch('/api/admin/projects').then(r => r.json()),
    ]).then(([cs, proj]) => {
      setRows(cs);
      setProjects(proj);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => {
    setForm(EMPTY);
    setModal('add');
  };

  const openEdit = (row) => {
    setForm({
      ...row,
      metrics: metricsToString(row.metrics),
      tags: Array.isArray(row.tags) ? row.tags.join(', ') : (row.tags || ''),
    });
    setModal('edit');
  };

  const save = async () => {
    if (!form.title.trim()) return alert('Title is required');
    setSaving(true);
    const payload = {
      ...form,
      metrics: stringToMetrics(form.metrics),
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      project_id: form.project_id || null,
      published: form.published === true || form.published === 'true',
    };
    const url = modal === 'edit' ? `/api/admin/case-studies/${form.id}` : '/api/admin/case-studies';
    await apiFetch(url, {
      method: modal === 'edit' ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setModal(null);
    load();
  };

  const del = async (id) => {
    if (!window.confirm('Delete this case study?')) return;
    await apiFetch(`/api/admin/case-studies/${id}`, { method: 'DELETE' });
    load();
  };

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'client', label: 'Client' },
    {
      key: 'industry', label: 'Industry',
      render: v => v ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--accent-blue)', color: '#fff' }}>{v}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>
    },
    { key: 'sector', label: 'Sector', render: v => v || <span style={{ color: 'var(--text-muted)' }}>—</span> },
    {
      key: 'published', label: 'Status',
      render: v => v
        ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Published</span>
        : <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Draft</span>
    },
    {
      key: 'ai_generated', label: 'Source',
      render: v => v ? <span style={{ fontSize: 11, color: 'var(--accent-blue)' }}>✨ AI Generated</span> : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manual</span>
    },
  ];

  const projectOptions = [
    { value: '', label: 'No linked project' },
    ...projects.map(p => ({ value: String(p.id), label: `${p.name} — ${p.client}` })),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Case Study</button>
      </div>
      <AdminTable columns={columns} rows={rows} loading={loading} onEdit={openEdit} onDelete={del} />

      {modal && (
        <AdminModal
          title={modal === 'edit' ? 'Edit Case Study' : 'Add Case Study'}
          onClose={() => setModal(null)}
          onSave={save}
          saving={saving}
        >
          <Field label="Title" required>
            <Input value={form.title} onChange={set('title')} placeholder="e.g. How Cloud Migration reduced costs by 40%…" />
          </Field>
          <Row>
            <Field label="Client">
              <Input value={form.client || ''} onChange={set('client')} placeholder="e.g. Tesla (or anonymised)" />
            </Field>
            <Field label="Linked Project">
              <Select value={String(form.project_id || '')} onChange={set('project_id')} options={projectOptions} />
            </Field>
          </Row>
          <Row>
            <Field label="Industry">
              <Select
                value={form.industry || ''}
                onChange={set('industry')}
                options={[{ value: '', label: 'Select…' }, ...INDUSTRIES.map(i => ({ value: i, label: i }))]}
              />
            </Field>
            <Field label="Sector">
              <Input value={form.sector || ''} onChange={set('sector')} placeholder="e.g. Payments, EMR" />
            </Field>
          </Row>
          <Field label="Challenge">
            <Textarea value={form.challenge || ''} onChange={set('challenge')} rows={3} placeholder="The business problem the client faced…" />
          </Field>
          <Field label="Solution">
            <Textarea value={form.solution || ''} onChange={set('solution')} rows={3} placeholder="What TechnoElevate delivered and how…" />
          </Field>
          <Field label="Results">
            <Textarea value={form.results || ''} onChange={set('results')} rows={2} placeholder="Outcomes and value delivered…" />
          </Field>
          <Field label="Metrics (one per line: key: value)" style={{ fontSize: 12 }}>
            <Textarea
              value={form.metrics || ''}
              onChange={set('metrics')}
              rows={4}
              placeholder={'cost_reduction: 40%\ntime_to_live: 12 weeks\nteam_size: 6 engineers'}
            />
          </Field>
          <Field label="Tags (comma-separated)">
            <Input value={form.tags || ''} onChange={set('tags')} placeholder="AWS, React, Microservices, DevOps" />
          </Field>
          <Field label="Status">
            <Select
              value={form.published ? 'true' : 'false'}
              onChange={v => set('published')(v === 'true')}
              options={[{ value: 'false', label: 'Draft' }, { value: 'true', label: 'Published' }]}
            />
          </Field>
        </AdminModal>
      )}
    </div>
  );
}
