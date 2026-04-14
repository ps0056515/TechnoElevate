import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';
import { calcMargin, marginColor } from '../utils/marginUtils.js';

const fmt = (v) => '$' + parseFloat(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const stageColors = {
  intake: 'var(--text-muted)', sourcing: 'var(--purple)', submission: 'var(--accent-blue)',
  screening: 'var(--amber)', interviewing: 'var(--accent-cyan)', closure: 'var(--green)',
  green: 'var(--green)', at_risk: 'var(--amber)', blocked: 'var(--red)', completed: 'var(--accent-blue)',
  active: 'var(--green)', expiring_soon: 'var(--amber)', expired: 'var(--red)',
};

function Section({ title, count, color, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</span>
        <span style={{ fontSize: 11, background: `${color}22`, color, padding: '1px 8px', borderRadius: 12, fontWeight: 700 }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

export default function Client360Page() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/api/clients').then(r => r && r.json ? r.json() : []).then(d => {
      const list = Array.isArray(d) ? d : [];
      setClients(list);
      if (list.length) setSelected(list[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true); setData(null);
    apiFetch(`/api/client360/${encodeURIComponent(selected)}`).then(r => r && r.json ? r.json() : null).then(d => { setData(d && !d.error ? d : null); setLoading(false); }).catch(() => setLoading(false));
  }, [selected]);

  return (
    <div>
      {/* Client selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Client 360°</div>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, minWidth: 220 }}>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {loading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>}
      </div>

      {data && (
        <>
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Leads', value: data.summary.total_leads, color: 'var(--accent-blue)' },
              { label: 'Open Reqs', value: data.summary.open_reqs, color: 'var(--purple)' },
              { label: 'Active Projects', value: data.summary.active_projects, color: 'var(--amber)' },
              { label: 'Live Engagements', value: data.summary.active_engagements, color: 'var(--accent-cyan)' },
              { label: 'Active Revenue', value: fmt(data.summary.active_revenue), color: 'var(--green)' },
            ].map(k => (
              <div key={k.label} className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* LEFT COLUMN */}
            <div>
              {/* Leads */}
              <Section title="Leads" count={data.leads.length} color="var(--accent-blue)">
                {data.leads.length === 0 ? <Empty /> : data.leads.map(l => (
                  <Row key={l.id}>
                    <span style={{ fontWeight: 600 }}>{l.company_name}</span>
                    <span style={{ color: stageColors[l.status] || 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>{l.status?.replace('_', ' ')}</span>
                    <span style={{ color: 'var(--green)' }}>{fmt(l.estimated_value)}</span>
                  </Row>
                ))}
              </Section>

              {/* Requirements */}
              <Section title="Requirements" count={data.requirements.length} color="var(--purple)">
                {data.requirements.length === 0 ? <Empty /> : data.requirements.map(r => {
                  const pct = r.margin_pct != null ? parseFloat(r.margin_pct) : null;
                  return (
                    <Row key={r.id}>
                      <span style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: 10 }}>{r.req_id}</span>
                      <span style={{ flex: 1 }}>{r.title}</span>
                      <span style={{ color: stageColors[r.stage], fontWeight: 600, textTransform: 'capitalize', fontSize: 10 }}>{r.stage}</span>
                      {pct != null && <span style={{ fontWeight: 700, color: marginColor(pct), fontSize: 11 }}>{pct}%</span>}
                    </Row>
                  );
                })}
              </Section>

              {/* Contracts */}
              <Section title="Contracts" count={data.contracts.length} color="var(--green)">
                {data.contracts.length === 0 ? <Empty /> : data.contracts.map(c => (
                  <Row key={c.id}>
                    <span style={{ fontWeight: 700 }}>{c.sow_id}</span>
                    <span style={{ color: stageColors[c.status], fontWeight: 600, textTransform: 'capitalize' }}>{c.status?.replace('_', ' ')}</span>
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(c.value)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{fmtDate(c.end_date)}</span>
                  </Row>
                ))}
              </Section>
            </div>

            {/* RIGHT COLUMN */}
            <div>
              {/* Projects */}
              <Section title="Projects" count={data.projects.length} color="var(--amber)">
                {data.projects.length === 0 ? <Empty /> : data.projects.map(p => (
                  <Row key={p.id}>
                    <span style={{ fontWeight: 600, flex: 1 }}>{p.name}</span>
                    <span style={{ color: stageColors[p.stage], fontWeight: 600, textTransform: 'capitalize', fontSize: 10 }}>{p.stage?.replace('_', ' ')}</span>
                    {p.phase && <span style={{ color: 'var(--accent-blue)', fontSize: 10, textTransform: 'capitalize' }}>{p.phase?.replace('_', ' ')}</span>}
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{p.utilization_pct}% util</span>
                  </Row>
                ))}
              </Section>

              {/* Engagements */}
              <Section title="Engagements" count={data.engagements.length} color="var(--accent-cyan)">
                {data.engagements.length === 0 ? <Empty /> : data.engagements.map(e => (
                  <Row key={e.id}>
                    <span style={{ fontWeight: 600 }}>👤 {e.talent_name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{e.role}</span>
                    <span style={{ color: e.status === 'active' ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>{e.status}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{fmtDate(e.start_date)}</span>
                  </Row>
                ))}
              </Section>
            </div>
          </div>
        </>
      )}

      {!data && !loading && selected && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Select a client to view 360° data.</div>
      )}
    </div>
  );
}

function Row({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--bg-card2)', borderRadius: 6, marginBottom: 5, flexWrap: 'wrap' }}>
      {children}
    </div>
  );
}
function Empty() {
  return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No records found.</div>;
}
