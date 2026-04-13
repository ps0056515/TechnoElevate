import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

const fmt = (v) => '$' + Math.round(v).toLocaleString('en-US');
const fmtK = (v) => {
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
  return fmt(v);
};

export default function ForecastPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/forecast').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="card"><div className="loading"><div className="spinner" /> Loading forecast…</div></div>;
  if (!data || data.error) return null;

  const activeRevenue = parseFloat(data.active_revenue) || 0;
  const benchCost = parseFloat(data.bench_cost_monthly) || 0;
  const deployedCost = parseFloat(data.deployed_cost_monthly) || 0;
  const pipe30 = parseFloat(data.pipeline_30d) || 0;
  const pipe60 = parseFloat(data.pipeline_60d) || 0;
  const pipe90 = parseFloat(data.pipeline_90d) || 0;
  const expiringContracts = Array.isArray(data.expiring_contracts) ? data.expiring_contracts : [];

  const monthlyRevenue = activeRevenue / 12;
  const grossMargin = monthlyRevenue - deployedCost;
  const grossMarginPct = monthlyRevenue > 0 ? Math.round((grossMargin / monthlyRevenue) * 100) : 0;
  const marginColor = grossMarginPct >= 40 ? 'var(--green)' : grossMarginPct >= 20 ? 'var(--amber)' : 'var(--red)';

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <span className="section-title">Revenue Forecast & P&L</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Based on active contracts + pipeline</span>
      </div>

      {/* Top KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Annual Contract Revenue', value: fmtK(activeRevenue), color: 'var(--green)', sub: 'from active SOWs' },
          { label: 'Monthly Run Rate', value: fmtK(monthlyRevenue), color: 'var(--accent-blue)', sub: 'revenue / 12' },
          { label: 'Bench Cost / Month', value: fmtK(benchCost), color: 'var(--red)', sub: 'idle engineers' },
          { label: 'Gross Margin / Month', value: fmtK(grossMargin), color: marginColor, sub: `${grossMarginPct}% margin` },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'var(--bg-card2)', border: `1px solid ${kpi.color}33`, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Pipeline forecast */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Pipeline Forecast (bill rate × months)</div>
          {[
            { label: '30-Day (Closure stage)', value: pipe30, color: 'var(--green)' },
            { label: '60-Day (+ Interviewing)', value: pipe60, color: 'var(--amber)' },
            { label: '90-Day (+ Screening)', value: pipe90, color: 'var(--accent-blue)' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: '0 0 170px', fontSize: 11, color: 'var(--text-muted)' }}>{row.label}</div>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-hover)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${Math.min((row.value / (pipe90 || 1)) * 100, 100)}%`, background: row.color, borderRadius: 3 }} />
              </div>
              <div style={{ flex: '0 0 70px', textAlign: 'right', fontWeight: 700, color: row.color, fontSize: 12 }}>{fmtK(row.value)}</div>
            </div>
          ))}
        </div>

        {/* Expiring contracts */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Contracts Expiring (90 days)</div>
          {expiringContracts.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>No contracts expiring in 90 days.</div>
            : expiringContracts.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', background: 'var(--bg-card2)', borderRadius: 6, border: '1px solid rgba(255,165,2,0.2)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>{c.sow_id}</span>
                <span style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)' }}>{c.client}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>{c.days_left}d left</span>
                <span style={{ fontSize: 11, color: 'var(--green)' }}>{fmtK(c.value)}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
