import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

const STAGE_ICONS = ['📄', '🔍', '🤝', '🔑', '📞', '📊', '✅'];

export default function EngagementChecklist() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = () => {
    apiFetch('/api/engagements').then(r => r.json()).then(d => {
      setData(d);
      if (!selected && d.engagements?.length) setSelected(d.engagements[0].id);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const complete = async (itemId) => {
    await apiFetch(`/api/engagements/checklist/${itemId}/complete`, { method: 'PATCH' });
    load();
  };

  const getItems = (engId) => data?.checklistItems?.filter(i => i.engagement_id === engId) || [];
  const getProgress = (engId) => {
    const items = getItems(engId);
    if (!items.length) return 0;
    return Math.round((items.filter(i => i.completed).length / items.length) * 100);
  };

  if (loading) return (
    <div className="card"><div className="loading"><div className="spinner" /> Loading engagements…</div></div>
  );

  const selectedEng = data?.engagements?.find(e => e.id === selected);
  const selectedItems = selected ? getItems(selected) : [];

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="section-header">
        <span className="section-title">Engagement Compliance Checklist</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>7-stage deployment tracking</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* Engagement list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data?.engagements?.map(eng => {
            const prog = getProgress(eng.id);
            const items = getItems(eng.id);
            const overdueCount = items.filter(i => i.overdue).length;
            const isSelected = selected === eng.id;
            return (
              <div
                key={eng.id}
                onClick={() => setSelected(eng.id)}
                style={{
                  background: isSelected ? 'var(--bg-hover)' : 'var(--bg-card2)',
                  border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{eng.talent_name}</div>
                  {overdueCount > 0 && (
                    <span className="badge badge-red">{overdueCount} overdue</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {eng.client} · {eng.role}
                </div>
                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
                    <div style={{
                      height: '100%', width: `${prog}%`, borderRadius: 2,
                      background: prog === 100 ? 'var(--green)' : overdueCount > 0 ? 'var(--red)' : 'var(--accent-blue)',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{prog}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Checklist detail */}
        {selectedEng && (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedEng.talent_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedEng.client} · {selectedEng.role} · Started {new Date(selectedEng.start_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* 7-stage timeline */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, overflowX: 'auto' }}>
              {selectedItems.map((item, idx) => {
                const isCompleted = item.completed;
                const isOverdue = item.overdue;
                const isCurrent = !isCompleted && idx === selectedItems.findIndex(i => !i.completed);
                return (
                  <div key={item.id} style={{ flex: 1, textAlign: 'center', minWidth: 80 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {idx > 0 && (
                        <div style={{ flex: 1, height: 2, background: isCompleted || selectedItems[idx - 1]?.completed ? 'var(--green)' : 'var(--border)' }} />
                      )}
                      <div
                        onClick={() => !isCompleted && complete(item.id)}
                        style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: isCompleted ? 'var(--green)' : isOverdue ? 'var(--red-dim)' : isCurrent ? 'var(--accent-blue-dim)' : 'var(--bg-hover)',
                          border: `2px solid ${isCompleted ? 'var(--green)' : isOverdue ? 'var(--red)' : isCurrent ? 'var(--accent-blue)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: isCompleted ? 'default' : 'pointer',
                          fontSize: 14, flexShrink: 0,
                          transition: 'all 0.2s',
                        }}
                      >
                        {isCompleted ? '✓' : isOverdue ? '!' : STAGE_ICONS[idx] || idx + 1}
                      </div>
                      {idx < selectedItems.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: isCompleted ? 'var(--green)' : 'var(--border)' }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 9, marginTop: 5,
                      color: isCompleted ? 'var(--green)' : isOverdue ? 'var(--red)' : isCurrent ? 'var(--accent-blue)' : 'var(--text-muted)',
                      fontWeight: isCurrent || isOverdue ? 700 : 400,
                      lineHeight: 1.2,
                    }}>
                      {item.stage_name}
                    </div>
                    {isOverdue && (
                      <div style={{ fontSize: 8, color: 'var(--red)', fontWeight: 700, marginTop: 2 }}>OVERDUE</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Item list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedItems.map((item) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 6,
                  background: item.overdue ? 'rgba(255,71,87,0.04)' : 'var(--bg-card2)',
                  border: `1px solid ${item.overdue ? 'rgba(255,71,87,0.25)' : 'var(--border)'}`,
                }}>
                  <div
                    onClick={() => !item.completed && complete(item.id)}
                    style={{
                      width: 18, height: 18, borderRadius: 4,
                      border: `2px solid ${item.completed ? 'var(--green)' : item.overdue ? 'var(--red)' : 'var(--border-light)'}`,
                      background: item.completed ? 'var(--green)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: item.completed ? 'default' : 'pointer', flexShrink: 0,
                      fontSize: 11, color: '#fff',
                    }}
                  >
                    {item.completed && '✓'}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)', flex: 1, textDecoration: item.completed ? 'line-through' : 'none' }}>
                    {item.stage_name}
                  </span>
                  {item.overdue && (
                    <span className="badge badge-red" style={{ fontSize: 9 }}>OVERDUE</span>
                  )}
                  {item.due_date && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {new Date(item.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
