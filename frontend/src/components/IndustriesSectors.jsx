import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiFetch } from '../api.js';
import ExportButton from './ExportButton.jsx';
import SendReportModal from './SendReportModal.jsx';

const INDUSTRY_COLORS = [
  'var(--accent-blue)', '#a55eea', 'var(--green)', 'var(--amber)',
  '#ff6b6b', '#20c997', '#fd7e14', '#6f42c1',
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</p>
      <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>{payload[0].value} projects</p>
    </div>
  );
};

export default function IndustriesSectors() {
  const [data, setData] = useState({ byIndustry: [], bySector: [], byGeo: [] });
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [showSend, setShowSend] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/industries').then(r => r.json()),
      apiFetch('/api/projects').then(r => r.json()),
    ]).then(([ind, proj]) => {
      setData(ind);
      setProjects(proj);
      setLoading(false);
    });
  }, []);

  const filteredProjects = selectedIndustry
    ? projects.filter(p => p.industry === selectedIndustry)
    : projects;

  const sectorsForSelected = selectedIndustry
    ? data.bySector.filter(s => s.industry === selectedIndustry)
    : data.bySector;

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading industries data…</div>;

  const reportData = {
    title: 'Industries & Sectors Report',
    sections: [
      { heading: 'Industry Breakdown', rows: data.byIndustry.map(i => ({ Industry: i.industry, Projects: i.project_count, 'Total Team': i.total_team })) },
      { heading: 'Sector Breakdown', rows: data.bySector.map(s => ({ Industry: s.industry, Sector: s.sector, Projects: s.project_count })) },
    ],
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Industries & Sectors</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {data.byIndustry.length} industries · {projects.length} projects · {data.byGeo.length} regions
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton data={reportData} filename="industries-sectors-report" />
          <button className="btn btn-secondary" onClick={() => setShowSend(true)} style={{ fontSize: 13 }}>📧 Send Report</button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          onClick={() => setSelectedIndustry(null)}
          style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: !selectedIndustry ? 'var(--accent-blue)' : 'var(--bg-card)',
            color: !selectedIndustry ? '#fff' : 'var(--text-secondary)',
          }}
        >All Industries</button>
        {data.byIndustry.map((ind, i) => (
          <button
            key={ind.industry}
            onClick={() => setSelectedIndustry(selectedIndustry === ind.industry ? null : ind.industry)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: selectedIndustry === ind.industry ? INDUSTRY_COLORS[i % INDUSTRY_COLORS.length] : 'var(--bg-card)',
              color: selectedIndustry === ind.industry ? '#fff' : 'var(--text-secondary)',
            }}
          >{ind.industry} ({ind.project_count})</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Bar chart */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>PROJECTS BY INDUSTRY</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byIndustry} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis type="category" dataKey="industry" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="project_count" radius={[0, 4, 4, 0]}>
                {data.byIndustry.map((_, i) => (
                  <Cell key={i} fill={INDUSTRY_COLORS[i % INDUSTRY_COLORS.length]} opacity={selectedIndustry && data.byIndustry[i].industry !== selectedIndustry ? 0.3 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sector breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {selectedIndustry ? `SECTORS — ${selectedIndustry.toUpperCase()}` : 'SECTOR BREAKDOWN'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto' }}>
            {sectorsForSelected.map((s, i) => (
              <div key={`${s.industry}-${s.sector}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.sector}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.project_count} projects</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round((s.project_count / Math.max(...sectorsForSelected.map(x => Number(x.project_count)))) * 100)}%`,
                      background: INDUSTRY_COLORS[i % INDUSTRY_COLORS.length],
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Geography */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>GEOGRAPHIC SPREAD</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {data.byGeo.map((g, i) => (
            <div key={g.geography} style={{
              padding: '8px 16px', borderRadius: 8, background: 'var(--bg-hover)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[i % INDUSTRY_COLORS.length], display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{g.geography}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.project_count} projects</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filtered project cards */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {selectedIndustry ? `PROJECTS — ${selectedIndustry.toUpperCase()}` : 'ALL PROJECTS'} ({filteredProjects.length})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filteredProjects.map(p => (
            <div key={p.id} style={{ padding: 14, borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{p.client}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {p.industry && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--accent-blue)', color: '#fff' }}>{p.industry}</span>}
                {p.sector && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{p.sector}</span>}
                {p.geography && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>📍 {p.geography}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showSend && (
        <SendReportModal
          reportType="Industries & Sectors"
          data={reportData}
          onClose={() => setShowSend(false)}
        />
      )}
    </div>
  );
}
