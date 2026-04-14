import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';
import ExportButton from './ExportButton.jsx';
import SendReportModal from './SendReportModal.jsx';

const fmt = (v, unit) => {
  if (unit === 'USD') return '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v);
  if (unit === '%') return v + '%';
  if (unit === 'days') return v + 'd';
  return v;
};

export default function HealthMetrics() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);

  useEffect(() => {
    apiFetch('/api/health')
      .then(r => r && r.json ? r.json() : [])
      .then(d => { setMetrics(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setMetrics([]); setLoading(false); });
  }, []);

  const key = (k) => metrics.find(m => m.metric_key === k);

  if (loading) return (
    <div className="card" style={{ display: 'flex', gap: 12 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="shimmer" style={{ flex: 1, height: 72, borderRadius: 8 }} />
      ))}
    </div>
  );

  const cards = [
    { key: 'win_rate', label: 'Win Rate', color: 'var(--green)', trend: '↑', trendColor: 'var(--green)' },
    { key: 'avg_time_to_submit', label: 'Avg Time-to-Submit', color: 'var(--accent-blue)', trend: '↓', trendColor: 'var(--green)' },
    { key: 'revenue_at_risk', label: 'Revenue at Risk', color: 'var(--red)', trend: '↑', trendColor: 'var(--red)' },
    { key: 'bench_cost', label: 'Bench Cost / Mo', color: 'var(--amber)', trend: '↑', trendColor: 'var(--amber)' },
    { key: 'deployed_talent', label: 'Deployed Talent', color: 'var(--accent-cyan)', trend: '↑', trendColor: 'var(--green)' },
    { key: 'active_reqs', label: 'Active Requirements', color: 'var(--purple)', trend: '↑', trendColor: 'var(--green)' },
    { key: 'active_contracts', label: 'Active Contracts', color: 'var(--accent-blue)', trend: '—', trendColor: 'var(--text-muted)' },
    { key: 'avg_utilization', label: 'Avg Utilization', color: 'var(--green)', trend: '↓', trendColor: 'var(--amber)' },
  ];

  const reportData = {
    title: 'Health Metrics Report',
    sections: [{
      heading: 'KPI Metrics',
      rows: metrics.map(m => ({ Metric: m.metric_label, Value: fmt(m.metric_value, m.metric_unit), Unit: m.metric_unit, Trend: m.trend })),
    }],
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
        <ExportButton data={reportData} filename="health-metrics-report" />
        <button className="btn btn-secondary" onClick={() => setShowSend(true)} style={{ fontSize: 12 }}>📧 Send</button>
      </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map(c => {
        const m = key(c.key);
        if (!m) return null;
        return (
          <div key={c.key} className="card" style={{ padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: c.color, borderRadius: '10px 0 0 10px' }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>{m.metric_label.toUpperCase()}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{fmt(m.metric_value, m.metric_unit)}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: c.trendColor }}>{c.trend}</span>
            </div>
          </div>
        );
      })}
    </div>
      {showSend && (
        <SendReportModal reportType="Health Metrics" data={reportData} onClose={() => setShowSend(false)} />
      )}
    </div>
  );
}
