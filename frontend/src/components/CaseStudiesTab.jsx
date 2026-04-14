import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';
import ExportButton from './ExportButton.jsx';
import SendReportModal from './SendReportModal.jsx';

const INDUSTRY_COLORS = {
  FinTech: '#4f7cff', HealthTech: '#20c997', Retail: '#fd7e14',
  Manufacturing: '#a55eea', Technology: '#6f42c1', BFSI: '#ff6b6b',
  Telecom: '#ffd43b', Other: 'var(--text-muted)',
};

function MetricPill({ label, value }) {
  return (
    <div style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label.replace(/_/g, ' ')}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function CaseStudyCard({ cs, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const metrics = typeof cs.metrics === 'object' ? cs.metrics : {};
  const metricEntries = Object.entries(metrics).slice(0, 4);
  const color = INDUSTRY_COLORS[cs.industry] || 'var(--accent-blue)';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: `1px solid var(--border)` }}>
      <div style={{ height: 4, background: color }} />
      <div style={{ padding: '18px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {cs.industry && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: color, color: '#fff', fontWeight: 600 }}>{cs.industry}</span>
              )}
              {cs.sector && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{cs.sector}</span>
              )}
              {cs.ai_generated && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'linear-gradient(135deg,#4f7cff,#a55eea)', color: '#fff' }}>✨ AI Generated</span>
              )}
              {!cs.published && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber)' }}>Draft</span>
              )}
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{cs.title}</h3>
            {cs.client && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{cs.client}</p>}
          </div>
          {onEdit && (
            <button onClick={() => onEdit(cs)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>Edit</button>
          )}
        </div>

        {/* Challenge */}
        {cs.challenge && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Challenge</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {expanded ? cs.challenge : cs.challenge.slice(0, 120) + (cs.challenge.length > 120 ? '…' : '')}
            </p>
          </div>
        )}

        {/* Metrics */}
        {metricEntries.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
            {metricEntries.map(([k, v]) => <MetricPill key={k} label={k} value={v} />)}
          </div>
        )}

        {/* Tags */}
        {cs.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
            {cs.tags.map(t => (
              <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{t}</span>
            ))}
          </div>
        )}

        {/* Expand / collapse */}
        {(cs.solution || cs.results) && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 600 }}
          >{expanded ? '↑ Show less' : '↓ Read more'}</button>
        )}

        {expanded && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cs.solution && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Solution</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{cs.solution}</p>
              </div>
            )}
            {cs.results && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Results</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{cs.results}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CaseStudiesTab({ showAdmin = false }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterIndustry, setFilterIndustry] = useState('All');
  const [filterStatus, setFilterStatus] = useState('published');
  const [showSend, setShowSend] = useState(false);

  const load = () => {
    const url = showAdmin ? '/api/admin/case-studies' : '/api/case-studies';
    apiFetch(url).then(r => r && r.json ? r.json() : []).then(d => { setCases(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => { setCases([]); setLoading(false); });
  };
  useEffect(load, [showAdmin]);

  const industries = ['All', ...Array.from(new Set(cases.map(c => c.industry).filter(Boolean)))];

  const visible = cases.filter(c => {
    const matchIndustry = filterIndustry === 'All' || c.industry === filterIndustry;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'published' ? c.published : !c.published);
    return matchIndustry && matchStatus;
  });

  const reportData = {
    title: 'Case Studies Report',
    sections: [{
      heading: 'Published Case Studies',
      rows: visible.map(c => ({ Title: c.title, Client: c.client, Industry: c.industry, Sector: c.sector, Published: c.published ? 'Yes' : 'Draft' })),
    }],
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading case studies…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Case Studies</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {cases.filter(c => c.published).length} published · {cases.filter(c => !c.published).length} drafts
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton data={reportData} filename="case-studies-report" />
          <button className="btn btn-secondary" onClick={() => setShowSend(true)} style={{ fontSize: 13 }}>📧 Send Report</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {industries.map(ind => (
            <button
              key={ind}
              onClick={() => setFilterIndustry(ind)}
              style={{
                padding: '5px 12px', borderRadius: 16, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filterIndustry === ind ? 'var(--accent-blue)' : 'var(--bg-card)',
                color: filterIndustry === ind ? '#fff' : 'var(--text-secondary)',
              }}
            >{ind}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {[['published', 'Published'], ['draft', 'Drafts'], ['all', 'All']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              style={{
                padding: '5px 12px', borderRadius: 16, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filterStatus === v ? 'var(--bg-hover)' : 'var(--bg-card)',
                color: filterStatus === v ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {visible.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No case studies found. Upload an RFP or SOW in the Documents tab to generate one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {visible.map(cs => <CaseStudyCard key={cs.id} cs={cs} onEdit={showAdmin ? () => {} : null} />)}
        </div>
      )}

      {showSend && (
        <SendReportModal reportType="Case Studies" data={reportData} onClose={() => setShowSend(false)} />
      )}
    </div>
  );
}
