import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiFetch } from '../api.js';

const STAGES = [
  { key: 'bench', label: 'Available on Bench', color: 'var(--text-secondary)', numColor: '#8b91c4' },
  { key: 'in_process', label: 'In Process', color: 'var(--amber)', numColor: '#ffa502' },
  { key: 'interviewing', label: 'Inter-viewing', color: 'var(--accent-blue)', numColor: '#4f7cff' },
  { key: 'offered', label: 'Offered', color: 'var(--green)', numColor: '#2ed573' },
  { key: 'deployed', label: 'Deployed', color: 'var(--accent-cyan)', numColor: '#00d4ff' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ color: 'var(--accent-blue)' }}>{payload[0].value} idle hours</div>
      </div>
    );
  }
  return null;
};

export default function TalentLifecycle() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState(null);

  useEffect(() => {
    apiFetch('/api/talent/lifecycle')
      .then(r => r && r.json ? r.json() : null)
      .then(d => { setData(d && !d.error ? d : null); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, []);

  const getCount = (key) => {
    if (!data) return 0;
    const found = data.counts.find(c => c.status === key);
    return found ? parseInt(found.count) : 0;
  };

  const filteredTalents = selectedStage && data
    ? data.talents.filter(t => t.status === selectedStage)
    : [];

  if (loading) return (
    <div className="card">
      <div className="loading"><div className="spinner" /> Loading talent data…</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Lifecycle flow */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="section-header">
          <span className="section-title">Talent Lifecycle</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click stage to drill down</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {STAGES.map((stage, idx) => (
            <React.Fragment key={stage.key}>
              <div
                onClick={() => setSelectedStage(selectedStage === stage.key ? null : stage.key)}
                style={{
                  flex: 1, textAlign: 'center', cursor: 'pointer',
                  padding: '12px 8px',
                  background: selectedStage === stage.key ? 'var(--bg-hover)' : 'transparent',
                  borderRadius: 8, border: selectedStage === stage.key ? `1px solid ${stage.numColor}` : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: stage.numColor, lineHeight: 1.1 }}>
                  {getCount(stage.key)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3, fontWeight: 500 }}>
                  {stage.label}
                </div>
              </div>
              {idx < STAGES.length - 1 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 18, padding: '0 4px', flexShrink: 0 }}>→</div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Drill-down */}
        {selectedStage && filteredTalents.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
              {STAGES.find(s => s.key === selectedStage)?.label} — {filteredTalents.length} resources
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {filteredTalents.map(t => (
                <div key={t.id} style={{
                  background: 'var(--bg-card2)', border: '1px solid var(--border)',
                  borderRadius: 7, padding: '8px 10px',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t.role}</div>
                  {t.idle_hours > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 3 }}>⏱ {t.idle_hours}h idle</div>
                  )}
                  {t.current_client && (
                    <div style={{ fontSize: 10, color: 'var(--accent-blue)', marginTop: 3 }}>◉ {t.current_client}</div>
                  )}
                  {t.skills && t.skills.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {t.skills.slice(0, 3).map(s => (
                        <span key={s} className="tag tag-blue" style={{ fontSize: 10 }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bench idle chart */}
      <div className="card">
        <div className="section-header">
          <span className="section-title">Bench Idle Time (Hours) — Last 4 Weeks</span>
          <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>
            ↑ {data?.benchIdle?.[3]?.total_hours - data?.benchIdle?.[0]?.total_hours}h increase
          </span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data?.benchIdle || []} barSize={40}>
            <XAxis dataKey="week_label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="total_hours" radius={[4, 4, 0, 0]}>
              {(data?.benchIdle || []).map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === (data?.benchIdle?.length - 1) ? 'var(--accent-blue)' : 'var(--accent-blue-dim)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
          {(data?.benchIdle || []).map((w, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: i === (data?.benchIdle?.length - 1) ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                {w.total_hours}h
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
